const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "a name is required"],
    },
    area: {
        type: {
            type: String,
            enum: { values: ['Polygon'], message: 'only Polygon coordinates are supported for Admin area' },
            default: 'Polygon',
        },
        coordinates: {
            type: [[[Number]]],
            required: [true, 'coordinates are required'],
        },
    },
})

regionSchema.index({ area: '2dsphere' });

module.exports = mongoose.model("region", regionSchema);