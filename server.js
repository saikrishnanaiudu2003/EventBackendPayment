const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const User = require('./models/User');
const Event = require('./models/Event');
const Booking = require('./models/Booking');
const { sendBookingEmail,sendRegistrationEmail } = require('./mailer');




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
        res.json({ token, role: user.role }); // Ensure role is included in response
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



app.post('/bookings', auth, async (req, res) => {
    const { eventId } = req.body;
    const userId = req.user._id;

    try {
        // Ensure the event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Create a booking
        const booking = new Booking({ event: eventId, user: userId });
        await booking.save();

        // Populate the user and event details
        const populatedBooking = await Booking.findById(booking._id)
            .populate('user', 'name email')
            .populate('event', 'title')
            .exec();

        // Extract user and event details
        const { name: userName, email: userEmail } = populatedBooking.user;
        const { title: eventTitle } = populatedBooking.event;
        const bookingTime = new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
        });

        // Send booking confirmation email
        await sendBookingEmail(userEmail, userName, eventTitle, bookingTime);

        // Respond with the booking details
        res.status(201).json({
            message: 'Booking successful',
            booking: {
                id: populatedBooking._id,
                eventTitle: populatedBooking.event.title,
                username: populatedBooking.user.name,
                email: populatedBooking.user.email,
                bookingTime: bookingTime
            }
        });
    } catch (error) {
        console.error('Error booking event:', error);
        res.status(500).json({ message: 'Error booking event', error });
    }
});



// Example for fetching bookings
app.get('/bookings', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;

        let bookings;

        if (userRole === 'admin') {
            bookings = await Booking.find()
                .populate('event', 'title')
                .populate('user', 'name email');
        } else if (userRole === 'organizer') {
            bookings = await Booking.find()
                .populate({
                    path: 'event',
                    match: { organizer: userId }, // Filter events to those organized by the logged-in user
                    select: 'title'
                })
                .populate('user', 'name email');
            // Filter out bookings where the event does not match the organizer
            bookings = bookings.filter(booking => booking.event);
        } else if (userRole === 'user') {
            bookings = await Booking.find({ user: userId })
                .populate('event', 'title')
                .populate('user', 'name email');
        } else {
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error.message);
        res.status(500).json({ message: 'Error fetching bookings', error: error.message });
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
