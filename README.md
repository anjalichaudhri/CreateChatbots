# Advanced Healthcare Chatbot Application

A powerful, enterprise-grade healthcare chatbot with advanced NLP, real-time analytics, medication interaction checking, intelligent triage, and comprehensive medical knowledge base.

## 🚀 Powerful Features

### Core Capabilities
- 🧠 **Advanced Conversation Memory**: Maintains context across multiple messages with intelligent session management
- 🎯 **Intelligent Intent Detection**: Advanced NLP with confidence scoring to understand user queries
- 📚 **Comprehensive Medical Knowledge Base**: Built-in database of symptoms, specialties, wellness, medications, and triage protocols
- 🔍 **Advanced Symptom Assessment**: Multi-turn conversations with intelligent follow-up questions
- 💡 **Context-Aware Responses**: Remembers conversation history and provides personalized follow-ups
- ⚡ **Quick Action Buttons**: Interactive buttons for common actions (Schedule Appointment, Find Doctor, etc.)
- 📅 **Advanced Appointment Booking Flow**: Multi-step guided appointment booking with context-aware follow-up questions
- 🔄 **Session Management**: Persistent conversations with localStorage integration
- 📊 **Conversation History**: Track and retrieve past conversations

### 🎯 Advanced NLP & AI Features
- **Sentiment Analysis**: Detects user emotional state (positive, negative, neutral) for empathetic responses
- **Entity Extraction**: Automatically extracts medications, symptoms, body parts, numbers, and time expressions
- **Intent Classification**: 9+ intent types with confidence scoring
- **Contextual Understanding**: Maintains conversation context and references previous messages

### 🏥 Medical Intelligence
- **Advanced Symptom Triage**: 4-level priority system (Emergency, Urgent, Moderate, Routine) with automatic routing
- **Medication Interaction Checking**: Real-time detection of potential drug interactions with warnings
- **Specialty Matching**: Intelligent matching of symptoms to appropriate medical specialties
- **Wellness Categorization**: Organized tips for nutrition, exercise, sleep, and mental health

### 📊 Analytics & Insights
- **Real-time Analytics**: Track conversations, intents, symptoms, and user patterns
- **Admin Dashboard**: Comprehensive analytics API for system monitoring
- **User Profiles**: Track user medications, symptoms, and conversation history
- **Peak Hours Tracking**: Identify busiest times for resource planning
- **Emergency Detection**: Automatic tracking of emergency situations

### 🔒 Security & Performance
- **Rate Limiting**: Prevents abuse with configurable request limits (30 requests/minute)
- **Session Security**: Secure session management with unique IDs
- **Error Handling**: Comprehensive error handling and graceful degradation
- **Performance Optimization**: Efficient in-memory storage with cleanup mechanisms

### 💾 Data Management
- **Conversation Export**: Export full conversation history as JSON
- **Profile Management**: View and manage user health profiles
- **History Retrieval**: Access complete conversation history via API
- **Session Analytics**: Track session length, topics, and user engagement

### Healthcare Features
- 🏥 Healthcare-focused responses and medical information
- 💬 Real-time chat interface with typing indicators
- 🎨 Modern, medical-themed design with healthcare colors (blue/teal gradients)
- 📱 Mobile-friendly responsive layout
- 🚨 **Smart Emergency Detection**: Priority handling for emergency keywords
- 💊 Medication information support with safety reminders
- 📅 **Advanced Appointment Booking**: Multi-step guided flow (type → date → reason → summary) with quick action buttons at each step
- 📅 Appointment scheduling assistance with specialty matching
- 🌿 **Categorized Wellness Tips**: Nutrition, exercise, sleep, and mental health guidance
- 🏥 **Specialty Information**: Details about different medical specialties
- ⚠️ Medical disclaimers and safety warnings throughout

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

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

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

```
CreateChatbots/
├── server.js          # Express server and chatbot logic
├── package.json       # Dependencies and scripts
├── public/
│   ├── index.html    # Main HTML file
│   ├── style.css     # Styling
│   └── script.js     # Frontend JavaScript
└── README.md         # This file
```

## Advanced Healthcare Features

### Intelligent Symptom Assessment
The chatbot performs multi-turn symptom assessments:
- **Symptom Recognition**: Identifies common symptoms (headache, fever, cough, nausea, etc.)
- **Follow-up Questions**: Asks about duration, severity, and other symptoms
- **Contextual Recommendations**: Provides specific advice based on symptom type
- **Medical Knowledge Integration**: Uses built-in medical knowledge base for accurate information

### Conversation Intelligence
- **Intent Detection**: Recognizes 9+ different intents (emergency, symptoms, appointments, medications, wellness, etc.)
- **Context Memory**: Remembers what was discussed earlier in the conversation
- **Smart Follow-ups**: Asks relevant questions based on previous responses
- **Topic Tracking**: Maintains awareness of current conversation topic

### Medical Knowledge Base
Includes information about:
- **Common Symptoms**: Headache, fever, cough, nausea with descriptions and recommendations
- **Medical Specialties**: Cardiology, dermatology, neurology, orthopedics, pediatrics, psychiatry, etc.
- **Wellness Categories**: Nutrition, exercise, sleep, and mental health tips
- **Safety Protocols**: Emergency detection and appropriate routing

### Quick Actions
Interactive buttons appear based on context:
- Schedule Appointment
- Find Doctor/Specialist
- More Information
- Call 911 (for emergencies)
- Wellness Tips
- And more context-specific actions

## Important Medical Disclaimer

⚠️ **This chatbot provides general health information only and is NOT a replacement for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions regarding medical conditions. For medical emergencies, call 911 immediately.**

## API Endpoints

### POST `/api/chat`
Send a message to the chatbot with advanced features.

**Request:**
```json
{
  "message": "I have a headache",
  "sessionId": "session_1234567890_abc123" // Optional
}
```

**Response:**
```json
{
  "response": "I understand you're experiencing headache...",
  "quickActions": ["Schedule Appointment", "Find Doctor", "More Info"],
  "sessionId": "session_1234567890_abc123",
  "triage": {
    "triageLevel": "moderate",
    "priority": 3,
    "action": "Schedule appointment within 24-48 hours",
    "urgency": "MEDIUM"
  },
  "entities": {
    "medications": [],
    "symptoms": ["headache"],
    "bodyParts": [],
    "numbers": [],
    "timeExpressions": []
  },
  "sentiment": "negative",
  "conversationLength": 5
}
```

### GET `/api/history/:sessionId`
Retrieve complete conversation history for a session.

### POST `/api/clear-session`
Clear a session's conversation history.

### GET `/api/export/:sessionId`
Export conversation as JSON file with full metadata.

**Response:** JSON file download with:
- Complete conversation history
- User profile information
- Conversation summary and statistics
- Extracted entities and topics

### GET `/api/profile/:sessionId`
Get user profile and conversation statistics.

**Response:**
```json
{
  "sessionId": "session_123",
  "userInfo": {
    "medications": ["aspirin", "ibuprofen"],
    "symptoms": ["headache", "fever"]
  },
  "conversationStats": {
    "totalMessages": 10,
    "topics": ["symptom", "medication"],
    "symptoms": ["headache", "fever"],
    "medications": ["aspirin", "ibuprofen"]
  }
}
```

### GET `/api/admin/analytics`
Get comprehensive system analytics (Admin only).

**Response:**
```json
{
  "totalConversations": 150,
  "totalMessages": 1250,
  "intentDistribution": {
    "symptom": 450,
    "appointment": 300,
    "medication": 200
  },
  "symptomFrequency": {
    "headache": 120,
    "fever": 80
  },
  "emergencyCount": 15,
  "averageSessionLength": "8.5",
  "peakHours": {
    "9": 45,
    "14": 60
  },
  "activeSessions": 12,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET `/api/admin/sessions`
Get list of all active sessions (Admin only).

## Customization

### Adding to Medical Knowledge Base

Edit the `medicalKnowledge` object in `server.js`:

```javascript
const medicalKnowledge = {
  commonSymptoms: {
    yourSymptom: {
      description: "Description of symptom",
      severity: "moderate",
      recommendations: ["Tip 1", "Tip 2", "See doctor"]
    }
  },
  specialties: {
    yourSpecialty: "Description of specialty"
  },
  wellnessTips: {
    yourCategory: ["Tip 1", "Tip 2", "Tip 3"]
  },
  medicationInteractions: {
    'yourMedication': {
      interactions: ['otherMed1', 'otherMed2'],
      warnings: 'Warning message about interactions'
    }
  },
  triageLevels: {
    yourLevel: {
      keywords: ['keyword1', 'keyword2'],
      priority: 2,
      action: 'Recommended action'
    }
  }
};
```

### Configuring Rate Limiting

Adjust rate limits in `server.js`:

```javascript
const RATE_LIMIT_WINDOW = 60000; // Time window in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window
```

### Adding New Intents

Extend the `detectIntent` function in `server.js` to recognize new patterns:

```javascript
const intents = {
  yourIntent: /\b(your|keywords|here)\b/,
  // ... existing intents
};
```

### Styling

Modify `public/style.css` to change colors, fonts, or layout. The current theme uses medical blue/teal gradients. Quick action buttons can be customized in the `.quick-action-btn` class.

### Extending Functionality

- **AI Integration**: Add OpenAI, Anthropic, or other AI APIs for more natural responses
- **EHR Integration**: Connect to Electronic Health Records systems
- **Appointment APIs**: Integrate with scheduling systems (Calendly, etc.)
- **Medication Databases**: Connect to drug interaction databases
- **Telemedicine**: Integrate with video consultation platforms
- **Multi-language**: Add translation support for diverse populations
- **Voice Input**: Add speech-to-text capabilities
- **Analytics**: Track conversation patterns and user needs

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Styling**: Modern CSS with healthcare-themed gradients and animations
- **Session Management**: In-memory session storage with localStorage persistence
- **NLP**: Advanced pattern matching, sentiment analysis, and entity extraction
- **Medical Focus**: Intelligent healthcare response system with triage, medication checking, and safety protocols
- **Analytics**: Real-time tracking and insights
- **Security**: Rate limiting and session management

## Key Algorithms

### Triage System
The chatbot uses a 4-level priority system:
1. **Emergency** (Priority 1): Life-threatening conditions → Call 911
2. **Urgent** (Priority 2): Serious but not immediately life-threatening → Emergency/Urgent care
3. **Moderate** (Priority 3): Needs attention but not urgent → Schedule within 24-48 hours
4. **Routine** (Priority 4): Non-urgent → Schedule routine appointment

### Sentiment Analysis
Simple but effective sentiment detection using positive/negative word matching to provide empathetic responses.

### Entity Extraction
Pattern-based extraction of:
- Medications (from knowledge base)
- Symptoms (from knowledge base)
- Body parts
- Numbers and measurements
- Time expressions (duration)

### Medication Interaction Checking
Real-time checking against interaction database with warnings for potential drug interactions.

## Architecture

### Session Management
- Sessions are stored in-memory (Map data structure)
- Session IDs are generated client-side and stored in localStorage
- Conversation history is maintained per session
- Context tracking includes: current topic, asked questions, user info

### Response Generation Flow
1. **Intent Detection**: Analyzes user message to determine intent
2. **Context Retrieval**: Loads conversation history and context
3. **Knowledge Base Lookup**: Searches medical knowledge base if applicable
4. **Response Generation**: Creates context-aware response with follow-ups
5. **Quick Actions**: Generates relevant action buttons
6. **Session Update**: Saves conversation to session storage

## License

MIT

## Contributing

Feel free to fork, modify, and use this project for your own needs!

