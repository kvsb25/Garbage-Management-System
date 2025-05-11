const Joi = require('joi');
const {VALID, REGEX} = require('../constants').joi

const valid = {
    regions: ['area1', 'area2', 'area3', 'area4'],
    roles: ['admin', 'customer'],
    slots: ['morning', 'afternoon', 'evening'],
    updateKey: ['username', 'email', 'phone', 'region', 'slot'],
}

const regex = {
    // email: /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    email: /^(?=[^<>]*$)[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=[^<>]*$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/, // Password must be at least 12 characters long, contain no < or > symbols, and include at least one uppercase letter, one lowercase letter, one number, and one special character
    disallowHtml: /^[^<>]*$/,
}

const signUpSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().pattern(REGEX.disallowHtml).required(),
    email: Joi.string().pattern(REGEX.email).required(),
    phone: Joi.string().length(10).required(),
    role: Joi.string().valid(...VALID.roles).required(),
    slot: Joi.alternatives().conditional('role', {
        is: 'admin',
        then: Joi.string().valid(...VALID.slots).required(),
        otherwise: Joi.any().strip()
    }),
    region: Joi.alternatives().conditional('role', {
        is: 'admin',
        then: Joi.string().valid(...VALID.regions).required(),
        otherwise: Joi.any().strip()
    })
});

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().pattern(REGEX.disallowHtml).required(),
})

const Joi = require('joi');

// const updateCustomerSchema = Joi.object({
//     updates: Joi.array().items(
//         Joi.object({
//             key: Joi.string().valid('email', 'phone',),
//             value: Joi.alternatives().conditional('key', [
//                 {
//                     is: 'email',
//                     then: Joi.string()
//                         .pattern(REGEX.email)
//                         .message('Invalid email (e.g., user@example.com)'),
//                 },
//                 {
//                     is: 'phone',
//                     then: Joi.string()
//                         .pattern(/^(\+91|0)?[6-9]\d{9}$/) // Indian phone regex
//                         .message('Must be a valid Indian phone (10 digits, starts with 6-9)'),
//                 },
//                 {
//                     otherwise: Joi.string(),
//                 },
//             ]),
//         })
//     ),
// });

const updateCustomerSchema = Joi.object({
    updates: Joi.object({
        email: Joi.string().pattern(REGEX.email),
        phone: Joi.string().pattern(REGEX.phone),
    })
})

const updateAdminSchema = Joi.object({
    updates: Joi.object({
        email: Joi.string().pattern(REGEX.email),
        phone: Joi.string().pattern(REGEX.phone),
        region: Joi.string().valid(...VALID.regions),
        slot: Joi.string().valid(...VALID.slots)
    })
})

const ticketSchema = Joi.object({
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
  }).required(),

  slot: Joi.string().valid('morning', 'afternoon', 'evening').required(),

  note: Joi.string()
    .allow('', null)
    .optional()
    .default(undefined, 'Strip if empty')
    .transform((value) => (value === '' || value === null ? undefined : value)),
    
}).options({ stripUnknown: true });

module.exports = { signUpSchema, loginSchema, updateCustomerSchema, updateAdminSchema, ticketSchema, Joi }