# Video Translation Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `GOOGLE_TRANSLATE_API_KEY`: Your Google Translate API key

## API Endpoints

- `GET /health` - Health check
- `POST /translate` - Translate text
  - Body: `{ text, targetLanguage, sourceLanguage }`

## WebSocket Events

### Client to Server:
- `join-room` - Join a video room
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate
- `transcription` - Send transcribed text for translation

### Server to Client:
- `user-joined` - New user joined
- `existing-users` - List of users in room
- `user-left` - User left
- `offer` - WebRTC offer from peer
- `answer` - WebRTC answer from peer
- `ice-candidate` - ICE candidate from peer
- `translated-text` - Translated transcription
