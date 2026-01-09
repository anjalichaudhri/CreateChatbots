# Appointment Booking Flow Guide

## ✅ Fixed: Advanced Appointment Booking Flow

The appointment booking system now has a complete multi-step flow with follow-up questions and quick action buttons at each step.

## How It Works

### Step-by-Step Flow

1. **User clicks "Book Now" or "Schedule Appointment"**
   - Bot asks: "What type of appointment are you looking for?"
   - Quick Actions: `['General Checkup', 'Specialist Visit', 'Follow-up', 'Emergency']`

2. **User selects appointment type** (e.g., "General Checkup")
   - Bot asks: "What date would work best for you?"
   - Quick Actions: `['Tomorrow', 'Next Week', 'This Week', 'Cancel']`

3. **User selects date** (e.g., "Tomorrow")
   - Bot asks: "What is the reason for your visit?"
   - Quick Actions: `['Routine Checkup', 'Follow-up', 'Symptoms', 'Other']`

4. **User provides reason** (e.g., "Routine Checkup")
   - Bot provides: Complete appointment summary with booking instructions
   - Quick Actions: `['New Appointment', 'View Details', 'Contact Support']`

## Features

### ✅ Multi-Turn Conversation
- Maintains context across multiple messages
- Remembers appointment type, date, and reason
- Provides summary at the end

### ✅ Quick Action Buttons
- Each step has relevant quick actions
- One-click selection for common options
- Easy navigation through the flow

### ✅ Context Awareness
- Detects if user is in appointment flow
- Handles responses appropriately
- Prevents booking triggers from being treated as answers

### ✅ Database Persistence
- All appointment details saved to database
- Conversation history maintained
- Can resume appointment flow if interrupted

## Technical Implementation

### Flow Detection
```javascript
// Check if user is in appointment flow
if (context.askedAppointmentType || context.askedAppointmentDate || context.askedAppointmentReason) {
  const appointmentFlow = handleAppointmentFlow(userMessage, context, sessionId);
  if (appointmentFlow) {
    return appointmentFlow;
  }
}
```

### State Management
- `askedAppointmentType`: Tracks if type question was asked
- `askedAppointmentDate`: Tracks if date question was asked
- `askedAppointmentReason`: Tracks if reason question was asked
- `appointmentType`: Stores selected type
- `appointmentDate`: Stores selected date
- `appointmentReason`: Stores selected reason

### Booking Triggers
Recognized triggers that start the flow:
- "Book Now"
- "Schedule Appointment"
- "Book"
- "Schedule"
- "Check Availability"

## Usage Example

**User:** "I need an appointment"
**Bot:** "I can help you schedule an appointment! What type of appointment are you looking for?"
*[Quick Actions: General Checkup, Specialist Visit, Follow-up, Emergency]*

**User:** *Clicks "General Checkup"*
**Bot:** "Thank you! You're looking for a General Checkup appointment. What date would work best for you?"
*[Quick Actions: Tomorrow, Next Week, This Week, Cancel]*

**User:** *Clicks "Tomorrow"*
**Bot:** "Great! Tomorrow works. What is the reason for your visit?"
*[Quick Actions: Routine Checkup, Follow-up, Symptoms, Other]*

**User:** *Clicks "Routine Checkup"*
**Bot:** "Perfect! I have your appointment details:
- Appointment Type: General Checkup
- Preferred Date: Tomorrow
- Reason: Routine Checkup

To complete your booking, you can:
1. Call our scheduling line at (555) 123-4567
2. Visit our online portal at www.healthcareportal.com
3. Use our mobile app

Our team will confirm your appointment within 24 hours."
*[Quick Actions: New Appointment, View Details, Contact Support]*

## Status

✅ **FIXED** - Appointment flow now works with:
- Multi-step conversation
- Quick action buttons at each step
- Context awareness
- Database persistence
- Complete booking summary

Try it now at `http://localhost:3000`!

