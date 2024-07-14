const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PORT = 3000;

// Store pending vibrations
const pendingVibrations = new Map();

// Store active long-polling requests
const activePolls = new Map();

// Send vibration
app.post('/vibrate', (req, res) => {
    const { senderId, receiverId } = req.body;
    
    if (activePolls.has(receiverId)) {
        // If receiver has an active poll, send vibration immediately
        const receiverRes = activePolls.get(receiverId);
        receiverRes.json({ vibrate: true, from: senderId });
        activePolls.delete(receiverId);
    } else {
        // Otherwise, store the vibration for later
        pendingVibrations.set(receiverId, senderId);
    }
    
    res.status(200).json({ message: 'Vibration sent' });
});

// Long-polling endpoint
app.get('/poll/:userId', (req, res) => {
    const userId = req.params.userId;
    
    if (pendingVibrations.has(userId)) {
        // If there's a pending vibration, send it immediately
        const senderId = pendingVibrations.get(userId);
        pendingVibrations.delete(userId);
        res.json({ vibrate: true, from: senderId });
    } else {
        // Otherwise, hold the connection
        const timeout = setTimeout(() => {
            activePolls.delete(userId);
            res.status(204).end();
        }, 30000); // 30-second timeout
        
        activePolls.set(userId, res);
        
        // Clean up if client disconnects
        req.on('close', () => {
            clearTimeout(timeout);
            activePolls.delete(userId);
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});