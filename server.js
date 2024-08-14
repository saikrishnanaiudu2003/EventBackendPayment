const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Booking');
const { sendBookingEmail,sendRegistrationEmail } = require('./mailer');
const Razorpay = require('razorpay'); // Import Razorpay package
const crypto = require('crypto');
const Cart = require('./models/cart');


const razorpay = new Razorpay({
    key_id: 'rzp_test_KHvP6Cq8SdiBUB',
    key_secret: 'GjAQjaaOyKwhhfaTvgZga1Bp',
});


const cors = require('cors');


const app = express();
const port = process.env.PORT || 6003;
const secret = 'your_jwt_secret_key'; 

app.use(bodyParser.json());
app.use(cors());




mongoose.connect('mongodb+srv://myAtlasDBUser:Sai123@myatlasclusteredu.qifwasp.mongodb.net/grampay?retryWrites=true&w=majority&appName=myAtlasClusterEDU', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.get("/",(req,res)=> res.json("Api Working"))
const auth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).send('No token provided');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
        const user = await User.findById(decoded.userId); // Make sure to use the correct field for user ID

        if (!user) {
            throw new Error('User not found');
        }

        req.user = user; 
        next();
    } catch (error) {
        res.status(401).send('Unauthorized');
    }
};
app.post('/signup', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role });
        await user.save();
        await sendRegistrationEmail(email, name);
        res.status(201).send('User created');
    } catch (error) {
        console.error('Error creating user:', error); 
        res.status(400).send(`Error creating user: ${error.message}`);
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid credentials');
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, secret, { expiresIn: '1h' });
        res.json({ token, role: user.role,name:user.name,userId:user._id }); // Ensure role is included in response
    } catch (error) {
        console.error('Error logging in:', error); // Log the error for debugging
        res.status(400).send('Error logging in');
    }
});

app.put('/users/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    try {
        // Find user by ID
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Update user details
        if (name) user.name = name;
        if (email) user.email = email;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }
        if (role) user.role = role;

        await user.save();
        res.status(200).send('User updated');
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(400).send('Error updating user');
    }
});


app.delete('/users/:id', auth, async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.status(200).send('User deleted');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(400).send('Error deleting user');
    }
});

app.get('/users',auth, async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords from response
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error fetching users');
    }
});
// Verify route to return user role
app.get('/verify', auth, (req, res) => {
    res.json({ role: req.user.role });
});


app.post('/events', auth, async (req, res) => {
    const { title, description, date, location, image, price, speaker, seats, contactNumber } = req.body;
    const userId = req.user._id;

    if (req.user.role !== 'admin' && req.user.role !== 'organizer') {
        return res.status(403).send('Forbidden');
    }

    try {
        const event = new Event({ title, description, date, location, image, price, speaker, seats, contactNumber, organizer: userId });
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(400).send('Error creating event');
    }
});

// Backend endpoint to fetch events
// Backend endpoint to fetch events
app.get('/events', auth, async (req, res) => {
    try {
        const userRole = req.user.role;

        let events;
        if (userRole === 'admin') {
            // Admin sees all events
            events = await Event.find();
        } else if (userRole === 'organizer') {
            // Organizer sees only their own events
            events = await Event.find({ organizer: req.user._id });
        } else if (userRole === 'user') {
            // User sees all events
            events = await Event.find();
        } else {
            // Handle other roles or unauthorized access
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
});





app.get('/events/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching event', error });
    }
});


app.put('/events/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { title, description, date, location, image, price, speaker, seats, contactNumber } = req.body;
    const userId = req.user._id;

    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        if (req.user.role !== 'admin' && event.organizer.toString() !== userId.toString()) {
            return res.status(403).send('Forbidden');
        }

        const updatedEvent = await Event.findByIdAndUpdate(id, { title, description, date, location, image, price, speaker, seats, contactNumber }, { new: true });
        res.status(200).json(updatedEvent);
    } catch (error) {
        res.status(400).send('Error updating event');
    }
});


app.delete('/events/:id', auth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        if (req.user.role !== 'admin' && event.organizer.toString() !== userId.toString()) {
            return res.status(403).send('Forbidden');
        }

        await Event.findByIdAndDelete(id);
        res.status(200).send('Event deleted');
    } catch (error) {
        res.status(400).send('Error deleting event');
    }
});




// Booking initiation route
app.post('/bookings', auth, async (req, res) => {
    const { bookingDetails, amount } = req.body;
    const userId = req.user._id;

    // Log the incoming request body to debug
    console.log(req.body);

    // Validate that bookingDetails is present and is an array
    if (!bookingDetails || !Array.isArray(bookingDetails) || bookingDetails.length === 0) {
        return res.status(400).json({ message: 'Booking details are required and must be an array' });
    }

    try {
        // Create a payment order with Razorpay
        const order = await razorpay.orders.create({
            amount: amount * 100, // Amount in paise
            currency: 'INR',
            receipt: `receipt_${userId}_${Date.now()}`.substring(0, 40), // Limit to 40 characters
        });

        // Create a booking entry in the database
        const booking = new Booking({
            userId,
            amount,
            paymentMethod: 'Razorpay',
            bookingDetails: bookingDetails.map(detail => ({
                eventId: detail.eventId,
                eventName: detail.eventName,
                price: detail.price,
                time: detail.time,
                status: 'pending'
            })),
            paymentOrderId: order.id,
        });
        await booking.save();

        // Respond with the order ID and payment details
        res.status(201).json({
            message: 'Booking initiated',
            orderId: order.id,
            amount: order.amount / 100, // Convert amount back to rupees
            currency: order.currency,
            receipt: order.receipt,
        });

    } catch (error) {
        console.error('Error initiating booking:', error);
        res.status(500).json({ message: 'Error initiating booking', error });
    }
});

// Payment verification route
app.post('/verify-payment', auth, async (req, res) => {
    const { orderId, paymentId, signature } = req.body;

    try {
        const generatedSignature = crypto.createHmac('sha256', 'GjAQjaaOyKwhhfaTvgZga1Bp')
            .update(orderId + '|' + paymentId)
            .digest('hex');

        const isSignatureValid = generatedSignature === signature;

        if (!isSignatureValid) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        // Update the booking status to confirmed
        const booking = await Booking.findOneAndUpdate(
            { paymentOrderId: orderId },
            { paymentId, paymentStatus: 'confirmed', 'bookingDetails.$[].status': 'confirmed' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Fetch user and event details for email confirmation
        const user = await User.findById(booking.userId);
        const eventIds = booking.bookingDetails.map(detail => detail.eventId);
        const events = await Event.find({ _id: { $in: eventIds } });

        const eventLocation = events.map(event => event.location).join(', ');

        // Send a confirmation email with details
        await sendBookingEmail(
            user.email,
            user.name,
            booking.bookingTitle,
            new Date().toLocaleString(),
            eventLocation,
            booking.bookingDetails
        );

        res.status(200).json({ message: 'Payment verified and booking confirmed', booking });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Error verifying payment', error });
    }
});

app.get('/bookings', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role; // Assume that the role is part of the user's JWT payload

        let bookings;

        if (userRole === 'admin') {
            // Admin: Fetch all bookings
            bookings = await Booking.find()
                .populate('userId', 'name email')
                .populate('bookingDetails.eventId', 'title');
        } else if (userRole === 'organizer') {
            // Organizer: Fetch only bookings for events they created
            const events = await Event.find({ organizerId: userId }).select('_id');
            const eventIds = events.map(event => event._id);

            bookings = await Booking.find({
                'bookingDetails.eventId': { $in: eventIds }
            })
                .populate('userId', 'name email')
                .populate('bookingDetails.eventId', 'title');
        } else if (userRole === 'user') {
            // User: Fetch only their bookings
            bookings = await Booking.find({ userId })
                .populate('userId', 'name email')
                .populate('bookingDetails.eventId', 'title');
        } else {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Format the bookings data
        const formattedBookings = bookings.map(booking => ({
            bookingId: booking._id,
            userName: booking.userId.name,
            email: booking.userId.email,
            bookingTitle: booking.bookingDetails.map(detail => detail.eventId.title).join(', '),
            price: booking.amount,
            status: booking.paymentStatus,
        }));

        res.status(200).json({ bookings: formattedBookings });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Error fetching bookings', error });
    }
});





app.get('/stats/users', auth, async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user count', error });
    }
});
app.get('/stats/bookings', auth, async (req, res) => {
    try {
        const count = await Booking.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching booking count', error });
    }
});

app.get('/stats/events', auth, async (req, res) => {
    try {
        const count = await Event.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching event count', error });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
