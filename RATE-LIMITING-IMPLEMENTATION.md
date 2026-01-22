# Rate Limiting Implementation Guide

## 🎯 What is Rate Limiting?

Rate limiting controls how many requests a user can make in a time period.

**Example:**
- User can make 100 API calls per 15 minutes
- If they exceed, they get error: "Too many requests"

## 🛡️ Why You Need It

1. **Prevent Abuse** - Stop spam and attacks
2. **Save Money** - Limit translation API costs
3. **Fair Usage** - Ensure all users get service
4. **Server Protection** - Prevent overload

## 📦 Installation

```bash
cd backend
npm install express-rate-limit
```

## 🔧 Implementation

### Step 1: Create Rate Limiter Middleware

Create file: `backend/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit')

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict limiter for room creation
const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 rooms per hour
  message: {
    error: 'Too many rooms created. Please wait before creating more.',
    retryAfter: '1 hour'
  }
})

// Translation limiter (most important for cost control)
const translationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 translations per minute
  message: {
    error: 'Translation rate limit exceeded. Please slow down.',
    retryAfter: '1 minute'
  }
})

module.exports = {
  apiLimiter,
  roomCreationLimiter,
  translationLimiter
}
```

### Step 2: Apply to Routes

Update `backend/server-new.js`:

```javascript
const { apiLimiter, roomCreationLimiter } = require('./middleware/rateLimiter')

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter)

// Apply strict limiting to room creation
app.use('/api/rooms/create', roomCreationLimiter)
```

### Step 3: Apply to Socket.io Events

Add to your socket.io handlers:

```javascript
// Track translation requests per socket
const translationCounts = new Map()

socket.on('transcription', async ({ roomCode, text, language }) => {
  const socketId = socket.id
  const now = Date.now()
  
  // Get or initialize count
  if (!translationCounts.has(socketId)) {
    translationCounts.set(socketId, { count: 0, resetTime: now + 60000 })
  }
  
  const userLimit = translationCounts.get(socketId)
  
  // Reset if time window passed
  if (now > userLimit.resetTime) {
    userLimit.count = 0
    userLimit.resetTime = now + 60000
  }
  
  // Check limit (20 per minute)
  if (userLimit.count >= 20) {
    socket.emit('error', {
      message: 'Translation rate limit exceeded. Please slow down.'
    })
    return
  }
  
  // Increment count
  userLimit.count++
  
  // Process translation...
  // Your existing translation code here
})
```

## 📊 Rate Limit Recommendations

### For Different User Levels:

```javascript
// Free Users
const freeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50 // 50 requests per 15 minutes
})

// Paid Users
const paidLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500 // 500 requests per 15 minutes
})

// Premium Users
const premiumLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000 // 5000 requests per 15 minutes
})
```

## 🎯 Specific Limits by Feature

### 1. Room Creation
```javascript
// Limit: 10 rooms per hour per IP
// Why: Prevent spam room creation
// Cost Impact: Low
```

### 2. Translation Requests
```javascript
// Limit: 20 translations per minute
// Why: Control API costs
// Cost Impact: HIGH - This is your main cost
```

### 3. Room Joining
```javascript
// Limit: 50 joins per hour
// Why: Prevent abuse
// Cost Impact: Low
```

### 4. Video Connections
```javascript
// Limit: 10 concurrent connections per user
// Why: Bandwidth control
// Cost Impact: Medium
```

## 💰 Cost Savings Example

### Without Rate Limiting:
- Malicious user makes 10,000 translation requests
- Cost: 10,000 × 500 chars = 5M characters
- **Cost: $100** 😱

### With Rate Limiting:
- User limited to 20 requests/minute
- Max in 1 hour: 1,200 requests
- Cost: 1,200 × 500 chars = 600K characters
- **Cost: $12** ✅
- **Savings: $88** 💰

## 🔍 Monitoring Rate Limits

### Add Logging:

```javascript
const rateLimit = require('express-rate-limit')

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    console.log(`⚠️ Rate limit exceeded: ${req.ip}`)
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: '15 minutes'
    })
  }
})
```

### Track Violations:

```javascript
// Store in database
const RateLimitViolation = require('./models/RateLimitViolation')

handler: async (req, res) => {
  await RateLimitViolation.create({
    ip: req.ip,
    endpoint: req.path,
    timestamp: new Date()
  })
  
  res.status(429).json({ error: 'Too many requests' })
}
```

## 🎨 User-Friendly Error Messages

### Frontend Handling:

```javascript
// In your React components
try {
  const response = await fetch('/api/rooms/create', {
    method: 'POST',
    body: JSON.stringify({ roomCode })
  })
  
  if (response.status === 429) {
    const data = await response.json()
    alert(`Please wait ${data.retryAfter} before trying again`)
    return
  }
  
  // Handle success
} catch (error) {
  console.error('Error:', error)
}
```

## 📈 Scaling Rate Limits

### As Your App Grows:

**0-100 users:**
```javascript
max: 50 // Conservative
```

**100-1,000 users:**
```javascript
max: 100 // Moderate
```

**1,000-10,000 users:**
```javascript
max: 200 // Liberal
// Add Redis for distributed rate limiting
```

**10,000+ users:**
```javascript
// Use Redis with clustering
const RedisStore = require('rate-limit-redis')
const redis = require('redis')

const limiter = rateLimit({
  store: new RedisStore({
    client: redis.createClient()
  }),
  max: 500
})
```

## ✅ Implementation Checklist

- [ ] Install express-rate-limit
- [ ] Create rateLimiter.js middleware
- [ ] Apply to API routes
- [ ] Apply to room creation
- [ ] Apply to translation (most important!)
- [ ] Add logging
- [ ] Test limits
- [ ] Add user-friendly error messages
- [ ] Monitor violations
- [ ] Adjust limits based on usage

## 🎯 Quick Start

### Minimal Implementation (5 minutes):

```javascript
// backend/server-new.js
const rateLimit = require('express-rate-limit')

// Add this before your routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 minutes
})

app.use('/api/', limiter)
```

That's it! You now have basic rate limiting.

## 📊 Testing Rate Limits

```bash
# Test with curl
for i in {1..101}; do
  curl http://localhost:3000/api/rooms
done

# After 100 requests, you should get:
# {"error": "Too many requests"}
```

## 🎉 Summary

Rate limiting is:
- ✅ Easy to implement (5 minutes)
- ✅ Saves money (prevents abuse)
- ✅ Protects server (prevents overload)
- ✅ Industry standard (all apps use it)

**Implement it NOW before going to production!** 🚀
