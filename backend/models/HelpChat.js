const mongoose = require('mongoose');

const helpChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['knowledge_base', 'openai', 'gemini', 'default'],
    default: 'knowledge_base'
  },
  rating: {
    type: String,
    enum: ['up', 'down', null],
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('HelpChat', helpChatSchema);
