const Joi = require('joi');

const valid = {
    regions: ['area1', 'area2', 'area3', 'area4'],
    roles: ['admin', 'customer'],
    slots: ['morning', 'afternoon', 'evening']
}

const regex = {
    // email: /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    email: /^(?=[^<>]*$)[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=[^<>]*$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/, // Password must be at least 12 characters long, contain no < or > symbols, and include at least one uppercase letter, one lowercase letter, one number, and one special character
    disallowHtml: /^[^<>]*$/,
}

const signUpSchema = {
    username: Joi.string().required(),
    password: Joi.string().pattern(regex.disallowHtml).required(),
    email: Joi.string().pattern(regex.email).required(),
    phone: Joi.string().length(10).required(),
    role: Joi.string().valid(...valid.roles).required(),
    slot: Joi.alternatives().conditional('role', { 
        is: 'admin', 
        then: Joi.string().valid(...valid.slots).required(), 
        otherwise: Joi.any().strip() 
    }),
    region: Joi.alternatives().conditional('role', {
        is: 'admin',
        then: Joi.string().valid(...valid.regions).required(),
        otherwise: Joi.any().strip()
    })
};

const loginSchema = {
    username: Joi.string().required(),
    password: Joi.string().pattern(regex.disallowHtml).required(),
}

const adminSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    email: Joi.string().pattern(/^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/).required(),
    phone: Joi.string().length(10).required(),
    role: Joi.string().valid('admin').required()
})

module.exports = {signUpSchema, loginSchema}