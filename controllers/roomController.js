// Room Controller - Handles room operations with Sequelize

const { RoomModel, ParticipantModel } = require('../models');
const { generateRoomCode, isValidRoomCode } = require('../utils/roomCodeGenerator');

class RoomController {
  // Create a new room
  async createRoom(req, res) {
    try {
      const roomCode = generateRoomCode();
      
      const room = await RoomModel.create({
        roomCode,
        createdBy: req.body.createdBy || 'anonymous',
        active: true,
        participantCount: 0
      });
      
      console.log(`✅ Room created in database: ${roomCode}`);
      
      res.status(201).json({
        success: true,
        roomCode: room.roomCode,
        roomUrl: `/meet/${room.roomCode}`,
        message: 'Room created successfully'
      });
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create room',
        error: error.message
      });
    }
  }

  // Get room information
  async getRoom(req, res) {
    try {
      const { roomCode } = req.params;
      
      if (!isValidRoomCode(roomCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid room code format'
        });
      }

      const room = await RoomModel.findByRoomCode(roomCode);
      
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      // Get participants
      const participants = await ParticipantModel.findByRoomId(room.id);

      res.json({
        success: true,
        room: {
          roomCode: room.roomCode,
          createdAt: room.createdAt,
          active: room.active,
          participantCount: participants.length,
          participants: participants.map(p => ({
            userName: p.userName,
            language: p.language,
            speakingLanguage: p.speakingLanguage,
            joinedAt: p.joinedAt
          }))
        }
      });
    } catch (error) {
      console.error('Error getting room:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get room information'
      });
    }
  }

  // Check if room exists
  async roomExists(req, res) {
    try {
      const { roomCode } = req.params;
      
      if (!isValidRoomCode(roomCode)) {
        return res.json({
          exists: false,
          message: 'Invalid room code format'
        });
      }

      const room = await RoomModel.findByRoomCode(roomCode);
      
      res.json({
        exists: !!room && room.active,
        roomCode,
        active: room ? room.active : false
      });
    } catch (error) {
      console.error('Error checking room:', error);
      res.status(500).json({
        exists: false,
        message: 'Error checking room'
      });
    }
  }

  // Get all active rooms
  async getAllRooms(req, res) {
    try {
      const rooms = await RoomModel.findActiveRooms();
      
      res.json({
        success: true,
        count: rooms.length,
        rooms: rooms.map(room => ({
          roomCode: room.roomCode,
          createdAt: room.createdAt,
          participantCount: room.participantCount,
          lastActivity: room.lastActivity
        }))
      });
    } catch (error) {
      console.error('Error getting all rooms:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rooms'
      });
    }
  }

  // Clean up inactive rooms
  async cleanupInactiveRooms() {
    try {
      const cleaned = await RoomModel.cleanupInactiveRooms(24); // 24 hours
      if (cleaned > 0) {
        console.log(`🗑️ Cleaned up ${cleaned} inactive rooms`);
      }
    } catch (error) {
      console.error('Error cleaning up rooms:', error);
    }
  }
}

module.exports = new RoomController();
