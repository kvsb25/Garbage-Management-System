const express = require('express');
const router = express.Router();
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const constants = require('../constants');
const { DEFAULT_EXPIRATION } = constants.redis;
const { PARENT_REGION } = constants.region;
const { isPointInPolygon } = require('../utils/miscellaneous.js');


router.route("/")
    .get((req, res, next) => {
        try {

            console.log('reached /customer')
            return res.status(200).send({ ...req.user });

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })
    .patch(async (req, res, next) => {

        try {

            const user = req.user;
            let { error } = joi.updateCustomerSchema.validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            let data = await redis.updateCache(`${user.role}:${user._id}`, req.body.updates, DEFAULT_EXPIRATION);

            await User.findByIdAndUpdate(user._id, req.body.updates); // later add a queue for storing in database, implement write-behind caching

            res.status(200).send(data);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }

    })

router.route("/ticket")
    .get(async (req, res, next) => {

        try {

            const user = req.user;
            const tickets = await redis.getOrSetCache(`${user.role}:${user._id}:tickets`, async () => {
                const tickets = Ticket.find({ ownerId: user._id }).select('-ownerId -note');

                // update createdAt to IST from UTC
                console.log(tickets);
                return tickets;
            }, DEFAULT_EXPIRATION);

            res.status(200).send(tickets);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })
    .post(async (req, res, next) => {

        try {

            const user = req.user;
            let { error } = joi.ticketSchema.validate(req.body);
            if (error) { 
                console.error(error);
                throw new ExpressError(400, 'Invalid request body') 
            };

            if (!(isPointInPolygon(req.body.location.coordinates, PARENT_REGION ))) {
                throw new ExpressError(400, 'choose a location within the designated working area');
            }

            let tempTickets = await redis.getCache(`${user.role}:${user._id}:tickets`);
            let duplicate = false;
            
            console.log(tempTickets);
            if(tempTickets != null){
                // duplicate = (req.body.location.coordinates == tempTicket[0].location.coordinates);
                duplicate = tempTickets.some((ticket)=> ticket.location.coordinates == req.body.location.coordinates);
                console.log('duplicate in redis fetch: ', duplicate);
            } else {
                let tickets = await Ticket.find({ ownerId: user._id }).select('location');
                console.log(tickets);
                // duplicate = (req.body.location.coordinates == ticket.location.coordinates);
                if(tickets){
                    // duplicate = tickets.some((ticket)=> (ticket.location.coordinates == req.body.location.coordinates));
                    tickets.forEach((ticket)=>{
                        console.log(ticket.location.coordinates);
                        if((ticket.location.coordinates[0] == req.body.location.coordinates[0])){
                            if((ticket.location.coordinates[1] == req.body.location.coordinates[1]))
                            duplicate = true;
                        }
                    })

                    console.log('duplicate in mongoDB fetch: ', duplicate);
                }
            }

            console.log('duplicate: ', duplicate);

            if(duplicate){
                throw new ExpressError(409, 'duplicate entry');
            }

            // if note exists then store the ticket with note as an array
            console.log(typeof req.body.note == 'string');
            if (req.body.note && (typeof req.body.note == 'string')) {
                let message = req.body.note;
                req.body.note = [{ author: `${user.username}`, message }]
            }

            console.log("POST /customer/ticket; req.body: ", req.body);

            let ticket = new Ticket({ ...req.body, ownerId: user._id, status: 'active' }); // write-behind cache

            // 
            let temp = ticket.createdAt = new Date(Date.now()/* + (5.5 * 60 * 60 * 1000)*/);  // instead of converting to IST everywhere, just convert it here

            if (temp instanceof Date) {
                temp = temp.toISOString();
            }
            const [dateOfCreation, timeOfCreation] = [temp.slice(0, 10), temp.slice(11, 16)];
            //

            await redis.setCache(`ticket:${ticket._id}`, { ...ticket, dateOfCreation, timeOfCreation });
            // await redis.setCache(`${user.role}:${user._id}:tickets`, { ...ticket, dateOfCreation, timeOfCreation });

            //implement write-behind cache later
            await ticket.save();

            console.log("POST /customer/ticket; ticket: ", {...ticket.toJSON()});

            return res.status(201).send({ ...ticket.toJSON(), dateOfCreation, timeOfCreation });

        } catch (error) {

            console.error(error);
            console.log(error instanceof ExpressError);

            if (!(error instanceof ExpressError)  && !(error.status)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })

router.route("/ticket/:id")
    .get(async (req, res, next) => {

        try {

            let ticketId = req.params.id;

            let ticket = await redis.getOrSetCache(`ticket:${ticketId}`, async () => {
                const ticket = await Ticket.findOne({ _id: ticketId });

                //
                let temp = ticket.createdAt;

                if (temp instanceof Date) {
                    // to convert time to Indian Standard Time
                    // const istDate = new Date(temp.getTime() + (5.5 * 60 * 60 * 1000));
                    // temp = istDate.toISOString();
                    temp = temp.toISOString();
                }
                const [dateOfCreation, timeOfCreation] = [temp.slice(0, 10), temp.slice(11, 16)];
                //

                return { ...ticket.toJSON(), dateOfCreation, timeOfCreation };
            })

            return res.status(200).send(ticket);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })
    .patch(async (req, res, next) => {
        try {

            const user = req.user;
            let ticketId = req.params.id;

            let { error } = joi.Joi.object({ note: joi.Joi.string().required() }).validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            const updates = {
                note: {
                    author: `${user.username}`,
                    message: req.body.note,
                }
            }

            let data = await redis.updateCache(`ticket:${ticketId}`, updates);

            //implement write-behind cache later
            let ticket = await Ticket.findById(ticketId);
            ticket.note ??= [];
            ticket.note.push(updates.note);
            await ticket.save();

            return res.status(200).send(data);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })
    .delete(async (req, res, next) => {

        try {

            let ticketId = req.params.id;

            await redis.deleteCache(`ticket:${ticketId}`);

            await Ticket.findByIdAndDelete(ticketId);

            res.status(200).send('deleted successfully');

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })

module.exports = router;