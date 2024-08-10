const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail', // or other email services
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendBookingEmail = async (userEmail, userName, eventTitle, bookingTime) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER, // Sender address
            to: userEmail, // Recipient address
            subject: 'Event Booking Confirmation', // Subject line
            text: `Dear ${userName},\n\nYou have successfully booked the event: ${eventTitle} on ${bookingTime}.\n\nThank you for booking with us!`, // Plain text body
        });
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Error sending email');
    }
};





const sendRegistrationEmail = async (userEmail, userName) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: 'Registration Successful',
            text: `Dear ${userName},\n\nThank you for registering with us! Your registration was successful.\n\nBest regards,\nThe Team`,
        });
    } catch (error) {
        console.error('Error sending registration email:', error);
        throw new Error('Error sending registration email');
    }
};

module.exports = { sendBookingEmail, sendRegistrationEmail };