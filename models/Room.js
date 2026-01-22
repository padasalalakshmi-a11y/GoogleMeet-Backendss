// Room Model - Stores meeting room data

class Room {
  constructor(roomCode, createdBy = 'anonymous') {
    this.roomCode = roomCode;
    this.createdAt = new Date();
    this.createdBy = createdBy;
    this.participants = new Map(); // userId -> participant data
    this.active = true;
  }

  addParticipant(userId, userData) {
    this.participants.set(userId, {
      userId,
      userName: userData.userName,
      language: userData.language,
      speakingLanguage: userData.speakingLanguage,
      joinedAt: new Date()
    });
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  getParticipant(userId) {
    return this.participants.get(userId);
  }

  getAllParticipants() {
    return Array.from(this.participants.values());
  }

  getParticipantCount() {
    return this.participants.size;
  }

  isEmpty() {
    return this.participants.size === 0;
  }

  toJSON() {
    return {
      roomCode: this.roomCode,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      participantCount: this.getParticipantCount(),
      participants: this.getAllParticipants(),
      active: this.active
    };
  }
}

module.exports = Room;
