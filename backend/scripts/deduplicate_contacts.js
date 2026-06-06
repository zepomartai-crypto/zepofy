const mongoose = require('mongoose');
require('dotenv').config();
const Contact = require('../models/Contact');
const { normalizePhone } = require('../utils/phoneNormalizer');

async function deduplicate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const contacts = await Contact.find({});
    console.log(`Analyzing ${contacts.length} contacts...`);

    const userContacts = {}; // userId -> { phone -> [contacts] }

    for (const contact of contacts) {
      const userId = contact.userId.toString();
      const normalizedPhone = normalizePhone(contact.phone);

      if (!userContacts[userId]) userContacts[userId] = {};
      if (!userContacts[userId][normalizedPhone]) userContacts[userId][normalizedPhone] = [];
      
      userContacts[userId][normalizedPhone].push(contact);
    }

    let totalFixed = 0;
    let totalMerged = 0;

    for (const userId in userContacts) {
      for (const phone in userContacts[userId]) {
        const list = userContacts[userId][phone];

        // 1. If normalization changed the phone number string in DB, update it
        if (list.length === 1 && list[0].phone !== phone) {
            await Contact.findByIdAndUpdate(list[0]._id, { phone });
            totalFixed++;
            continue;
        }

        // 2. If multiple contacts exist for the same normalized phone
        if (list.length > 1) {
          console.log(`Merging ${list.length} contacts for ${phone} (User: ${userId})`);
          
          // Sort by activity/completeness
          // We'll keep the one with the most tags or the one that is NOT 'whatsapp_inbound' if possible
          list.sort((a, b) => {
            const scoreA = (a.tags?.length || 0) + (a.name !== "Unknown" ? 1 : 0) + (a.source !== "whatsapp_inbound" ? 1 : 0);
            const scoreB = (b.tags?.length || 0) + (b.name !== "Unknown" ? 1 : 0) + (b.source !== "whatsapp_inbound" ? 1 : 0);
            return scoreB - scoreA;
          });

          const primary = list[0];
          const duplicates = list.slice(1);

          // Merge tags and other info into primary
          const allTags = new Set(primary.tags || []);
          let mergedNotes = primary.notes || "";
          
          for (const dupe of duplicates) {
            (dupe.tags || []).forEach(t => allTags.add(t));
            if (dupe.notes) mergedNotes += "\n" + dupe.notes;
          }

          await Contact.findByIdAndUpdate(primary._id, {
            phone, // Ensure primary is also normalized
            tags: Array.from(allTags),
            notes: mergedNotes.trim()
          });

          // Delete duplicates
          const dupeIds = duplicates.map(d => d._id);
          await Contact.deleteMany({ _id: { $in: dupeIds } });
          
          totalMerged += duplicates.length;
        }
      }
    }

    console.log(`\nCleanup Complete!`);
    console.log(`- Normalized: ${totalFixed} contacts`);
    console.log(`- Merged & Deleted: ${totalMerged} duplicates`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error during deduplication:", err);
    process.exit(1);
  }
}

deduplicate();
