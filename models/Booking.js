const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bookingDetails: [
        {
            eventId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            eventName: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            time: {
                type: String,
                required: true
            },
            status: {
                type: String,
                default: 'pending'
            }
        }
    ],
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true
    },
    paymentOrderId: {
        type: String,
        required: true
    },
    paymentId: {
        type: String
    },
    paymentStatus: {
        type: String,
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
