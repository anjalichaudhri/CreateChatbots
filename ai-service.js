// AI Service for enhanced responses (optional OpenAI integration)
require('dotenv').config();

let openaiClient = null;

// Try to initialize OpenAI if API key is available
try {
  require('dotenv').config();
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI integration enabled');
  } else {
    console.log('ℹ️ OpenAI API key not set - using rule-based responses');
  }
} catch (error) {
  console.log('⚠️ OpenAI not available:', error.message);
  console.log('   Install: npm install openai');
  console.log('   Then set OPENAI_API_KEY in .env file');
}

// Enhanced response generation with AI
async function generateAIResponse(userMessage, context, medicalKnowledge) {
  if (!openaiClient) {
    return null; // Fall back to rule-based system
  }

  try {
    // Build conversation history with more context
    const conversationHistory = context.conversationHistory
      .slice(-15) // Last 15 messages for better context
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${msg.message}`;
      })
      .join('\n');
    
    // Add context about what was discussed
    let contextSummary = '';
    if (context.conversationHistory.length > 2) {
      const recentTopics = context.conversationHistory
        .slice(-5)
        .map(msg => msg.intent || 'general')
        .filter((v, i, a) => a.indexOf(v) === i);
      contextSummary = `\n\nRecent conversation topics: ${recentTopics.join(', ')}`;
    }

    const systemPrompt = `You are a professional healthcare assistant chatbot. Your role is to:
1. Provide general health information and guidance
2. Help users understand symptoms and when to seek care
3. Assist with medication questions (always recommend consulting pharmacist/doctor)
4. Provide wellness and preventive care tips
5. NEVER diagnose or prescribe - always recommend professional medical consultation
6. For emergencies, immediately direct users to call 911

Important disclaimers to include:
- You provide general information only
- Not a replacement for professional medical advice
- Always consult healthcare providers for diagnosis and treatment
- For emergencies, call 911 immediately

Medical knowledge available:
- Common symptoms: ${Object.keys(medicalKnowledge.commonSymptoms).join(', ')}
- Specialties: ${Object.keys(medicalKnowledge.specialties).join(', ')}
- Wellness categories: ${Object.keys(medicalKnowledge.wellnessTips).join(', ')}

User context:
- Current topic: ${context.currentTopic || 'general'}
- Medications mentioned: ${context.userInfo?.medications?.join(', ') || 'none'}
- Symptoms mentioned: ${context.userInfo?.symptoms?.join(', ') || 'none'}`;

    const response = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Previous conversation:\n${conversationHistory}${contextSummary}\n\nCurrent user message: ${userMessage}\n\nProvide a helpful, empathetic, and medically appropriate response that maintains conversation context and builds on previous messages.` }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content;
  } catch (error) {
    if (error.status === 429) {
      console.error('❌ OpenAI API quota exceeded. Please check your OpenAI account billing.');
      console.error('   The chatbot will continue using rule-based responses.');
    } else {
      console.error('OpenAI API error:', error.message);
    }
    return null; // Fall back to rule-based
  }
}

// Enhanced entity extraction with AI
async function extractEntitiesAI(message) {
  if (!openaiClient) {
    return null;
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Extract medical entities from the user message. Return JSON with: medications (array), symptoms (array), bodyParts (array), numbers (array), timeExpressions (array).'
        },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('AI entity extraction error:', error);
    return null;
  }
}

module.exports = {
  generateAIResponse,
  extractEntitiesAI,
  isAIAvailable: () => openaiClient !== null
};

