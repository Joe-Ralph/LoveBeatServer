const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PORT = 3000;

// Store pending vibrations
const pendingVibrations = new Map();

// Store active long-polling requests
const activePolls = new Map();

const pairData = new Map();

app.post('/pair', (req, res) => {
    const { senderId, receiverId, senderPairId, receiverPairId } = req.body;
    if (activePolls.has(senderPairId)) {
        const senderPairIdRes = activePolls.get(senderPairId)
        senderPairIdRes.json({ myUuid: senderId, partnerUuid: receiverId })
        activePolls.delete(senderPairId)
    } else {
        pairData.set(senderPairId, { myUuid: senderId, partnerUuid: receiverId })
    }

    if (activePolls.has(receiverPairId)) {
        const receiverPairIdRes = activePolls.get(receiverPairId)
        receiverPairIdRes.json({ myUuid: receiverId, partnerUuid: senderId })
        activePolls.delete(receiverPairId)
    } else {
        pairData.set(receiverPairId, { myUuid: receiverId, partnerUuid: senderId })
    }
    res.status(200).json({ message: 'Pair Config Added' });
})


// Send vibration
app.post('/vibrate', (req, res) => {
    const { senderId, receiverId } = req.body;
    console.log(`recieved vibration from ${senderId} to ${receiverId}`);

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


// Pair Polling Endpoint
app.get('/pair/:userId', (req, res) => {
    const userId = req.params.userId;

    if (pairData.has(userId)) {
        const sendData = pairData.get(userId);
        pairData.delete(userId);
        res.json(sendData);
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


// Serve static files from the 'public' directory
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});