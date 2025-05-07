const Joi = require('joi');

const adminSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    email: Joi.string().pattern(/^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/).required(),
    phone: Joi.string().length(10).required(),
    role: Joi.string().valid('admin').required()
    
})