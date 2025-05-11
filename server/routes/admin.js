const express = require('express')
const router = express.Router();
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const { DEFAULT_EXPIRATION } = require('../constants').redis;
const slot = require('../constants').slot;


router.route("/")
    .get((req, res) => {
        try {

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
    .patch(async (req, res) => {

        try {

            const user = req.user;
            let { error } = joi.updateAdminSchema.validate(req.body);
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
    .get((req, res) => { /* fetch all tickets for admin based on their slot if and only if the current time falls within their slot timing. Also give the shortest path to traverse. Try limiting number of requests(rate limiting) for an IP to prevent inconsistency */ 
        
        try {

            const user = req.user;
            const currTime = (new Date(Date.now() + (5.5 * 60 * 60 * 1000))).toISOString().split('T')[1].slice(0,8);

            const { start, end } = slot[user.slot];
            if(!(start <= currTime && end >= currTime)) {
                throw new ExpressError(403, 'Forbidden, try again in your time slot');
            }

            let ticket = redis.getOrSetCache(`ticket:slot:${user.slot}`, async () => {
                let ticket = await Ticket.find({slot: user.slot});

                return ticket;
            });

            // find the shortest path and return

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }

    })

router.route("/ticket/:id")
    .get(async (req, res) => {

        try {

            let ticketId = req.params.id;

            let ticket = await redis.getOrSetCache(`ticket:${ticketId}`, async () => {
                const ticket = await Ticket.findOne({ _id: ticketId });

                //
                let temp = ticket.createdAt;

                if (temp instanceof Date) {
                    // to convert time to Indian Standard Time
                    const istDate = new Date(temp.getTime() + (5.5 * 60 * 60 * 1000));
                    temp = istDate.toISOString();
                    // temp = temp.toISOString();
                }
                const [dateOfCreation, timeOfCreation] = [temp.slice(0, 10), temp.slice(11, 16)];
                //

                return { ...ticket, dateOfCreation, timeOfCreation };
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
    .patch(async (req, res) => {

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

            await redis.updateCache(`ticket:${ticketId}`, updates);

            //implement write-behind cache later
            let ticket = Ticket.findById(ticketId);
            ticket.note ??= [];
            ticket.note.push(updates.note);
            await ticket.save();

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }

    })
    .put( async (req, res) => {
        try {

            const user = req.user;
            let ticketId = req.params.id;

            const updates = {
                status : 'closed'
            }

            await redis.updateCache(`ticket:${ticketId}`, updates);

            //implement write-behind cache later

            await Ticket.findByIdAndUpdate(ticketId, updates);

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