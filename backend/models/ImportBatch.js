const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  emails: {
    type: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
      },
      tags: {
        type: [String],
        default: []
      },
      variables: {
        type: Map,
        of: String,
        default: {}
      }
    }],
    required: true
  },
  stats: {
    total: {
      type: Number,
      required: true
    },
    valid: {
      type: Number,
      required: true
    },
    skipped: {
      type: Number,
      required: true
    },
    errors: {
      type: Number,
      required: true
    }
  },
  errors: {
    type: [{
      row: Number,
      error: String,
      data: Object
    }],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: true
});

// Index for cleanup
importBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ImportBatch', importBatchSchema);
