const express = require('express');
const router = express.Router();
const axios = require('axios');
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const { DEFAULT_EXPIRATION } = require('../constants').redis;
const slot = require('../constants').slot;


router.route("/")
    .get(async (req, res) => {

        try {

            req.user.region = (await redis.getCache(`region:${req.user.region}`)).name;
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
    .get(async (req, res) => { /* fetch all tickets for admin based on their slot if and only if the current time falls within their slot timing. Also give the shortest path to traverse. Try limiting number of requests(rate limiting) for an IP to prevent inconsistency */

        try {

            const user = req.user;
            const currTime = (new Date(Date.now()/* + (5.5 * 60 * 60 * 1000)*/)).toISOString().split('T')[1].slice(0, 8);

            const { start, end } = slot[user.slot];
            if (!(start <= currTime && end >= currTime)) {
                throw new ExpressError(403, 'Forbidden, try again in your time slot');
            }

            // store objectId in user.region & get region object from redis cache

            const region = await redis.getCache(`region:${user.region}`);


            let tickets = redis.getOrSetCache(`ticket:${user.slot}:${region.name}`, async () => {
                let tickets = await Ticket.find({
                    slot: user.slot,
                    location: {
                        $geoWithin: {
                            $geometry: {
                                type: 'Polygon',
                                coordinates: [region.area.coordinates]
                            }
                        }
                    }
                });

                return tickets;
            });

            // find the shortest path and return

            const coords = tickets.map(ticket => ticket.location.coordinates);

            const shortestPath = getShortestPath(coords);

            return res.status(200).send({tickets, shortestPath});

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
                    // const istDate = new Date(temp.getTime() + (5.5 * 60 * 60 * 1000));
                    // temp = istDate.toISOString();
                    temp = temp.toISOString();
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

            let data = await redis.updateCache(`ticket:${ticketId}`, updates);

            //implement write-behind cache later
            let ticket = Ticket.findById(ticketId);
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
    .put(async (req, res) => {
        try {

            const user = req.user;
            let ticketId = req.params.id;

            const updates = {
                status: 'closed'
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

async function getShortestPath(coords) {
    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    try {
        const res = await axios.get(url);
        const route = res.data.routes[0];
        return {
            distance: route.distance, // in meters
            duration: route.duration, // in seconds
            geometry: route.geometry  // GeoJSON LineString
        };
    } catch (err) {
        console.error('Axios: Error fetching route:', err.message);
        throw new Error('Axios error');
    }
}