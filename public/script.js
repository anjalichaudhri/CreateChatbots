const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatMessages = document.getElementById('chatMessages');
const sendButton = document.getElementById('sendButton');

// Session management
let currentSessionId = localStorage.getItem('chatbotSessionId') || null;

// Get current time for message timestamps
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

// Add message to chat with optional quick actions
function addMessage(content, isUser = false, quickActions = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🏥';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('p');
    // Support line breaks and basic markdown in bot messages
    if (!isUser) {
        // Simple markdown parser for **bold** and line breaks
        const parts = content.split(/(\*\*.*?\*\*|\n)/);
        parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
                const bold = document.createElement('strong');
                bold.textContent = part.slice(2, -2);
                messageText.appendChild(bold);
            } else if (part === '\n') {
                messageText.appendChild(document.createElement('br'));
            } else if (part.trim()) {
                const span = document.createElement('span');
                span.textContent = part;
                messageText.appendChild(span);
            }
        });
    } else {
        messageText.textContent = content;
    }
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = getCurrentTime();
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTime);
    
    // Add quick action buttons for bot messages
    if (!isUser && quickActions && quickActions.length > 0) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'quick-actions';
        quickActions.forEach(action => {
            const button = document.createElement('button');
            button.className = 'quick-action-btn';
            button.textContent = action;
            button.addEventListener('click', () => {
                userInput.value = action;
                chatForm.dispatchEvent(new Event('submit'));
            });
            actionsContainer.appendChild(button);
        });
        messageContent.appendChild(actionsContainer);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typingIndicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🏥';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    
    messageContent.appendChild(typingIndicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(messageContent);
    
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Scroll to bottom of chat
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message to server
async function sendMessage(message) {
    try {
        showTypingIndicator();
        sendButton.disabled = true;
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message,
                sessionId: currentSessionId 
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to get response');
        }
        
        const data = await response.json();
        
        // Update session ID if provided
        if (data.sessionId && !currentSessionId) {
            currentSessionId = data.sessionId;
            localStorage.setItem('chatbotSessionId', currentSessionId);
        }
        
        removeTypingIndicator();
        
        // Add triage indicator if present
        let messageContent = data.response;
        if (data.triage && data.triage.urgency) {
            const urgencyEmoji = data.triage.urgency === 'CRITICAL' ? '🚨' : 
                                data.triage.urgency === 'HIGH' ? '⚠️' : 
                                data.triage.urgency === 'MEDIUM' ? '⚡' : 'ℹ️';
            messageContent = `${urgencyEmoji} **${data.triage.urgency} Priority**\n\n${messageContent}`;
        }
        
        addMessage(messageContent, false, data.quickActions || []);
        
    } catch (error) {
        removeTypingIndicator();
        addMessage('Sorry, I encountered an error. Please try again.', false);
        console.error('Error:', error);
    } finally {
        sendButton.disabled = false;
        userInput.focus();
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, true);
    
    // Clear input
    userInput.value = '';
    
    // Send to server
    await sendMessage(message);
});

// Allow Enter key to send (Shift+Enter for new line)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Auto-focus input on load
window.addEventListener('load', () => {
    userInput.focus();
});

// Scroll to bottom on initial load
scrollToBottom();

// Export conversation
document.getElementById('exportBtn')?.addEventListener('click', async () => {
    if (!currentSessionId) {
        alert('No conversation to export');
        return;
    }
    
    try {
        const response = await fetch(`/api/export/${currentSessionId}`);
        if (!response.ok) throw new Error('Export failed');
        
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${currentSessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export conversation');
    }
});

// View profile
document.getElementById('profileBtn')?.addEventListener('click', async () => {
    if (!currentSessionId) {
        alert('No active session');
        return;
    }
    
    try {
        const response = await fetch(`/api/profile/${currentSessionId}`);
        if (!response.ok) throw new Error('Failed to load profile');
        
        const data = await response.json();
        const profileInfo = `
Profile Information:
- Total Messages: ${data.conversationStats.totalMessages}
- Topics Discussed: ${data.conversationStats.topics.join(', ') || 'None'}
- Symptoms Mentioned: ${data.conversationStats.symptoms.join(', ') || 'None'}
- Medications: ${data.conversationStats.medications.join(', ') || 'None'}
        `.trim();
        
        addMessage(profileInfo, false);
    } catch (error) {
        console.error('Profile error:', error);
        alert('Failed to load profile');
    }
});

