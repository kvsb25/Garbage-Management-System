const express = require('express');
const router = express.Router();
const joi = require('../utils/joi');
const User = require('../database/model/user');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const {DEFAULT_EXPIRATION} = require('../constants').redis;


router.route("/")
    .get((req, res) => { 
        try{

            return res.status(200).send({...req.user});

        } catch(error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })
    .patch( async (req, res) => { 
        
        try{

            const user = req.user;
            let {error} = joi.updateCustomerSchema.validate(req.body);
            if (error) {throw new ExpressError(400, 'Inappropriate request body')};

            let data = await redis.updateCache(`${user.role}:${user._id}`, req.body.updates, DEFAULT_EXPIRATION);

            await User.findByIdAndUpdate(user._id, req.body.updates); // later add a queue for storing in database

            res.status(200).send(data);

        } catch(error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }

    })

router.route("/ticket")
    .get((req, res) => { })
    .post((req, res) => { })
    
router.route("/ticket/:id")
    .get((req, res) => { })
    .post((req, res) => { })
    .delete((req, res) => { })

module.exports = router;