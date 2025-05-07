const express = require('express')
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../database/model/user');

router.route('/signup')
    .post(async (req, res) => {
        // signup schema validations
        req.body.password = await bcrypt.hash(req.body.password, 10);
        let details = req.body;
        console.log(details)
        let newUser = new User(details);
        newUser.save();

        const accessToken = jwt.sign({ _id: newUser._id.toString(), username: newUser.username, role: newUser.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ _id: newUser._id.toString(), username: newUser.username, role: newUser.role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

        
    })

router.route('/login')
    .post((req, res) => { })

module.exports = router;