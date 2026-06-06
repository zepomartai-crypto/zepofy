const mongoose = require('mongoose');

const whatsappFlowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED'],
      default: 'DRAFT',
    },
    categories: {
      type: [String],
      default: [],
    },
    whatsappChannel: {
      type: String,
      default: '',
    },
    flowId: {
      type: String, // The Meta Flow ID when published
      default: null,
    },
    layout: {
      type: mongoose.Schema.Types.Mixed, // Stores the draft UI structure built in the drag-and-drop editor
      default: {},
    },
    metaFlowJSON: {
      type: mongoose.Schema.Types.Mixed, // The generated strict Meta Flow JSON
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_flows',
  }
);

module.exports = mongoose.model('WhatsAppFlow', whatsappFlowSchema);
