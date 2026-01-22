// User Model - Stores participant data

class User {
  constructor(socketId, userName, language, speakingLanguage) {
    this.socketId = socketId;
    this.userName = userName;
    this.language = language; // Language they want to receive
    this.speakingLanguage = speakingLanguage; // Language they speak
    this.joinedAt = new Date();
  }

  toJSON() {
    return {
      socketId: this.socketId,
      userName: this.userName,
      language: this.language,
      speakingLanguage: this.speakingLanguage,
      joinedAt: this.joinedAt
    };
  }
}

module.exports = User;
