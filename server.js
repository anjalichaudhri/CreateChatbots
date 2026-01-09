const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Import new modules
const database = require('./database');
const aiService = require('./ai-service');
const { generateConversationPDF } = require('./pdf-generator');

// Cache for frequently accessed data (5 minute TTL)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for development
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Session storage for conversation memory (in-memory cache, synced with DB)
const sessions = new Map();

// Sync in-memory sessions with database on startup
function syncSessionsFromDB() {
  const dbSessions = database.getAllSessions();
  dbSessions.forEach(dbSession => {
    const messages = database.getMessages(dbSession.session_id);
    sessions.set(dbSession.session_id, {
      conversationHistory: messages.map(msg => ({
        role: msg.role,
        message: msg.message,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        entities: msg.entities,
        sentiment: msg.sentiment
      })),
      currentTopic: dbSession.metadata.currentTopic || null,
      askedDuration: dbSession.metadata.askedDuration || false,
      askedSeverity: dbSession.metadata.askedSeverity || false,
      askedOtherSymptoms: dbSession.metadata.askedOtherSymptoms || false,
      userInfo: dbSession.userInfo || {},
      medications: dbSession.userInfo.medications || [],
      symptoms: dbSession.userInfo.symptoms || [],
      createdAt: new Date(dbSession.created_at)
    });
  });
  console.log(`✅ Synced ${sessions.size} sessions from database`);
}

// Initialize database sync
syncSessionsFromDB();

// Analytics storage
const analytics = {
  totalConversations: 0,
  totalMessages: 0,
  intentDistribution: {},
  symptomFrequency: {},
  emergencyCount: 0,
  averageSessionLength: 0,
  peakHours: {},
  userSatisfaction: []
};

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

// Medical knowledge base
const medicalKnowledge = {
  commonSymptoms: {
    headache: {
      description: "Headaches can be caused by tension, migraines, dehydration, or other factors.",
      severity: "moderate",
      recommendations: ["Stay hydrated", "Rest in a quiet, dark room", "Consider over-the-counter pain relief if appropriate", "See a doctor if severe or persistent"]
    },
    fever: {
      description: "Fever is usually a sign of infection. Normal body temperature is around 98.6°F (37°C).",
      severity: "moderate",
      recommendations: ["Rest and stay hydrated", "Monitor temperature regularly", "Use fever-reducing medication if appropriate", "Seek medical care if fever is high (>103°F) or persists"]
    },
    cough: {
      description: "Coughs can be dry or productive, and may indicate respiratory issues.",
      severity: "mild",
      recommendations: ["Stay hydrated", "Use a humidifier", "Avoid irritants like smoke", "See a doctor if persistent or accompanied by other symptoms"]
    },
    nausea: {
      description: "Nausea can be caused by various factors including infections, medications, or digestive issues.",
      severity: "moderate",
      recommendations: ["Stay hydrated with small sips", "Avoid heavy or spicy foods", "Rest", "Seek care if severe or persistent"]
    }
  },
  specialties: {
    cardiology: "Heart and cardiovascular system",
    dermatology: "Skin conditions",
    endocrinology: "Hormones and metabolism",
    gastroenterology: "Digestive system",
    neurology: "Nervous system and brain",
    orthopedics: "Bones, joints, and muscles",
    pediatrics: "Children's health",
    psychiatry: "Mental health"
  },
  wellnessTips: {
    nutrition: ["Eat a balanced diet with fruits and vegetables", "Stay hydrated (8 glasses of water daily)", "Limit processed foods", "Control portion sizes"],
    exercise: ["Aim for 150 minutes of moderate exercise per week", "Include strength training 2x per week", "Stay active throughout the day", "Find activities you enjoy"],
    sleep: ["Aim for 7-9 hours of sleep per night", "Maintain a regular sleep schedule", "Create a relaxing bedtime routine", "Avoid screens before bed"],
    mental: ["Practice stress management techniques", "Stay connected with friends and family", "Take breaks when needed", "Consider meditation or mindfulness"]
  },
  medicationInteractions: {
    'aspirin': {
      interactions: ['warfarin', 'ibuprofen', 'naproxen'],
      warnings: 'May increase bleeding risk when combined with blood thinners'
    },
    'ibuprofen': {
      interactions: ['aspirin', 'warfarin', 'lithium'],
      warnings: 'Can increase risk of stomach bleeding and kidney problems'
    },
    'warfarin': {
      interactions: ['aspirin', 'ibuprofen', 'vitamin k'],
      warnings: 'Many medications and foods can affect blood thinning levels'
    }
  },
  triageLevels: {
    emergency: {
      keywords: ['chest pain', 'can\'t breathe', 'unconscious', 'severe bleeding', 'heart attack', 'stroke'],
      priority: 1,
      action: 'Call 911 immediately'
    },
    urgent: {
      keywords: ['high fever', 'severe pain', 'difficulty breathing', 'persistent vomiting'],
      priority: 2,
      action: 'Seek emergency care or urgent care within hours'
    },
    moderate: {
      keywords: ['moderate pain', 'fever', 'persistent symptoms'],
      priority: 3,
      action: 'Schedule appointment within 24-48 hours'
    },
    routine: {
      keywords: ['mild symptoms', 'wellness', 'preventive'],
      priority: 4,
      action: 'Schedule routine appointment'
    }
  }
};

// Healthcare chatbot responses
const chatbotResponses = {
  greeting: [
    "Hello! I'm your healthcare assistant. How can I help you with your health concerns today?",
    "Hi there! I'm here to assist with your healthcare needs. What can I help you with?",
    "Welcome! I'm your medical assistant. How may I assist you today?",
    "Hello! I'm here to help with your health questions. What would you like to know?"
  ],
  goodbye: [
    "Take care of yourself! Remember to consult a healthcare professional for serious concerns.",
    "Stay healthy! Don't hesitate to reach out if you have more questions.",
    "Goodbye! Wishing you good health. Please consult a doctor for medical emergencies.",
    "Take care! For urgent medical issues, please contact emergency services immediately."
  ],
  help: [
    "I can help you with: general health information, symptom guidance, appointment scheduling, medication reminders, wellness tips, and answering health-related questions. However, I'm not a replacement for professional medical advice. For serious symptoms or emergencies, please consult a healthcare provider immediately.",
    "I assist with healthcare information, symptoms, appointments, and general wellness. Please note: I provide general information only and cannot diagnose or treat. Always consult a qualified healthcare professional for medical advice.",
    "I'm here to provide general health information and guidance. I can help with symptoms, appointments, medications, and wellness. Important: For medical emergencies, call emergency services. For diagnosis and treatment, consult a healthcare provider."
  ],
  symptoms: [
    "I understand you're experiencing symptoms. While I can provide general information, it's important to consult with a healthcare professional for proper diagnosis. Can you tell me more about when these symptoms started?",
    "Thank you for sharing your symptoms. For accurate diagnosis and treatment, I recommend scheduling an appointment with a healthcare provider. Would you like help finding a doctor?",
    "I hear your concern about these symptoms. For your safety, please consult a healthcare professional. If symptoms are severe or life-threatening, seek emergency care immediately."
  ],
  appointment: [
    "I can help you schedule an appointment! You can book through our online portal or call our scheduling line at (555) 123-4567. What type of appointment do you need?",
    "To schedule an appointment, you can visit our website, use our mobile app, or call us. What specialty or type of care are you looking for?",
    "I'd be happy to help you schedule an appointment. You can book online 24/7 or call our office during business hours. What date works best for you?"
  ],
  medication: [
    "For medication questions, it's best to consult with your pharmacist or prescribing doctor. They can provide specific information about dosages, interactions, and side effects. Is there a specific medication you're asking about?",
    "I can provide general medication information, but for specific questions about your prescriptions, please contact your healthcare provider or pharmacist. They have access to your medical history and can give personalized advice.",
    "Medication safety is important. For questions about your medications, side effects, or interactions, please speak with your doctor or pharmacist directly."
  ],
  emergency: [
    "If you're experiencing a medical emergency, please call 911 or go to your nearest emergency room immediately. This chatbot cannot provide emergency medical assistance.",
    "For life-threatening emergencies, call 911 right away. Do not wait. This includes chest pain, difficulty breathing, severe injuries, or loss of consciousness.",
    "URGENT: If this is a medical emergency, please hang up and call 911 immediately. This service is for non-emergency health information only."
  ],
  wellness: [
    "Great question about wellness! Some general tips: stay hydrated, get regular exercise, maintain a balanced diet, get adequate sleep (7-9 hours), and manage stress. Would you like more specific wellness advice?",
    "Wellness is important for overall health. Key areas include: nutrition, physical activity, mental health, sleep, and preventive care. What aspect of wellness would you like to focus on?",
    "I'm glad you're thinking about wellness! Regular check-ups, healthy eating, exercise, and stress management are all important. Is there a specific wellness goal you're working toward?"
  ],
  default: [
    "I understand your concern. For accurate medical information, I recommend consulting with a healthcare professional. Is there a specific health topic I can help you learn more about?",
    "Thank you for sharing. I can provide general health information, but for personalized medical advice, please consult your healthcare provider. What would you like to know more about?",
    "I'm here to help with general health information. For specific medical concerns, diagnosis, or treatment, please see a qualified healthcare professional. How else can I assist you?"
  ]
};

// Advanced NLP: Sentiment Analysis
function analyzeSentiment(message) {
  const msg = message.toLowerCase();
  const positiveWords = ['good', 'great', 'better', 'improving', 'fine', 'ok', 'okay', 'well', 'thanks', 'thank you'];
  const negativeWords = ['bad', 'worse', 'terrible', 'awful', 'pain', 'hurt', 'sick', 'worried', 'concerned', 'scared'];
  
  let score = 0;
  positiveWords.forEach(word => { if (msg.includes(word)) score++; });
  negativeWords.forEach(word => { if (msg.includes(word)) score--; });
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

// Advanced NLP: Entity Extraction
function extractEntities(message) {
  const entities = {
    medications: [],
    symptoms: [],
    bodyParts: [],
    numbers: [],
    timeExpressions: []
  };
  
  const msg = message.toLowerCase();
  
  // Extract medications
  const medicationPatterns = ['aspirin', 'ibuprofen', 'tylenol', 'advil', 'warfarin', 'metformin', 'insulin'];
  medicationPatterns.forEach(med => {
    if (msg.includes(med)) entities.medications.push(med);
  });
  
  // Extract body parts
  const bodyParts = ['head', 'chest', 'stomach', 'back', 'arm', 'leg', 'throat', 'ear', 'eye', 'nose'];
  bodyParts.forEach(part => {
    if (msg.includes(part)) entities.bodyParts.push(part);
  });
  
  // Extract numbers
  const numbers = message.match(/\b\d+\b/g);
  if (numbers) entities.numbers = numbers.map(n => parseInt(n));
  
  // Extract time expressions
  const timePatterns = message.match(/\b(\d+)\s*(day|days|hour|hours|week|weeks|month|months|year|years)\b/gi);
  if (timePatterns) entities.timeExpressions = timePatterns;
  
  return entities;
}

// Advanced intent detection with confidence scoring
function detectIntent(message, context) {
  const msg = message.toLowerCase().trim();
  const intents = {
    emergency: /\b(emergency|chest pain|can't breathe|difficulty breathing|severe pain|heart attack|stroke|unconscious|bleeding|poison|overdose|suicide|self harm|crushing|pressure|sudden)\b/,
    greeting: /\b(hi|hello|hey|greetings|good morning|good afternoon|good evening|what's up)\b/,
    goodbye: /\b(bye|goodbye|see you|farewell|exit|quit|thanks|thank you|appreciate)\b/,
    help: /\b(help|what can you do|how can you help|assist|capabilities|features)\b/,
    symptom: /\b(symptom|pain|ache|hurt|fever|nausea|dizzy|headache|stomach|feeling|unwell|sick|illness|disease|condition|tired|fatigue|weak|sore)\b/,
    appointment: /\b(appointment|schedule|book|visit|see doctor|see a doctor|consultation|checkup|exam|available|when|book now|check availability|find doctor)\b/,
    medication: /\b(medication|medicine|drug|pill|prescription|dosage|side effect|interaction|pharmacy|take|taking)\b/,
    wellness: /\b(wellness|healthy|diet|exercise|fitness|nutrition|sleep|stress|mental health|prevention|preventive|weight|fitness)\b/,
    specialty: /\b(cardiologist|dermatologist|neurologist|orthopedic|pediatrician|psychiatrist|specialist|specialty)\b/,
    triage: /\b(urgent|emergency|severe|mild|moderate|how bad|how serious|priority)\b/
  };
  
  const matches = [];
  for (const [intent, pattern] of Object.entries(intents)) {
    const match = pattern.test(msg);
    if (match) {
      matches.push({ intent, confidence: 1.0 });
    }
  }
  
  if (matches.length > 0) {
    // Return highest confidence intent
    return matches[0].intent;
  }
  
  return 'general';
}

// Advanced Symptom Triage System
function performTriage(message, symptomInfo) {
  const msg = message.toLowerCase();
  let triageLevel = 'routine';
  let priority = 4;
  let action = 'Schedule routine appointment';
  
  // Check emergency keywords
  for (const keyword of medicalKnowledge.triageLevels.emergency.keywords) {
    if (msg.includes(keyword)) {
      triageLevel = 'emergency';
      priority = 1;
      action = medicalKnowledge.triageLevels.emergency.action;
      analytics.emergencyCount++;
      return { triageLevel, priority, action, urgency: 'CRITICAL' };
    }
  }
  
  // Check urgent keywords
  for (const keyword of medicalKnowledge.triageLevels.urgent.keywords) {
    if (msg.includes(keyword)) {
      triageLevel = 'urgent';
      priority = 2;
      action = medicalKnowledge.triageLevels.urgent.action;
      return { triageLevel, priority, action, urgency: 'HIGH' };
    }
  }
  
  // Check severity indicators
  if (symptomInfo.severity) {
    if (['severe', 'intense', 'extreme'].includes(symptomInfo.severity.toLowerCase())) {
      triageLevel = 'urgent';
      priority = 2;
      action = medicalKnowledge.triageLevels.urgent.action;
      return { triageLevel, priority, action, urgency: 'HIGH' };
    }
    if (['moderate'].includes(symptomInfo.severity.toLowerCase())) {
      triageLevel = 'moderate';
      priority = 3;
      action = medicalKnowledge.triageLevels.moderate.action;
      return { triageLevel, priority, action, urgency: 'MEDIUM' };
    }
  }
  
  // Check duration
  if (symptomInfo.duration) {
    const durationMatch = symptomInfo.duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      if ((unit.includes('week') && num >= 2) || (unit.includes('month'))) {
        triageLevel = 'moderate';
        priority = 3;
        action = medicalKnowledge.triageLevels.moderate.action;
        return { triageLevel, priority, action, urgency: 'MEDIUM' };
      }
    }
  }
  
  return { triageLevel, priority, action, urgency: 'LOW' };
}

// Medication Interaction Checker
function checkMedicationInteractions(medications) {
  const interactions = [];
  const warnings = [];
  
  for (let i = 0; i < medications.length; i++) {
    const med1 = medications[i].toLowerCase();
    if (medicalKnowledge.medicationInteractions[med1]) {
      const medInfo = medicalKnowledge.medicationInteractions[med1];
      
      for (let j = i + 1; j < medications.length; j++) {
        const med2 = medications[j].toLowerCase();
        if (medInfo.interactions.includes(med2)) {
          interactions.push({
            medication1: med1,
            medication2: med2,
            warning: medInfo.warnings
          });
          warnings.push(`⚠️ Potential interaction between ${med1} and ${med2}: ${medInfo.warnings}`);
        }
      }
    }
  }
  
  return { interactions, warnings };
}

// Extract symptom information
function extractSymptomInfo(message) {
  const msg = message.toLowerCase();
  const symptoms = [];
  
  // Check for specific symptoms in knowledge base
  for (const symptom of Object.keys(medicalKnowledge.commonSymptoms)) {
    if (msg.includes(symptom)) {
      symptoms.push(symptom);
    }
  }
  
  // Extract duration if mentioned
  const durationMatch = message.match(/\b(\d+)\s*(day|days|hour|hours|week|weeks|month|months)\b/i);
  const duration = durationMatch ? `${durationMatch[1]} ${durationMatch[2]}` : null;
  
  // Extract severity indicators
  const severity = msg.match(/\b(severe|mild|moderate|intense|extreme|slight)\b/i)?.[1] || null;
  
  return { symptoms, duration, severity };
}

// Handle appointment booking flow with follow-up questions
function handleAppointmentFlow(message, context, sessionId) {
  const msg = message.toLowerCase();
  
  // Ensure sessionId is available
  if (!sessionId && context.sessionId) {
    sessionId = context.sessionId;
  }
  
  // Check if this is a booking trigger (not an answer)
  const bookingTriggers = ['book now', 'schedule appointment', 'book', 'schedule', 'check availability'];
  if (bookingTriggers.includes(msg) && !context.askedAppointmentType) {
    // User wants to book, start the flow
    context.askedAppointmentType = true;
    
    let response = chatbotResponses.appointment[Math.floor(Math.random() * chatbotResponses.appointment.length)];
    response += `\n\nWhat type of appointment are you looking for?`;
    
    const botMessage = { role: 'bot', message: response, timestamp: new Date() };
    context.conversationHistory.push(botMessage);
    database.saveMessage(sessionId, 'bot', response, 'appointment', null, null, null);
    database.updateSession(sessionId, context.userInfo, {
      currentTopic: 'appointment',
      askedAppointmentType: context.askedAppointmentType
    });
    sessions.set(sessionId, context);
    
    return {
      response: response,
      quickActions: ['General Checkup', 'Specialist Visit', 'Follow-up', 'Emergency']
    };
  }
  
  // Check if user is responding to appointment questions
  if (context.askedAppointmentType && !context.askedAppointmentDate) {
    // User provided appointment type, now ask for date
    // Don't treat booking triggers as appointment types
    if (!bookingTriggers.includes(msg)) {
      context.appointmentType = message; // Store the type
      context.askedAppointmentDate = true;
      
      let response = `Thank you! You're looking for a ${message} appointment. `;
      response += `What date would work best for you? You can say things like "tomorrow", "next week", or a specific date.`;
      
      const botMessage = { role: 'bot', message: response, timestamp: new Date() };
      context.conversationHistory.push(botMessage);
      database.saveMessage(sessionId, 'bot', response, 'appointment', null, null, null);
      database.updateSession(sessionId, context.userInfo, {
        currentTopic: 'appointment',
        askedAppointmentType: context.askedAppointmentType,
        askedAppointmentDate: context.askedAppointmentDate,
        askedAppointmentReason: context.askedAppointmentReason,
        appointmentType: context.appointmentType
      });
      sessions.set(sessionId, context);
      
      return {
        response: response,
        quickActions: ['Tomorrow', 'Next Week', 'This Week', 'Cancel']
      };
    }
    // If it's a booking trigger, restart the flow
    return null;
  }
  
  if (context.askedAppointmentDate && !context.askedAppointmentReason) {
    // User provided date, now ask for reason
    context.appointmentDate = message;
    context.askedAppointmentReason = true;
    
    let response = `Great! ${message} works. `;
    response += `What is the reason for your visit? (e.g., routine checkup, specific symptoms, follow-up)`;
    
    const botMessage = { role: 'bot', message: response, timestamp: new Date() };
    context.conversationHistory.push(botMessage);
    database.saveMessage(sessionId, 'bot', response, 'appointment', null, null, null);
    database.updateSession(sessionId, context.userInfo, {
      currentTopic: 'appointment',
      askedAppointmentType: context.askedAppointmentType,
      askedAppointmentDate: context.askedAppointmentDate,
      askedAppointmentReason: context.askedAppointmentReason,
      appointmentType: context.appointmentType,
      appointmentDate: context.appointmentDate
    });
    sessions.set(sessionId, context);
    
    return {
      response: response,
      quickActions: ['Routine Checkup', 'Follow-up', 'Symptoms', 'Other']
    };
  }
  
  if (context.askedAppointmentReason) {
    // User provided reason, complete booking
    context.appointmentReason = message;
    
    let response = `Perfect! I have your appointment details:\n\n`;
    response += `**Appointment Type:** ${context.appointmentType || 'General'}\n`;
    response += `**Preferred Date:** ${context.appointmentDate || 'Not specified'}\n`;
    response += `**Reason:** ${message}\n\n`;
    response += `To complete your booking, you can:\n`;
    response += `1. Call our scheduling line at (555) 123-4567\n`;
    response += `2. Visit our online portal at www.healthcareportal.com\n`;
    response += `3. Use our mobile app\n\n`;
    response += `Our team will confirm your appointment within 24 hours.`;
    
    const botMessage = { role: 'bot', message: response, timestamp: new Date() };
    context.conversationHistory.push(botMessage);
    database.saveMessage(sessionId, 'bot', response, 'appointment', null, null, null);
    
    // Reset appointment flow
    context.askedAppointmentType = false;
    context.askedAppointmentDate = false;
    context.askedAppointmentReason = false;
    context.appointmentType = null;
    context.appointmentDate = null;
    context.appointmentReason = null;
    
    database.updateSession(sessionId, context.userInfo, {
      currentTopic: 'appointment',
      askedAppointmentType: false,
      askedAppointmentDate: false,
      askedAppointmentReason: false,
      appointmentType: null,
      appointmentDate: null,
      appointmentReason: null
    });
    sessions.set(sessionId, context);
    
    return {
      response: response,
      quickActions: ['New Appointment', 'View Details', 'Contact Support']
    };
  }
  
  // Start appointment flow - ask for type
  if (!context.askedAppointmentType) {
    context.askedAppointmentType = true;
    
    let response = chatbotResponses.appointment[Math.floor(Math.random() * chatbotResponses.appointment.length)];
    response += `\n\nWhat type of appointment are you looking for?`;
    
    const botMessage = { role: 'bot', message: response, timestamp: new Date() };
    context.conversationHistory.push(botMessage);
    database.saveMessage(sessionId, 'bot', response, 'appointment', null, null, null);
    database.updateSession(sessionId, context.userInfo, {
      currentTopic: 'appointment',
      askedAppointmentType: context.askedAppointmentType
    });
    sessions.set(sessionId, context);
    
    return {
      response: response,
      quickActions: ['General Checkup', 'Specialist Visit', 'Follow-up', 'Emergency']
    };
  }
  
  return null; // Continue with default flow
}

// Generate advanced symptom assessment with triage
function generateSymptomAssessment(message, context) {
  const symptomInfo = extractSymptomInfo(message);
  const { symptoms, duration, severity } = symptomInfo;
  
  // Extract entities for better understanding
  const entities = extractEntities(message);
  const sentiment = analyzeSentiment(message);
  
  // Perform triage
  const triage = performTriage(message, symptomInfo);
  
  // Track analytics
  if (symptoms.length > 0) {
    symptoms.forEach(symptom => {
      analytics.symptomFrequency[symptom] = (analytics.symptomFrequency[symptom] || 0) + 1;
    });
  }
  
  if (symptoms.length > 0) {
    const symptom = symptoms[0];
    const knowledge = medicalKnowledge.commonSymptoms[symptom];
    
    let response = `I understand you're experiencing ${symptom}. `;
    
    // Add triage information
    if (triage.urgency === 'CRITICAL' || triage.urgency === 'HIGH') {
      response += `\n\n🚨 **URGENCY: ${triage.urgency}**\n${triage.action}\n\n`;
    }
    
    if (knowledge) {
      response += knowledge.description + " ";
    }
    
    // Add sentiment-aware response
    if (sentiment === 'negative') {
      response += "I understand this is concerning for you. ";
    }
    
    // Add context-aware follow-up questions
    const followUps = [];
    
    if (!duration && !context.askedDuration) {
      followUps.push("How long have you been experiencing this?");
      context.askedDuration = true;
    } else if (duration) {
      response += `You mentioned it's been ${duration}. `;
    }
    
    if (!severity && !context.askedSeverity) {
      followUps.push("On a scale of 1-10, how would you rate the severity?");
      context.askedSeverity = true;
    } else if (severity) {
      response += `You mentioned it's ${severity}. `;
    }
    
    if (!context.askedOtherSymptoms) {
      followUps.push("Are you experiencing any other symptoms?");
      context.askedOtherSymptoms = true;
    }
    
    if (followUps.length > 0) {
      response += followUps.join(" ");
    }
    
    if (knowledge && knowledge.recommendations) {
      response += "\n\n**General recommendations:**\n" + knowledge.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n");
    }
    
    // Add triage recommendation
    response += `\n\n**Recommended Action:** ${triage.action}`;
    response += "\n\n⚠️ For proper diagnosis and treatment, please consult with a healthcare professional.";
    
    const quickActions = ['Schedule Appointment', 'Find Doctor', 'More Info'];
    if (triage.urgency === 'CRITICAL' || triage.urgency === 'HIGH') {
      quickActions.unshift('Call 911');
    }
    
    return { 
      response, 
      context, 
      quickActions,
      triage: triage,
      entities: entities,
      sentiment: sentiment
    };
  }
  
  return null;
}

// Rate limiting middleware
function checkRateLimit(sessionId) {
  const now = Date.now();
  const userLimits = rateLimits.get(sessionId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  if (userLimits.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, resetIn: userLimits.resetTime - now };
  }
  
  userLimits.count++;
  rateLimits.set(sessionId, userLimits);
  return { allowed: true };
}

// Update analytics
function updateAnalytics(intent, sessionId) {
  analytics.totalMessages++;
  analytics.intentDistribution[intent] = (analytics.intentDistribution[intent] || 0) + 1;
  
  const session = sessions.get(sessionId);
  if (session) {
    const hour = new Date().getHours();
    analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;
  }
}

// Generate intelligent response with context (enhanced with AI)
async function generateResponse(userMessage, sessionId) {
  const message = userMessage.toLowerCase().trim();
  let context = sessions.get(sessionId);
  
  // Load from database if not in memory
  if (!context) {
    const dbSession = database.getSession(sessionId);
    if (dbSession) {
      const messages = database.getMessages(sessionId);
      context = {
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          message: msg.message,
          timestamp: new Date(msg.created_at),
          intent: msg.intent,
          entities: msg.entities,
          sentiment: msg.sentiment
        })),
        currentTopic: dbSession.metadata.currentTopic || null,
        askedDuration: dbSession.metadata.askedDuration || false,
        askedSeverity: dbSession.metadata.askedSeverity || false,
        askedOtherSymptoms: dbSession.metadata.askedOtherSymptoms || false,
        userInfo: dbSession.userInfo || {},
        medications: dbSession.userInfo.medications || [],
        symptoms: dbSession.userInfo.symptoms || [],
        createdAt: new Date(dbSession.created_at)
      };
      sessions.set(sessionId, context);
    } else {
      context = {
        conversationHistory: [],
        currentTopic: null,
        askedDuration: false,
        askedSeverity: false,
        askedOtherSymptoms: false,
        askedAppointmentType: false,
        askedAppointmentDate: false,
        askedAppointmentReason: false,
        appointmentType: null,
        appointmentDate: null,
        appointmentReason: null,
        sessionId: sessionId,
        userInfo: {},
        medications: [],
        symptoms: []
      };
    }
  }
  
  // Ensure sessionId is always set
  if (!context.sessionId) {
    context.sessionId = sessionId;
  }
  
  // Extract entities
  const entities = extractEntities(userMessage);
  const sentiment = analyzeSentiment(userMessage);
  
  // Update user profile with extracted information
  if (entities.medications.length > 0) {
    context.userInfo.medications = [...new Set([...context.userInfo.medications || [], ...entities.medications])];
  }
  if (entities.symptoms.length > 0) {
    context.userInfo.symptoms = [...new Set([...context.userInfo.symptoms || [], ...entities.symptoms])];
  }
  
  // Check medication interactions if multiple medications mentioned
  let interactionWarnings = [];
  if (context.userInfo.medications && context.userInfo.medications.length > 1) {
    const interactionCheck = checkMedicationInteractions(context.userInfo.medications);
    interactionWarnings = interactionCheck.warnings;
  }
  
  // Update conversation history
  const userMessageObj = { 
    role: 'user', 
    message: userMessage, 
    timestamp: new Date(),
    entities: entities,
    sentiment: sentiment
  };
  context.conversationHistory.push(userMessageObj);
  
  // Save to database
  const intent = detectIntent(userMessage, context);
  const saved = database.saveMessage(sessionId, 'user', userMessage, intent, entities, sentiment, null);
  if (!saved) {
    console.error('⚠️ Failed to save user message to database');
  }
  database.logEvent('user_message', { intent, sentiment }, sessionId);
  
  context.currentTopic = intent;
  
  // Update analytics
  updateAnalytics(intent, sessionId);
  
  // Check appointment flow BEFORE emergency (if already in appointment flow)
  // This handles multi-turn appointment conversations
  if (context && (context.askedAppointmentType || context.askedAppointmentDate || context.askedAppointmentReason)) {
    try {
      const appointmentFlow = handleAppointmentFlow(userMessage, context, sessionId);
      if (appointmentFlow && appointmentFlow.response) {
        return appointmentFlow;
      }
    } catch (error) {
      console.error('❌ Error in handleAppointmentFlow:', error);
      // Continue with normal flow if appointment flow fails
    }
  }
  
  // Also check if this is a booking trigger (even if not in flow yet)
  const bookingTriggers = ['book now', 'schedule appointment', 'book', 'schedule', 'check availability'];
  if (context && bookingTriggers.includes(message) && intent === 'appointment') {
    try {
      const appointmentFlow = handleAppointmentFlow(userMessage, context, sessionId);
      if (appointmentFlow && appointmentFlow.response) {
        return appointmentFlow;
      }
    } catch (error) {
      console.error('❌ Error starting appointment flow:', error);
      // Continue with normal flow if appointment flow fails
    }
  }
  
  // Emergency check (highest priority) - always use rule-based for safety
  if (intent === 'emergency') {
    analytics.emergencyCount++;
    database.logEvent('emergency_detected', { message: userMessage }, sessionId);
    const response = chatbotResponses.emergency[Math.floor(Math.random() * chatbotResponses.emergency.length)];
    const botMessage = { role: 'bot', message: response, timestamp: new Date() };
    context.conversationHistory.push(botMessage);
    database.saveMessage(sessionId, 'bot', response, 'emergency', null, null, 'emergency');
    database.updateSession(sessionId, context.userInfo, { currentTopic: 'emergency' });
    sessions.set(sessionId, context);
    
    // Emit real-time alert via WebSocket
    io.emit('emergency_alert', { sessionId, message: userMessage, timestamp: new Date() });
    
    return { 
      response, 
      quickActions: ['Call 911', 'Find ER'],
      triage: { urgency: 'CRITICAL', priority: 1 }
    };
  }
  
  // Try AI-enhanced response (for all non-emergency cases)
  let aiResponse = null;
  if (aiService.isAIAvailable()) {
    try {
      console.log('🤖 Generating AI response for intent:', intent);
      aiResponse = await aiService.generateAIResponse(userMessage, context, medicalKnowledge);
      if (aiResponse) {
        console.log('✅ AI response generated:', aiResponse.substring(0, 50) + '...');
      } else {
        console.log('⚠️ AI returned null, using rule-based');
      }
    } catch (error) {
      console.error('❌ AI response error:', error.message);
    }
  }
  
  // Advanced symptom assessment
  if (intent === 'symptom') {
    // Use AI response if available, otherwise use rule-based assessment
    if (aiResponse) {
      // Enhance AI response with triage and recommendations
      const assessment = generateSymptomAssessment(userMessage, context);
      let enhancedResponse = aiResponse;
      
      if (assessment && assessment.triage) {
        if (assessment.triage.urgency === 'CRITICAL' || assessment.triage.urgency === 'HIGH') {
          enhancedResponse = `🚨 **URGENCY: ${assessment.triage.urgency}**\n\n${enhancedResponse}\n\n**Recommended Action:** ${assessment.triage.action}`;
        }
      }
      
      // Add medication interaction warnings if applicable
      if (interactionWarnings.length > 0) {
        enhancedResponse += '\n\n' + interactionWarnings.join('\n');
      }
      
      enhancedResponse += '\n\n⚠️ For proper diagnosis and treatment, please consult with a healthcare professional.';
      
      const botMessage = { role: 'bot', message: enhancedResponse, timestamp: new Date() };
      context.conversationHistory.push(botMessage);
      database.saveMessage(sessionId, 'bot', enhancedResponse, 'symptom', null, sentiment, assessment?.triage?.triageLevel || null);
      database.updateSession(sessionId, context.userInfo, {
        currentTopic: 'symptom',
        askedDuration: context.askedDuration,
        askedSeverity: context.askedSeverity,
        askedOtherSymptoms: context.askedOtherSymptoms
      });
      sessions.set(sessionId, context);
      
      return {
        response: enhancedResponse,
        quickActions: ['Schedule Appointment', 'Find Doctor', 'More Info'],
        triage: assessment?.triage || null,
        entities: entities,
        sentiment: sentiment
      };
    } else {
      // Fall back to rule-based assessment
      const assessment = generateSymptomAssessment(userMessage, context);
      if (assessment) {
        context.conversationHistory.push({ role: 'bot', message: assessment.response, timestamp: new Date() });
        database.saveMessage(sessionId, 'bot', assessment.response, 'symptom', null, sentiment, assessment.triage?.triageLevel || null);
        database.updateSession(sessionId, context.userInfo, {
          currentTopic: 'symptom',
          askedDuration: context.askedDuration,
          askedSeverity: context.askedSeverity,
          askedOtherSymptoms: context.askedOtherSymptoms
        });
        sessions.set(sessionId, context);
        
        // Add medication interaction warnings if applicable
        if (interactionWarnings.length > 0) {
          assessment.response += '\n\n' + interactionWarnings.join('\n');
        }
        
        // Ensure quickActions are always present
        if (!assessment.quickActions || assessment.quickActions.length === 0) {
          assessment.quickActions = ['Schedule Appointment', 'Find Doctor', 'More Info'];
        }
        
        return {
          response: assessment.response,
          quickActions: assessment.quickActions,
          triage: assessment.triage || null,
          entities: assessment.entities || entities,
          sentiment: assessment.sentiment || sentiment
        };
      } else {
        // If no specific assessment, provide general symptom response with quick actions
        const response = chatbotResponses.symptoms[Math.floor(Math.random() * chatbotResponses.symptoms.length)];
        context.conversationHistory.push({ role: 'bot', message: response, timestamp: new Date() });
        database.saveMessage(sessionId, 'bot', response, 'symptom', null, sentiment, null);
        sessions.set(sessionId, context);
        
        return {
          response: response,
          quickActions: ['Schedule Appointment', 'Find Doctor', 'Tell Me More'],
          triage: null,
          entities: entities,
          sentiment: sentiment
        };
      }
    }
  }
  
  // Medication interaction check
  if (intent === 'medication' && entities.medications.length > 0) {
    const interactionCheck = checkMedicationInteractions(entities.medications);
    if (interactionCheck.warnings.length > 0) {
      let response = chatbotResponses.medication[Math.floor(Math.random() * chatbotResponses.medication.length)];
      response += '\n\n' + interactionCheck.warnings.join('\n');
      response += '\n\n⚠️ Always consult your pharmacist or doctor about medication interactions.';
      context.conversationHistory.push({ role: 'bot', message: response, timestamp: new Date() });
      sessions.set(sessionId, context);
      return { 
        response, 
        quickActions: ['Find Pharmacy', 'Contact Doctor'],
        interactions: interactionCheck.interactions
      };
    }
  }
  
  // Specialty information
  if (intent === 'specialty') {
    for (const [specialty, description] of Object.entries(medicalKnowledge.specialties)) {
      if (message.includes(specialty.replace('ology', '')) || message.includes(specialty)) {
        const response = `A ${specialty} specialist focuses on ${description}. Would you like help finding a ${specialty} specialist or scheduling an appointment?`;
        context.conversationHistory.push({ role: 'bot', message: response, timestamp: new Date() });
        sessions.set(sessionId, context);
        return { response, quickActions: ['Find Specialist', 'Schedule Appointment'] };
      }
    }
  }
  
  // Wellness with specific category
  if (intent === 'wellness') {
    for (const [category, tips] of Object.entries(medicalKnowledge.wellnessTips)) {
      if (message.includes(category)) {
        const response = `Here are some ${category} tips:\n\n${tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}\n\nWould you like more information about ${category}?`;
        context.conversationHistory.push({ role: 'bot', message: response, timestamp: new Date() });
        sessions.set(sessionId, context);
        return { response, quickActions: ['More Tips', 'Schedule Checkup'] };
      }
    }
  }
  
  // Standard responses (use AI if available, otherwise rule-based)
  let response = '';
  let quickActions = [];
  
  // If AI response is available, use it for all intents
  if (aiResponse) {
    response = aiResponse;
    // Set quick actions based on intent
    switch (intent) {
      case 'greeting':
        quickActions = ['Check Symptoms', 'Schedule Appointment', 'Wellness Tips'];
        break;
      case 'help':
        quickActions = ['Symptoms', 'Appointments', 'Medications', 'Wellness'];
        break;
      case 'appointment':
        quickActions = ['Book Now', 'Find Doctor', 'Check Availability'];
        break;
      case 'medication':
        quickActions = ['Find Pharmacy', 'Contact Doctor'];
        break;
      case 'wellness':
        quickActions = ['Nutrition Tips', 'Exercise Guide', 'Sleep Advice'];
        break;
      default:
        quickActions = ['Get Help', 'Find Doctor'];
    }
  } else {
    // Fall back to rule-based responses
    switch (intent) {
      case 'greeting':
        response = chatbotResponses.greeting[Math.floor(Math.random() * chatbotResponses.greeting.length)];
        quickActions = ['Check Symptoms', 'Schedule Appointment', 'Wellness Tips'];
        break;
      case 'goodbye':
        response = chatbotResponses.goodbye[Math.floor(Math.random() * chatbotResponses.goodbye.length)];
        break;
      case 'help':
        response = chatbotResponses.help[Math.floor(Math.random() * chatbotResponses.help.length)];
        quickActions = ['Symptoms', 'Appointments', 'Medications', 'Wellness'];
        break;
      case 'appointment':
        // Try appointment flow first
        const appointmentFlow = handleAppointmentFlow(userMessage, context, sessionId);
        if (appointmentFlow) {
          const botMessage = { role: 'bot', message: appointmentFlow.response, timestamp: new Date() };
          context.conversationHistory.push(botMessage);
          sessions.set(sessionId, context);
          return {
            response: appointmentFlow.response,
            quickActions: appointmentFlow.quickActions || ['Book Now', 'Find Doctor', 'Check Availability']
          };
        }
        // Default appointment response
        response = chatbotResponses.appointment[Math.floor(Math.random() * chatbotResponses.appointment.length)];
        quickActions = ['Book Now', 'Find Doctor', 'Check Availability'];
        break;
      case 'medication':
        response = chatbotResponses.medication[Math.floor(Math.random() * chatbotResponses.medication.length)];
        quickActions = ['Find Pharmacy', 'Contact Doctor'];
        break;
      case 'wellness':
        response = chatbotResponses.wellness[Math.floor(Math.random() * chatbotResponses.wellness.length)];
        quickActions = ['Nutrition Tips', 'Exercise Guide', 'Sleep Advice'];
        break;
      default:
        // Context-aware default response
        if (context.conversationHistory.length > 2) {
          const lastTopic = context.currentTopic;
          response = `I understand. Based on our conversation about ${lastTopic}, I'd recommend consulting with a healthcare professional for personalized advice. Is there anything specific you'd like to know more about?`;
        } else {
          response = chatbotResponses.default[Math.floor(Math.random() * chatbotResponses.default.length)];
        }
        quickActions = ['Get Help', 'Find Doctor'];
    }
  }
  
  const finalResponse = response;
  const wasAIEnhanced = !!aiResponse;
  
  const botMessage = { role: 'bot', message: finalResponse, timestamp: new Date() };
  context.conversationHistory.push(botMessage);
  
  // Save to database
  const botSaved = database.saveMessage(sessionId, 'bot', finalResponse, intent, null, sentiment, null);
  if (!botSaved) {
    console.error('⚠️ Failed to save bot message to database');
  }
  const updated = database.updateSession(sessionId, context.userInfo, {
    currentTopic: intent,
    askedDuration: context.askedDuration,
    askedSeverity: context.askedSeverity,
    askedOtherSymptoms: context.askedOtherSymptoms,
    askedAppointmentType: context.askedAppointmentType,
    askedAppointmentDate: context.askedAppointmentDate,
    askedAppointmentReason: context.askedAppointmentReason,
    appointmentType: context.appointmentType,
    appointmentDate: context.appointmentDate,
    appointmentReason: context.appointmentReason
  });
  if (!updated) {
    console.error('⚠️ Failed to update session in database');
  }
  
  // Update user profile in database
  if (context.userInfo.medications || context.userInfo.symptoms) {
    database.saveProfile(
      sessionId,
      context.userInfo.medications || [],
      context.userInfo.symptoms || [],
      context.userInfo.conditions || [],
      {}
    );
  }
  
  sessions.set(sessionId, context);
  
  return { 
    response: finalResponse, 
    quickActions,
    aiEnhanced: wasAIEnhanced
  };
}

// Generate unique session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// API endpoint for chat
app.post('/api/chat', (req, res) => {
  const { message, sessionId: clientSessionId } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // Get or create session
  const sessionId = clientSessionId || generateSessionId();
  
  // Rate limiting
  const rateLimitCheck = checkRateLimit(sessionId);
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please wait a moment before sending another message.',
      resetIn: Math.ceil(rateLimitCheck.resetIn / 1000)
    });
  }
  
  if (!sessions.has(sessionId)) {
    const newSession = {
      conversationHistory: [],
      currentTopic: null,
      askedDuration: false,
      askedSeverity: false,
      askedOtherSymptoms: false,
      askedAppointmentType: false,
      askedAppointmentDate: false,
      askedAppointmentReason: false,
      appointmentType: null,
      appointmentDate: null,
      appointmentReason: null,
      sessionId: sessionId,
      userInfo: {},
      medications: [],
      symptoms: [],
      createdAt: new Date()
    };
    sessions.set(sessionId, newSession);
    
    // Create session in database
    database.createSession(sessionId, newSession.userInfo, {
      currentTopic: null,
      askedDuration: false,
      askedSeverity: false,
      askedOtherSymptoms: false,
      askedAppointmentType: false,
      askedAppointmentDate: false,
      askedAppointmentReason: false,
      appointmentType: null,
      appointmentDate: null,
      appointmentReason: null
    });
    database.logEvent('session_created', { sessionId }, sessionId);
    analytics.totalConversations++;
    console.log(`✅ Created new session: ${sessionId}`);
  }
  
  // Simulate thinking delay for more natural conversation
  setTimeout(async () => {
    try {
      const result = await generateResponse(message, sessionId);
      const session = sessions.get(sessionId) || { conversationHistory: [] };
      
      if (!result || !result.response) {
        console.error('⚠️ generateResponse returned invalid result:', result);
        return res.status(500).json({ 
          error: 'Sorry, I encountered an error. Please try again.',
          sessionId: sessionId
        });
      }
      
      res.json({ 
        response: result.response,
        quickActions: result.quickActions || [],
        sessionId: sessionId,
        triage: result.triage || null,
        entities: result.entities || null,
        sentiment: result.sentiment || null,
        conversationLength: session.conversationHistory.length,
        aiEnhanced: result.aiEnhanced || false
      });
    } catch (error) {
      console.error('❌ Error generating response:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Sorry, I encountered an error. Please try again.',
        sessionId: sessionId
      });
    }
  }, 500);
});

// API endpoint to get conversation history
app.get('/api/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ history: session.conversationHistory });
});

// API endpoint to clear session
app.post('/api/clear-session', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  res.json({ success: true });
});

// API endpoint to export conversation (JSON)
app.get('/api/export/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  let session = sessions.get(sessionId);
  
  // Load from database if not in memory
  if (!session) {
    const dbSession = database.getSession(sessionId);
    if (dbSession) {
      const messages = database.getMessages(sessionId);
      session = {
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          message: msg.message,
          timestamp: new Date(msg.created_at)
        })),
        userInfo: dbSession.userInfo,
        createdAt: new Date(dbSession.created_at)
      };
    }
  }
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const exportData = {
    sessionId: sessionId,
    createdAt: session.createdAt,
    conversationHistory: session.conversationHistory,
    userInfo: session.userInfo,
    summary: {
      totalMessages: session.conversationHistory.length,
      topics: [...new Set(session.conversationHistory.map(m => m.intent || 'general'))],
      symptoms: session.userInfo.symptoms || [],
      medications: session.userInfo.medications || []
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=conversation-${sessionId}.json`);
  res.json(exportData);
});

// API endpoint to export conversation as PDF
app.get('/api/export-pdf/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  let session = sessions.get(sessionId);
  
  if (!session) {
    const dbSession = database.getSession(sessionId);
    if (dbSession) {
      const messages = database.getMessages(sessionId);
      session = {
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          message: msg.message,
          timestamp: new Date(msg.created_at)
        })),
        userInfo: dbSession.userInfo,
        createdAt: new Date(dbSession.created_at)
      };
    }
  }
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const userProfile = database.getProfile(sessionId);
    const conversationData = {
      sessionId: sessionId,
      createdAt: session.createdAt,
      conversationHistory: session.conversationHistory,
      summary: {
        totalMessages: session.conversationHistory.length,
        topics: [...new Set(session.conversationHistory.map(m => m.intent || 'general'))]
      }
    };
    
    const { filepath, filename } = await generateConversationPDF(sessionId, conversationData, userProfile);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        res.status(500).json({ error: 'Error generating PDF' });
      }
      // Clean up file after sending
      setTimeout(() => {
        fs.unlink(filepath, () => {});
      }, 5000);
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Error generating PDF report' });
  }
});

// API endpoint to search conversations
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  const cacheKey = `search_${q}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  const results = database.searchMessages(q);
  const response = {
    query: q,
    results: results,
    count: results.length
  };
  
  cache.set(cacheKey, response);
  res.json(response);
});

// Admin API: Get analytics (enhanced with database)
app.get('/api/admin/analytics', (req, res) => {
  const cacheKey = 'admin_analytics';
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  // Calculate average session length
  let totalMessages = 0;
  let sessionCount = 0;
  sessions.forEach(session => {
    totalMessages += session.conversationHistory.length;
    sessionCount++;
  });
  analytics.averageSessionLength = sessionCount > 0 ? (totalMessages / sessionCount).toFixed(2) : 0;
  
  // Get database stats
  const dbStats = database.getStats();
  const dbAnalytics = database.getAnalytics();
  
  const response = {
    ...analytics,
    database: dbStats,
    dbAnalytics: dbAnalytics,
    activeSessions: sessions.size,
    aiEnabled: aiService.isAIAvailable(),
    timestamp: new Date()
  };
  
  cache.set(cacheKey, response, 60); // Cache for 1 minute
  res.json(response);
});

// Admin API: Get session details
app.get('/api/admin/sessions', (req, res) => {
  const sessionList = [];
  sessions.forEach((session, sessionId) => {
    sessionList.push({
      sessionId,
      createdAt: session.createdAt,
      messageCount: session.conversationHistory.length,
      currentTopic: session.currentTopic,
      userInfo: session.userInfo
    });
  });
  
  res.json({ sessions: sessionList, total: sessionList.length });
});

// API endpoint to get user profile
app.get('/api/profile/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    sessionId: sessionId,
    userInfo: session.userInfo,
    conversationStats: {
      totalMessages: session.conversationHistory.length,
      topics: [...new Set(session.conversationHistory.map(m => m.intent || 'general'))],
      symptoms: session.userInfo.symptoms || [],
      medications: session.userInfo.medications || []
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`Client ${socket.id} joined session ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🏥 Healthcare Chatbot server running on http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite (${database.getStats().totalSessions} sessions)`);
  console.log(`🤖 AI Service: ${aiService.isAIAvailable() ? 'Enabled (OpenAI)' : 'Disabled (Rule-based)'}`);
  console.log(`🔌 WebSocket: Enabled`);
  console.log(`💾 Caching: Enabled`);
});

