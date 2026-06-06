const mongoose = require('mongoose');

const whatsappFlowResponseSchema = new mongoose.Schema(
  {
    flow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppFlow',
      required: true,
    },
    flowVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppFlowVersion',
      required: false,
    },
    contactPhone: {
      type: String,
      required: true,
    },
    contactName: {
      type: String,
      default: '',
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed, // The decrypted payload answers
      required: true,
    },
    status: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED'],
      default: 'RECEIVED',
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_flow_responses',
  }
);

module.exports = mongoose.model('WhatsAppFlowResponse', whatsappFlowResponseSchema);
