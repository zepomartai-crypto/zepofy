const mongoose = require('mongoose');

const whatsappFlowTemplateSchema = new mongoose.Schema(
  {
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    flow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppFlow',
      required: true,
    },
    ctaButtonText: {
      type: String,
      required: true,
      default: 'Open Flow',
    },
    templateContent: {
      type: String,
      required: false,
    },
    metaTemplateId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'REJECTED'],
      default: 'DRAFT',
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_flow_templates',
  }
);

module.exports = mongoose.model('WhatsAppFlowTemplate', whatsappFlowTemplateSchema);
