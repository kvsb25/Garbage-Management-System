const redis = require('./redis');
const joi = require('./joi');
const region = require('./region');

const slot = {
    // morning: {
    //     start: '09:00:00',
    //     end: '10:30:00'
    // },
    morning: {
        start: '00:00:00',
        end: '23:30:00'
    },
    afternoon: {
        start: '13:00:00',
        end: '14:30:00'
    },
    evening: {
        start: '15:30:00',
        end: '17:00:00'
    }
}

module.exports = {
    redis,
    joi,
    slot,
    region
}