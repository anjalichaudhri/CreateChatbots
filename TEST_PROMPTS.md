# Healthcare Chatbot - Test Prompts

Use these prompts to test all the powerful features of your healthcare chatbot!

## 🚨 Emergency & Triage Testing

### Critical Emergency (Priority 1)
- "I'm having severe chest pain"
- "I can't breathe"
- "I think I'm having a heart attack"
- "I'm unconscious and need help"
- "Severe bleeding that won't stop"

### Urgent (Priority 2)
- "I have a high fever for 2 days"
- "Severe pain in my stomach"
- "I've been vomiting for hours"
- "I can't stop coughing and it's getting worse"
- "I have difficulty breathing"

### Moderate (Priority 3)
- "I have a headache for 3 days"
- "Moderate pain in my back"
- "I've had a fever for a week"
- "I feel nauseous and tired"
- "Persistent cough for 5 days"

### Routine (Priority 4)
- "I want wellness tips"
- "How can I improve my diet?"
- "I need a routine checkup"
- "What are some exercise recommendations?"

---

## 🔍 Symptom Assessment (Multi-turn Conversations)

### Headache Testing
1. "I have a headache"
   - Bot should ask: "How long have you been experiencing this?"
2. "3 days"
   - Bot should ask: "On a scale of 1-10, how would you rate the severity?"
3. "About 7 out of 10"
   - Bot should ask: "Are you experiencing any other symptoms?"

### Fever Testing
1. "I have a fever"
2. "It's been 2 days and it's getting worse"
3. "The temperature is 102 degrees"

### Multiple Symptoms
- "I have a headache, fever, and I feel nauseous"
- "I'm experiencing dizziness and fatigue"
- "I have stomach pain and I've been vomiting"

---

## 💊 Medication Interaction Testing

### Single Medication
- "I'm taking aspirin"
- "Can you tell me about ibuprofen?"
- "I have questions about my warfarin prescription"

### Multiple Medications (Interaction Detection)
- "I'm taking aspirin and warfarin"
  - Bot should warn about bleeding risk
- "I take ibuprofen and aspirin together"
  - Bot should warn about stomach bleeding
- "I'm on warfarin and I also take vitamin K supplements"
  - Bot should warn about blood thinning effects

### Medication Questions
- "What are the side effects of aspirin?"
- "Can I take ibuprofen with my other medications?"
- "I forgot to take my medication, what should I do?"

---

## 📅 Appointment & Scheduling

### General Appointments
- "I need to schedule an appointment"
- "How can I book a doctor's visit?"
- "I want to see a doctor"
- "When is the next available appointment?"

### Specialty Appointments
- "I need to see a cardiologist"
- "Can you help me find a dermatologist?"
- "I'm looking for a neurologist"
- "I need a pediatrician for my child"
- "I want to schedule a psychiatry appointment"

---

## 🏥 Medical Specialties

- "What does a cardiologist do?"
- "Tell me about dermatology"
- "What is endocrinology?"
- "I need information about gastroenterology"
- "What does a neurologist specialize in?"

---

## 🌿 Wellness & Preventive Care

### Nutrition
- "I want nutrition tips"
- "How can I eat healthier?"
- "What's a balanced diet?"
- "Give me wellness advice about nutrition"

### Exercise
- "I need exercise recommendations"
- "How much should I exercise?"
- "What are some fitness tips?"
- "I want to start working out"

### Sleep
- "I have trouble sleeping"
- "How can I improve my sleep?"
- "What are good sleep habits?"
- "I want sleep wellness tips"

### Mental Health
- "I'm feeling stressed"
- "How can I manage my mental health?"
- "I need stress management tips"
- "What are some mental wellness practices?"

---

## 💬 Conversation Flow Testing

### Multi-turn Symptom Assessment
1. "Hi"
2. "I'm not feeling well"
3. "I have a headache"
4. "It started 2 days ago"
5. "The pain is moderate, about 5 out of 10"
6. "Yes, I also feel a bit dizzy"

### Context Memory Test
1. "I have a headache"
2. "It's been 3 days"
3. "I'm also taking aspirin"
4. "Should I be concerned?"
   - Bot should remember headache, duration, and medication

### Profile Building
1. "I'm taking aspirin"
2. "I also take ibuprofen"
3. "I have a headache"
4. Click "View Profile" button
   - Should show medications and symptoms

---

## 🎯 Intent Detection Testing

### Greetings
- "Hello"
- "Hi there"
- "Good morning"
- "Hey"

### Help Requests
- "What can you do?"
- "How can you help me?"
- "What are your capabilities?"
- "Help"

### Goodbyes
- "Thank you, goodbye"
- "Bye"
- "Thanks for your help"
- "I appreciate it, see you later"

---

## 🔬 Advanced Features Testing

### Entity Extraction
- "I've had a headache for 3 days and I'm taking 2 aspirin tablets"
  - Should extract: headache (symptom), 3 days (time), aspirin (medication), 2 (number)

### Sentiment Analysis
- "I'm really worried about my symptoms" (negative sentiment)
- "I'm feeling much better today!" (positive sentiment)
- "I have a headache" (neutral sentiment)

### Export & Profile
1. Have a conversation
2. Click the "Export" button (top right)
   - Should download JSON file
3. Click the "Profile" button
   - Should show conversation stats

---

## 📊 Analytics Testing

After having several conversations, test the analytics:
- Visit: `http://localhost:3000/api/admin/analytics`
- Visit: `http://localhost:3000/api/admin/sessions`

---

## 🎭 Complex Scenarios

### Scenario 1: Emergency Detection
- "I'm having chest pain and can't breathe"
  - Should trigger emergency response
  - Should show "Call 911" quick action

### Scenario 2: Medication + Symptom
- "I'm taking aspirin and warfarin, and I have a severe headache"
  - Should detect medication interaction
  - Should perform triage (urgent)
  - Should provide warnings

### Scenario 3: Wellness Journey
1. "I want to improve my health"
2. "Tell me about nutrition"
3. "What about exercise?"
4. "I also want sleep tips"

### Scenario 4: Complete Health Assessment
1. "I have a headache"
2. "It's been 3 days"
3. "Severity is 7 out of 10"
4. "I'm also taking aspirin"
5. "Should I see a doctor?"
   - Bot should recommend appointment based on triage

---

## 🧪 Edge Cases

### Empty/Invalid Input
- "" (empty message)
- "   " (whitespace only)

### Rate Limiting
- Send 35+ messages rapidly
  - Should get rate limit error after 30

### Unknown Topics
- "What's the weather like?"
- "Tell me a joke"
- "What's 2+2?"

---

## 💡 Pro Tips for Testing

1. **Test Multi-turn Conversations**: Start with a symptom, then answer follow-up questions
2. **Test Context Memory**: Reference previous messages in later messages
3. **Test Quick Actions**: Click the quick action buttons that appear
4. **Test Export**: Have a conversation, then export it
5. **Test Profile**: Build up medications/symptoms, then view profile
6. **Test Triage Levels**: Try different urgency levels to see triage in action
7. **Test Interactions**: Mention multiple medications to trigger interaction warnings

---

## 🎯 Quick Test Sequence

Try this complete test sequence:

1. "Hello"
2. "I have a headache"
3. "3 days"
4. "About 7 out of 10"
5. "I'm also taking aspirin and warfarin"
6. Click "View Profile"
7. Click "Export Conversation"

This will test: greeting, symptom assessment, triage, medication interaction, profile, and export features!

---

Happy Testing! 🚀

