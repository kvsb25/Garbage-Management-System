const express = require('express')
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../database/model/user');
const joi = require('../utils/joi.js');
const ExpressError = require('../error.js');
const redis = require('../redis/redis.js');
const { required } = require('joi');

router.route('/signup')
    .post(async (req, res) => {
        try {

            const { error } = joi.signUpSchema.validate(req.body);
            if (error) throw new ExpressError(400, 'Inappropriate request body');

            

            req.body.password = await bcrypt.hash(req.body.password, 10);

            //
            const region = await redis.getCache(`region:${req.body.region}`);
            req.body.region = typeof region._id === 'string'
                ? new mongoose.Types.ObjectId(region._id)
                : region._id;
            //

            let details = req.body;

            console.log(details)

            let newUser = new User(details);  // storing mongoose object in DB
            newUser.save();

            const accessToken = jwt.sign({ _id: newUser._id.toString(), username: newUser.username, role: newUser.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
            const refreshToken = jwt.sign({ _id: newUser._id.toString(), username: newUser.username, role: newUser.role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

            if (!accessToken || !refreshToken) throw new ExpressError(500, 'No tokens generated');

            res.cookie('token', accessToken, {
                signed: true,
                httpOnly: true,
                // secure: true,
                maxAge: 15 * 60 * 1000,
                // sameSite: 'Strict'
            });
            res.cookie('refreshToken', refreshToken, {
                signed: true,
                httpOnly: true,
                // secure: true, 
                maxAge: 7 * 24 * 60 * 60 * 1000,
                // sameSite: 'Strict'
            });

            return res.status(200).send('successfully registered');

        } catch (error) {
            console.error(error);
            
            
            if(error instanceof mongoose.Error.ValidatorError){
                if(error.errors['username'].kind == 'required'){
                    const err = new ExpressError(409, `Username already in use`);
                    return next(err);
                }
            };

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })

router.route('/login')
    .post(async (req, res) => {
        try {

            const { error } = joi.loginSchema.validate(req.body);
            if (error) throw new ExpressError(400, 'Inappropriate request body');

            let user = User.findOne({ username: req.body.username });

            if (!user) throw new ExpressError(401, 'wrong username')

            if (await bcrypt.compare(req.body.password, user.password)) {

                const accessToken = jwt.sign({ _id: user._id.toString(), username: user.username, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
                const refreshToken = jwt.sign({ _id: user._id.toString(), username: user.username, role: user.role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

                res.cookie('token', accessToken, {
                    signed: true,
                    httpOnly: true,
                    // secure: true, 
                    maxAge: 15 * 60 * 1000,
                    // sameSite: 'Strict'
                });
                res.cookie('refreshToken', refreshToken, {
                    signed: true,
                    httpOnly: true,
                    // secure: true, 
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                    // sameSite: 'Strict'
                });

                return res.status(200).send(`successfully logged in! ${accessToken}`); /*, ${refreshToken }`);*/

            } else {
                throw new ExpressError(401, `wrong password`);
            }

        } catch (error) {
            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })

router.route('/generate-token')
    .post((req, res) => {
        try {

            const refreshToken = req.signedCookies.refreshToken;
            if (!refreshToken) { throw new ExpressError(403, 'Forbidden') }

            jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {

                if (err) throw new ExpressError(403, 'Forbidden: unauthorized refresh token');

                const accessToken = jwt.sign({ _id: user._id, username: user.username, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15min' });

                res.cookie('token', accessToken, {
                    signed: true,
                    httpOnly: true,
                    // secure: process.env.NODE_ENV === "production",
                    maxAge: 15 * 60 * 1000,
                    // sameSite: "Strict",
                });
                
                return res.sendStatus(200);
            })

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