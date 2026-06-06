const mongoose = require('mongoose');

const whatsappFlowAnalyticsSchema = new mongoose.Schema(
  {
    flow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppFlow',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    metrics: {
      opens: { type: Number, default: 0 },
      starts: { type: Number, default: 0 },
      submits: { type: Number, default: 0 },
      dropOffs: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_flow_analytics',
  }
);

// Ensure one entry per flow per day
whatsappFlowAnalyticsSchema.index({ flow: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppFlowAnalytics', whatsappFlowAnalyticsSchema);
