require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Track users
const users = new Map();

io.on('connection', async (socket) => {
    // Send history
    const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
    socket.emit('message history', messages);

    // Handle new user
    socket.on('new user', (username) => {
        users.set(socket.id, username);
        socket.broadcast.emit('user notification', `${username} joined the chat`);
        io.emit('online users', Array.from(users.values()));
    });

    // Handle messages
    socket.on('chat message', async ({ username, text }) => {
        const msg = new Message({ username, text });
        await msg.save();
        io.emit('chat message', msg);
    });

    // Typing events
    socket.on('typing', (username) => {
        socket.broadcast.emit('show typing', username);
    });

    socket.on('stop typing', () => {
        socket.broadcast.emit('hide typing');
    });

    // Disconnect
    socket.on('disconnect', () => {
        const username = users.get(socket.id) || 'A user';
        users.delete(socket.id);
        socket.broadcast.emit('user notification', `${username} left the chat`);
        io.emit('online users', Array.from(users.values()));
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
