require('dotenv').config();
const express = require('express');
const app = express();
const path = require("path");
const router = require('./routes');
const ExpressError = require('./error');
const cookieParser = require('cookie-parser');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use('/auth', router.auth);
app.use('/admin', router.admin);
app.use('/customer', router.customer);

app.use((error, req, res, next)=>{
    if(error instanceof ExpressError){
        console.error(`status: ${error.status}, message: ${error.message}`);
        return res.status( error.status || 500 ).send({message: error.message});
    }
    return res.status(500).send('server error');
})

app.listen(3000, ()=>{console.log('http listening at 3000')});