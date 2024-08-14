// models/cart.js
const mongoose = require('mongoose');

// Define the schema for the cart
const cartSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    items: [{
        eventId: String,
        title: String,
        seats: Number,
        pricePerSeat: Number,
        totalPrice: Number,
        image: String,
        location: String,
        date: String,
    }]
});

// Create and export the Cart model
const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
