const mongoose = require('mongoose');

const whatsappFlowVersionSchema = new mongoose.Schema(
  {
    flow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppFlow',
      required: true,
    },
    versionName: {
      type: String,
      required: true,
    },
    metaFlowJSON: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    layoutSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_flow_versions',
  }
);

module.exports = mongoose.model('WhatsAppFlowVersion', whatsappFlowVersionSchema);
