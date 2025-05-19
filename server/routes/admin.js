const express = require('express');
const router = express.Router();
const axios = require('axios');
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const { DEFAULT_EXPIRATION } = require('../constants').redis;
const SLOT = require('../constants').slot;


router.route("/")
    .get(async (req, res, next) => {

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
    .patch(async (req, res, next) => {

        try {

            const user = req.user;
            let { error } = joi.updateAdminSchema.validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            let data = await redis.updateCache(`${user.role}:${user._id}`, req.body.updates, DEFAULT_EXPIRATION);
            
            req.body.updates.region = (await redis.getCache(`region:${req.body.updates.region}`))._id;

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
    .get(async (req, res, next) => { /* fetch all tickets for admin based on their slot if and only if the current time falls within their slot timing. Also give the shortest path to traverse. Try limiting number of requests(rate limiting) for an IP to prevent inconsistency */

        try {

            const user = req.user;
            const currTime = (new Date(Date.now()/* + (5.5 * 60 * 60 * 1000)*/)).toISOString().split('T')[1].slice(0, 8);

            const { start, end } = SLOT[user.slot];
            if (!(start <= currTime && end >= currTime)) {
                throw new ExpressError(403, 'Forbidden, try again in your time slot');
            }

            // store objectId in user.region & get region object from redis cache

            const region = await redis.getCache(`region:${user.region}`);


            let tickets = await redis.getOrSetCache(`ticket:${user.slot}:${region.name}`, async () => {
                let tickets = await Ticket.find({
                    slot: user.slot,
                    location: {
                        $geoWithin: {
                            $geometry: {
                                type: 'Polygon',
                                coordinates: region.area.coordinates
                            }
                        }
                    }
                }).select('-note');

                return tickets;
            });

            console.log("GET /admin/ticket; tickets: ", tickets);
            console.log("GET /admin/ticket; tickets: ",typeof tickets);

            // find the shortest path and return

            const coords = tickets.map(ticket => ticket.location.coordinates);

            const shortestPath = await getShortestPath(coords);


            const response = shortestPath ? {tickets, shortestPath} : {tickets};

            return res.status(200).send(response);

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
    .put(async (req, res, next) => {
        try {

            const user = req.user;
            let ticketId = req.params.id;

            const updates = {
                status: 'closed'
            }

            await redis.updateCache(`ticket:${ticketId}`, updates);

            //implement write-behind cache later

            await Ticket.findByIdAndUpdate(ticketId, updates);

            return res.status(200).send('ticket closed');

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
    if (!Array.isArray(coords) || coords.length < 2) {
        // throw new Error('At least 2 coordinates are required for routing.');/
        return false;
    }

    for (const c of coords) {
        if (!Array.isArray(c) || c.length !== 2 || isNaN(c[0]) || isNaN(c[1])) {
            throw new Error('Invalid coordinate format. Each point must be [lon, lat] with numeric values.');
        }
    }

    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    try {
        const res = await axios.get(url);
        const route = res.data.routes[0];
        return {
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry
        };
    } catch (err) {
        console.error('Axios: Error fetching route:', err.response?.status, err.response?.data || err.message);
        throw new Error('Axios error');
    }
}

// async function getShortestPath(coords) {
//     const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
//     const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

//     try {
//         const res = await axios.get(url);
//         const route = res.data.routes[0];
//         return {
//             distance: route.distance, // in meters
//             duration: route.duration, // in seconds
//             geometry: route.geometry  // GeoJSON LineString
//         };
//     } catch (err) {
//         console.error('Axios: Error fetching route:', err.message);
//         throw new Error('Axios error');
//     }
// }