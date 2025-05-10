// connection and functions
const User = require("./model/user.js");
const Ticket = require("./model/ticket.js");
const Region = require("./model/region.js");
const mongoose = require('mongoose')

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/test');
})().catch(err => console.log(err));

const createDocument = async (Model, details) => {
    try{
        const doc = new Model(details);
        await doc.save();
        return doc;
    } catch (err) {
        console.error(err);
    }
}

module.exports = {}