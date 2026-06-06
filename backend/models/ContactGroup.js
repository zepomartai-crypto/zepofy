const mongoose = require("mongoose");

const ContactGroupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  contactIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
  ],
  memberCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ AUTO-UPDATE MEMBER COUNT
ContactGroupSchema.pre('save', async function() {
  if (this.contactIds) {
    this.memberCount = this.contactIds.length;
  }
});

// ✅ ADD MEMBERS FIELD AS VIRTUAL FOR COMPATIBILITY
ContactGroupSchema.virtual('members', {
  ref: 'Contact',
  localField: 'contactIds',
  foreignField: '_id',
  justOne: false
});

module.exports = mongoose.model("ContactGroup", ContactGroupSchema);
