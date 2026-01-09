// Database module for persistent storage
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

//  Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(path.join(dataDir, 'chatbot.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_info TEXT,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    intent TEXT,
    entities TEXT,
    sentiment TEXT,
    triage_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_data TEXT,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    session_id TEXT PRIMARY KEY,
    medications TEXT,
    symptoms TEXT,
    conditions TEXT,
    preferences TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
  CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at);
`);

// Database operations
const dbOps = {
  // Session operations
  createSession: db.prepare(`
    INSERT INTO sessions (session_id, user_info, metadata)
    VALUES (?, ?, ?)
  `),

  updateSession: db.prepare(`
    UPDATE sessions 
    SET updated_at = CURRENT_TIMESTAMP, user_info = ?, metadata = ?
    WHERE session_id = ?
  `),

  getSession: db.prepare(`
    SELECT * FROM sessions WHERE session_id = ?
  `),

  getAllSessions: db.prepare(`
    SELECT * FROM sessions ORDER BY updated_at DESC
  `),

  // Message operations
  saveMessage: db.prepare(`
    INSERT INTO messages (session_id, role, message, intent, entities, sentiment, triage_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  getMessages: db.prepare(`
    SELECT * FROM messages 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `),

  searchMessages: db.prepare(`
    SELECT * FROM messages 
    WHERE message LIKE ? OR intent LIKE ?
    ORDER BY created_at DESC
    LIMIT 100
  `),

  // Analytics operations
  logEvent: db.prepare(`
    INSERT INTO analytics (event_type, event_data, session_id)
    VALUES (?, ?, ?)
  `),

  getAnalytics: db.prepare(`
    SELECT event_type, COUNT(*) as count, 
           DATE(created_at) as date
    FROM analytics
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY event_type, date
    ORDER BY date DESC
  `),

  // Profile operations
  saveProfile: db.prepare(`
    INSERT OR REPLACE INTO user_profiles (session_id, medications, symptoms, conditions, preferences)
    VALUES (?, ?, ?, ?, ?)
  `),

  getProfile: db.prepare(`
    SELECT * FROM user_profiles WHERE session_id = ?
  `)
};

// Wrapper functions with error handling
const database = {
  createSession: (sessionId, userInfo = {}, metadata = {}) => {
    try {
      dbOps.createSession.run(
        sessionId,
        JSON.stringify(userInfo),
        JSON.stringify(metadata)
      );
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  },

  updateSession: (sessionId, userInfo, metadata) => {
    try {
      dbOps.updateSession.run(
        JSON.stringify(userInfo),
        JSON.stringify(metadata),
        sessionId
      );
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  },

  getSession: (sessionId) => {
    try {
      const row = dbOps.getSession.get(sessionId);
      if (row) {
        return {
          ...row,
          userInfo: JSON.parse(row.user_info || '{}'),
          metadata: JSON.parse(row.metadata || '{}')
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  getAllSessions: () => {
    try {
      const rows = dbOps.getAllSessions.all();
      return rows.map(row => ({
        ...row,
        userInfo: JSON.parse(row.user_info || '{}'),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  },

  saveMessage: (sessionId, role, message, intent = null, entities = null, sentiment = null, triageLevel = null) => {
    try {
      dbOps.saveMessage.run(
        sessionId,
        role,
        message,
        intent,
        entities ? JSON.stringify(entities) : null,
        sentiment,
        triageLevel
      );
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  },

  getMessages: (sessionId) => {
    try {
      const rows = dbOps.getMessages.all(sessionId);
      return rows.map(row => ({
        ...row,
        entities: row.entities ? JSON.parse(row.entities) : null
      }));
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },

  searchMessages: (query) => {
    try {
      const searchTerm = `%${query}%`;
      const rows = dbOps.searchMessages.all(searchTerm, searchTerm);
      return rows.map(row => ({
        ...row,
        entities: row.entities ? JSON.parse(row.entities) : null
      }));
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  },

  logEvent: (eventType, eventData, sessionId = null) => {
    try {
      dbOps.logEvent.run(
        eventType,
        JSON.stringify(eventData),
        sessionId
      );
      return true;
    } catch (error) {
      console.error('Error logging event:', error);
      return false;
    }
  },

  getAnalytics: () => {
    try {
      return dbOps.getAnalytics.all();
    } catch (error) {
      console.error('Error getting analytics:', error);
      return [];
    }
  },

  saveProfile: (sessionId, medications = [], symptoms = [], conditions = [], preferences = {}) => {
    try {
      dbOps.saveProfile.run(
        sessionId,
        JSON.stringify(medications),
        JSON.stringify(symptoms),
        JSON.stringify(conditions),
        JSON.stringify(preferences)
      );
      return true;
    } catch (error) {
      console.error('Error saving profile:', error);
      return false;
    }
  },

  getProfile: (sessionId) => {
    try {
      const row = dbOps.getProfile.get(sessionId);
      if (row) {
        return {
          ...row,
          medications: JSON.parse(row.medications || '[]'),
          symptoms: JSON.parse(row.symptoms || '[]'),
          conditions: JSON.parse(row.conditions || '[]'),
          preferences: JSON.parse(row.preferences || '{}')
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  },

  // Statistics
  getStats: () => {
    try {
      const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
      const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
      const totalAnalytics = db.prepare('SELECT COUNT(*) as count FROM analytics').get().count;
      
      const avgMessages = totalSessions > 0 ? (totalMessages / totalSessions).toFixed(2) : 0;
      
      return {
        totalSessions,
        totalMessages,
        totalAnalytics,
        averageMessagesPerSession: avgMessages
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { totalSessions: 0, totalMessages: 0, totalAnalytics: 0, averageMessagesPerSession: 0 };
    }
  }
};

module.exports = database;

