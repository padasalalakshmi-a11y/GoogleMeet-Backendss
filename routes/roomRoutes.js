// Room Routes

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { validateRoomCode } = require('../middleware/validation');
const { roomCreationLimiter } = require('../middleware/rateLimiter');

// Create new room (with rate limiting)
router.post('/create', roomCreationLimiter, roomController.createRoom.bind(roomController));

// Get room information
router.get('/:roomCode', validateRoomCode, roomController.getRoom.bind(roomController));

// Check if room exists
router.get('/:roomCode/exists', validateRoomCode, roomController.roomExists.bind(roomController));

// Get all rooms (for debugging)
router.get('/', roomController.getAllRooms.bind(roomController));

module.exports = router;
