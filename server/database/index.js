// connection and functions
const User = require("./model/user.js");
const Ticket = require("./model/ticket.js");
const Region = require("./model/region.js");

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