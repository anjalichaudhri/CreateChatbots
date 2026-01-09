// PDF Report Generator
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function generateConversationPDF(sessionId, conversationData, userProfile) {
  return new Promise((resolve, reject) => {
    const filename = `conversation-${sessionId}-${Date.now()}.pdf`;
    const filepath = path.join(reportsDir, filename);
    
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    
    doc.pipe(stream);

    // Header
    doc.fontSize(20)
       .fillColor('#4facfe')
       .text('Healthcare Chatbot Conversation Report', { align: 'center' })
       .moveDown();

    doc.fontSize(12)
       .fillColor('#666666')
       .text(`Session ID: ${sessionId}`, { align: 'center' })
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
       .moveDown(2);

    // User Profile Section
    if (userProfile) {
      doc.fontSize(16)
         .fillColor('#333333')
         .text('User Profile', { underline: true })
         .moveDown();

      doc.fontSize(11)
         .fillColor('#000000');

      if (userProfile.medications && userProfile.medications.length > 0) {
        doc.text(`Medications: ${userProfile.medications.join(', ')}`);
      }
      if (userProfile.symptoms && userProfile.symptoms.length > 0) {
        doc.text(`Symptoms: ${userProfile.symptoms.join(', ')}`);
      }
      if (userProfile.conditions && userProfile.conditions.length > 0) {
        doc.text(`Conditions: ${userProfile.conditions.join(', ')}`);
      }
      doc.moveDown(2);
    }

    // Conversation Summary
    doc.fontSize(16)
       .fillColor('#333333')
       .text('Conversation Summary', { underline: true })
       .moveDown();

    doc.fontSize(11)
       .fillColor('#000000')
       .text(`Total Messages: ${conversationData.summary?.totalMessages || 0}`)
       .text(`Topics Discussed: ${conversationData.summary?.topics?.join(', ') || 'None'}`)
       .moveDown(2);

    // Conversation History
    doc.fontSize(16)
       .fillColor('#333333')
       .text('Conversation History', { underline: true })
       .moveDown();

    doc.fontSize(10);
    
    conversationData.conversationHistory.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'User' : 'Healthcare Assistant';
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'N/A';
      
      doc.fillColor(msg.role === 'user' ? '#4facfe' : '#333333')
         .font('Helvetica-Bold')
         .text(`${role} (${timestamp}):`, { continued: false })
         .font('Helvetica')
         .fillColor('#000000')
         .text(msg.message, { indent: 20 })
         .moveDown(0.5);
    });

    // Footer
    doc.fontSize(8)
       .fillColor('#999999')
       .text('This report is for informational purposes only. Always consult with healthcare professionals for medical advice.', 
             { align: 'center', italic: true });

    doc.end();

    stream.on('finish', () => {
      resolve({ filepath, filename });
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = { generateConversationPDF, reportsDir };

