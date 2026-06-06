// controllers/contactController.js
const Contact = require("../models/Contact");
const ContactGroup = require("../models/ContactGroup");
const Message = require("../models/Message");
const fs = require("fs");
const csv = require("csv-parser");
const flowEngine = require("../modules/flowBuilder/flow.engine");
const { normalizePhone } = require("../utils/phoneNormalizer");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");


const xlsx = require("xlsx");

exports.importContacts = async (req, res) => {
  try {
    const filePath = req.file.path;

    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });

      let imported = 0;
      let skipped = 0;
      const failedRows = [];
      const { groupId, newGroupName } = req.body;

      let targetGroupId = groupId;

      // 🔥 CREATE NEW GROUP
      if (newGroupName) {
        try {
          const group = await ContactGroup.create({
            userId: req.userId,
            name: newGroupName.trim(),
            contactIds: []
          });
          targetGroupId = group._id;
          console.log(`✅ New group created during import: ${newGroupName} (${targetGroupId})`);
        } catch (groupErr) {
          console.error("❌ Failed to create group during import:", groupErr.message);
        }
      }

      // Check if first row is a header
      let startIdx = 0;
      if (rows.length > 0) {
        const firstRowStr = rows[0].map(c => String(c).toLowerCase()).join(' ');
        if (firstRowStr.includes('phone') || firstRowStr.includes('mobile') || firstRowStr.includes('name') || firstRowStr.includes('number') || firstRowStr.includes('contact')) {
          startIdx = 1;
        }
      }

      // Pre-process rows
      const validRowsToProcess = [];
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        let rawPhone = null;
        let name = null;

        // Scan all cells in the row to find phone and name
        for (let j = 0; j < row.length; j++) {
          const cellValue = String(row[j]).trim();
          if (!cellValue) continue;

          const digitsOnly = cellValue.replace(/\D/g, '');
          if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
            if (!rawPhone) {
              rawPhone = cellValue;
            }
          } else {
            if (!name && isNaN(cellValue)) {
              name = cellValue;
            }
          }
        }

        // If no rawPhone found via the strict check, look for any cell with digits
        if (!rawPhone) {
          for (let j = 0; j < row.length; j++) {
            const cellValue = String(row[j]).trim();
            if (/\d/.test(cellValue)) {
              rawPhone = cellValue;
              break;
            }
          }
        }

        if (!name) name = "Unknown";

        if (!rawPhone) {
          skipped++;
          const possibleName = row.filter(c => String(c).trim()).join(' ');
          if (possibleName) {
            failedRows.push({ name: name !== 'Unknown' ? name : (possibleName.substring(0, 30) || 'Unknown'), phone: 'Missing', reason: 'No phone number found in row' });
          }
          continue;
        }

        const phone = normalizePhone(rawPhone);

        if (!phone || phone.length < 11) {
          skipped++;
          failedRows.push({ name: name, phone: rawPhone, reason: 'Invalid or short phone number' });
          continue;
        }

        validRowsToProcess.push({ name, phone, rawPhone });
      }

      if (validRowsToProcess.length > 0) {
        const ops = validRowsToProcess.map(item => ({
          updateOne: {
            filter: { userId: req.userId, phone: item.phone },
            update: {
              $setOnInsert: {
                userId: req.userId,
                name: item.name ? item.name.trim() : "Unknown",
                phone: item.phone,
                tags: [],
                source: "CSV_IMPORT",
                createdAt: new Date()
              }
            },
            upsert: true
          }
        }));

        // Execute all writes instantly
        const result = await Contact.bulkWrite(ops, { ordered: false });
        
        const upsertedCount = result.upsertedCount || 0;
        const matchedCount = result.matchedCount || 0;

        imported = upsertedCount;

        const newIndexes = new Set(Object.keys(result.upsertedIds || {}).map(Number));

        if (targetGroupId) {
           imported += matchedCount;
           
           // Fetch all matching IDs to put in the group
           const allPhones = validRowsToProcess.map(i => i.phone);
           const allDocs = await Contact.find({ userId: req.userId, phone: { $in: allPhones } }, { _id: 1 });
           const allIds = allDocs.map(c => c._id);
           
           if (allIds.length > 0) {
             await ContactGroup.updateOne(
               { _id: targetGroupId, userId: req.userId },
               { $addToSet: { contactIds: { $each: allIds } } }
             );
           }
        } else {
           skipped += matchedCount;
           validRowsToProcess.forEach((item, idx) => {
              if (!newIndexes.has(idx)) {
                 failedRows.push({ name: item.name, phone: item.phone, reason: 'Contact already exists' });
              }
           });
        }

        // Fire flows asynchronously to not block the response
        setTimeout(() => {
          newIndexes.forEach(idx => {
            try {
               flowEngine.triggerFlowByType(req.userId, validRowsToProcess[idx].phone, "contact");
            } catch (e) {}
          });
        }, 100);
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        summary: { imported, skipped, total: rows.length - startIdx },
        failedRows
      });

    } catch (parseErr) {
      console.error("File parse error:", parseErr);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Failed to parse file. Please ensure it is a valid CSV or Excel file." });
    }
  } catch (err) {
    console.error("importContacts error:", err);
    res.status(500).json({ error: "Import failed" });
  }
};


// GET CONTACTS
exports.getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      groupId = "",
      fromDate = "",
      toDate = "",
      source = "",
      tag = "",
      tags = "", // comma-separated
      unread = "all", // all, unread_only, read_only
      replyStatus = "all", // all, replied, no_reply, awaiting, bot, human
      campaignId = "",
      campaignReply = "",
      assignedTo = "",
      flowStatus = "",
      messageType = "",
      contactType = "",
      dateRange = "all", // today, yesterday, last7, last30, custom
      sortBy = "lastMessageTime",
      sortOrder = "desc"
    } = req.query;

    const q = { userId: req.userId };

    // 🔍 SEARCH FILTER
    if (search) {
      // Escape special regex characters to prevent crashes (e.g. searching "+91")
      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const safeSearch = escapeRegExp(search);

      const searchTerms = [safeSearch];

      // If searching for something that looks like a phone number, normalize it
      const numericSearch = search.replace(/\D/g, "");
      if (numericSearch.length >= 5) {
        searchTerms.push(escapeRegExp(normalizePhone(numericSearch) || ""));
        searchTerms.push(numericSearch); // Also try without '+' for older data
      }

      // Filter out empty strings and create Regex
      const validSearchTerms = searchTerms.filter(t => t);
      
      const re = new RegExp(safeSearch, "i");
      q.$or = [
        { name: re },
        { phone: { $in: validSearchTerms.map(t => new RegExp(t, "i")) } },
        { tags: re }
      ];
    }

    // 🔥 GROUP FILTER
    if (groupId) {
      const group = await ContactGroup.findOne({
        _id: groupId,
        userId: req.userId,
      });
      if (group) {
        q._id = { $in: group.contactIds };
      }
    }

    // 📅 DATE RANGE FILTER
    if (fromDate || toDate) {
      q.createdAt = {};
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        q.createdAt.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        q.createdAt.$lte = end;
      }
    }

    // 🏷️ SOURCE FILTER
    if (source) {
      q.source = source;
    }

    // 🏷️ TAG FILTER
    if (tag) {
      q.tags = { $in: [tag] };
    }
    if (tags) {
      const tagList = tags.split(",").map(t => t.trim());
      q.tags = { $all: tagList };
    }

    // 📅 ADVANCED DATE FILTER
    if (dateRange !== "all") {
      const now = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      if (dateRange === "today") {
        q.lastMessageTime = { $gte: start };
      } else if (dateRange === "yesterday") {
        const yesterdayStart = new Date(start);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        q.lastMessageTime = { $gte: yesterdayStart, $lt: start };
      } else if (dateRange === "last7") {
        const last7 = new Date(start);
        last7.setDate(last7.getDate() - 7);
        q.lastMessageTime = { $gte: last7 };
      } else if (dateRange === "last30") {
        const last30 = new Date(start);
        last30.setDate(last30.getDate() - 30);
        q.lastMessageTime = { $gte: last30 };
      }
    } else if (fromDate || toDate) {
      q.lastMessageTime = {};
      if (fromDate) q.lastMessageTime.$gte = new Date(fromDate);
      if (toDate) q.lastMessageTime.$lte = new Date(toDate);
    }

    // 🔔 UNREAD FILTER
    if (unread === "unread_only") q.unreadCount = { $gt: 0 };
    if (unread === "read_only") q.unreadCount = 0;

    // 💬 REPLY STATUS FILTER
    if (replyStatus === "replied") q.lastSender = { $in: ["admin", "bot"] };
    if (replyStatus === "no_reply") q.lastSender = "customer";
    if (replyStatus === "awaiting") q.lastSender = "customer";
    if (replyStatus === "bot") q.lastSender = "bot";
    if (replyStatus === "human") q.lastSender = "admin";

    // 📢 CAMPAIGN FILTER
    if (campaignId) q.lastCampaignId = campaignId;
    if (campaignReply === "true") q.campaignReplied = true;
    if (campaignReply === "false") q.campaignReplied = false;

    // 👤 ASSIGNED AGENT
    if (assignedTo === "unassigned") q.assignedTo = { $exists: false };
    else if (assignedTo) q.assignedTo = assignedTo;

    // 🌊 FLOW FILTER
    if (flowStatus) q.flowStatus = flowStatus;

    // 📁 MESSAGE TYPE
    if (messageType) q.lastMessageType = messageType;

    // 🆕 CONTACT TYPE
    if (contactType === "new") q.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    else if (contactType === "returning") q.createdAt = { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    else if (contactType === "imported") q.source = "CSV_IMPORT";
    else if (contactType === "manual") q.source = "MANUAL";

    const total = await Contact.countDocuments(q);

    // 🔥 GLOBAL SELECT SUPPORT: If all=true, return all matching IDs for selection
    if (req.query.all === "true") {
      const allContacts = await Contact.find(q).select("_id");
      return res.json({ success: true, contactIds: allContacts.map(c => c._id), total });
    }

    const skip = (page - 1) * limit;

    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    const contacts = await Contact.find(q)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    // ✅ NOTE: We now use the 'unreadCount' field directly from the Contact model
    // which is updated in real-time by the webhook. This is much faster than
    // aggregating the Message collection on every request.
    const contactsWithUnread = contacts.map(contact => {
      const contactObj = contact.toObject ? contact.toObject() : contact;
      return {
        ...contactObj,
        unreadCount: contactObj.unreadCount || 0,
      };
    });

    res.json({ success: true, contacts: contactsWithUnread, total });
  } catch (err) {
    console.error("getContacts error:", err);
    res.status(500).json({ error: "Failed to load contacts" });
  }
};

// GET SINGLE CONTACT
exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({ success: true, contact });
  } catch (err) {
    console.error("getContact error:", err);
    res.status(500).json({ error: "Failed to load contact" });
  }
};

// ADD CONTACT
exports.addContact = async (req, res) => {
  try {
    let { name, phone: rawPhone, tags = [], groupId, newGroupName } = req.body;

    if (!name || !rawPhone) {
      return res.status(400).json({ error: "Name and phone required" });
    }

    const phone = normalizePhone(rawPhone);
    if (!phone || phone.length < 11) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const exists = await Contact.findOne({
      userId: req.userId,
      phone,
    });

    if (exists) {
      return res.status(400).json({ error: "Phone already exists" });
    }

    const contact = await Contact.create({
      userId: req.userId,
      name: name.trim(),
      phone,
      tags,
    });

    // 🔥 ASSIGN TO GROUP: Handle both existing groupId and newGroupName creation
    let targetGroupId = groupId;
    if (newGroupName) {
      try {
        const group = await ContactGroup.create({
          userId: req.userId,
          name: newGroupName.trim(),
          contactIds: [contact._id]
        });
        targetGroupId = group._id;
        console.log(`✅ New group created: ${newGroupName} (${targetGroupId})`);
      } catch (groupErr) {
        console.error("❌ Failed to create group during manual contact add:", groupErr.message);
      }
    } else if (targetGroupId) {
      await ContactGroup.updateOne(
        { _id: targetGroupId, userId: req.userId },
        { $addToSet: { contactIds: contact._id } }
      );
    }

    // 🔥 TRIGGER: New Contact Added Flow (Manual)
    try {
      const integration = await WhatsAppIntegration.findOne({ userId: req.userId });
      if (integration) {
        // We call this in the background/async
        flowEngine.triggerFlowByType(req.userId, phone, "contact", { contactId: contact._id });
      }
    } catch (flowErr) {
      console.warn("⚠️ Flow Trigger failed for manual contact:", flowErr.message);
    }

    res.json({ success: true, contact });
  } catch (err) {
    console.error("addContact error:", err);
    res.status(500).json({ error: "Failed to add contact" });
  }
};


// DELETE CONTACT
exports.deleteContact = async (req, res) => {
  try {
    const deleted = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (deleted) {
      // ✅ CLEANUP: Remove contact from all groups
      await ContactGroup.updateMany(
        { userId: req.userId },
        { $pull: { contactIds: deleted._id } }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteContact error:", err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
};


// CREATE GROUP
exports.createGroup = async (req, res) => {
  const { name, contactIds = [] } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Group name required" });
  }

  const group = await ContactGroup.create({
    userId: req.userId,
    name,
    contactIds
  });

  res.json({ success: true, group });
};

// LIST GROUPS
exports.getGroups = async (req, res) => {
  const groups = await ContactGroup.find({
    userId: req.userId
  }).sort({ createdAt: -1 });

  // Add member count to each group
  const groupsWithCount = groups.map(group => ({
    ...group.toObject(),
    memberCount: group.contactIds ? group.contactIds.length : 0
  }));

  res.json({ groups: groupsWithCount });
};

// ADD CONTACTS TO GROUP
exports.addToGroup = async (req, res) => {
  const { groupId, contactIds = [] } = req.body;

  await ContactGroup.updateOne(
    { _id: groupId, userId: req.userId },
    { $addToSet: { contactIds: { $each: contactIds } } }
  );

  res.json({ success: true });
};


// UPDATE CONTACT (WITH GROUP CHANGE SUPPORT)
exports.updateContact = async (req, res) => {
  try {
    const { name, phone: rawPhone, tags = [], groupId, notes } = req.body;

    // Build update object dynamically - only include fields present in request
    const updateData = {};

    if (req.body.hasOwnProperty('name')) updateData.name = name.trim();
    if (req.body.hasOwnProperty('tags')) updateData.tags = tags;
    if (req.body.hasOwnProperty('notes')) updateData.notes = notes;
    if (req.body.hasOwnProperty('isBlocked')) updateData.isBlocked = req.body.isBlocked;
    if (rawPhone) updateData.phone = normalizePhone(rawPhone);

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updateData },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    console.log(`✅ Contact updated: ${contact.name}`, {
      tags: contact.tags,
      notes: contact.notes,
      groupId
    });

    // 🔥 ONLY UPDATE GROUPS IF groupId IS EXPLICITLY PASSED (even if empty string)
    if (req.body.hasOwnProperty('groupId')) {
      // STEP 1: Remove contact from ALL groups
      await ContactGroup.updateMany(
        { userId: req.userId },
        { $pull: { contactIds: contact._id } }
      );

      // STEP 2: Add contact to selected group (if not empty)
      if (groupId) {
        await ContactGroup.updateOne(
          { _id: groupId, userId: req.userId },
          { $addToSet: { contactIds: contact._id } }
        );
        console.log(`✅ Contact added to group: ${groupId}`);
      }
    }

    res.json({ success: true, contact });
  } catch (err) {
    console.error("updateContact error:", err);
    res.status(500).json({ error: "Failed to update contact" });
  }
};


// 🔥 NEW: Update contact groups specifically
exports.updateContactGroups = async (req, res) => {
  try {
    const { groupId } = req.body;
    const contactId = req.params.id;

    const contact = await Contact.findOne({
      _id: contactId,
      userId: req.userId
    });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // 🔥 STEP 1: Remove contact from ALL groups
    await ContactGroup.updateMany(
      { userId: req.userId },
      { $pull: { contactIds: contact._id } }
    );

    // 🔥 STEP 2: Add contact to selected group
    if (groupId) {
      await ContactGroup.updateOne(
        { _id: groupId, userId: req.userId },
        { $addToSet: { contactIds: contact._id } }
      );
      console.log(`✅ Contact ${contact.name} added to group: ${groupId}`);
    }

    // 🔥 STEP 3: Return updated contact with group info
    const updatedContact = await Contact.findOne({
      _id: contactId,
      userId: req.userId
    });

    res.json({ success: true, contact: updatedContact });
  } catch (err) {
    console.error("updateContactGroups error:", err);
    res.status(500).json({ error: "Failed to update contact groups" });
  }
};


// 🔥 NEW: Bulk actions (Delete/Group/Tag)
exports.bulkAction = async (req, res) => {
  try {
    const { action, contactIds = [], groupId, tag, selectAll = false, filters = {} } = req.body;

    let targetIds = contactIds;

    // If selectAll is true, we need to find all IDs matching the filters
    if (selectAll) {
      const q = { userId: req.userId };
      if (filters.search) {
        const re = new RegExp(filters.search, "i");
        q.$or = [{ name: re }, { phone: re }, { tags: re }];
      }
      if (filters.groupId) {
        const group = await ContactGroup.findOne({ _id: filters.groupId, userId: req.userId });
        if (group) q._id = { $in: group.contactIds };
      }
      if (filters.source) q.source = filters.source;
      if (filters.tag) q.tags = { $in: [filters.tag] };

      const allMatching = await Contact.find(q).select("_id");
      targetIds = allMatching.map(c => c._id);
    }

    if (targetIds.length === 0) {
      return res.status(400).json({ error: "No contacts selected" });
    }

    if (action === "DELETE") {
      await Contact.deleteMany({ _id: { $in: targetIds }, userId: req.userId });
      // Cleanup groups
      await ContactGroup.updateMany(
        { userId: req.userId },
        { $pull: { contactIds: { $in: targetIds } } }
      );
    } else if (action === "ADD_TO_GROUP") {
      if (!groupId) return res.status(400).json({ error: "Group ID required" });
      await ContactGroup.updateOne(
        { _id: groupId, userId: req.userId },
        { $addToSet: { contactIds: { $each: targetIds } } }
      );
    } else if (action === "ADD_TAG") {
      if (!tag) return res.status(400).json({ error: "Tag required" });
      await Contact.updateMany(
        { _id: { $in: targetIds }, userId: req.userId },
        { $addToSet: { tags: tag } }
      );
    }

    res.json({ success: true, count: targetIds.length });
  } catch (err) {
    console.error("bulkAction error:", err);
    res.status(500).json({ error: "Bulk action failed" });
  }
};

// 🔥 NEW: Get all unique tags for user
exports.getTags = async (req, res) => {
  try {
    const tags = await Contact.distinct("tags", { userId: req.userId });
    res.json({ success: true, tags: tags.filter(Boolean) });
  } catch (err) {
    console.error("getTags error:", err);
    res.status(500).json({ error: "Failed to load tags" });
  }
};

// 🔥 NEW: Get total unread count for the user
exports.getUnreadTotal = async (req, res) => {
  try {
    const unreadCounts = await Message.countDocuments({
      userId: req.userId,
      direction: 'incoming',
      isRead: false
    });
    res.json({ success: true, total: unreadCounts });
  } catch (err) {
    console.error("getUnreadTotal error:", err);
    res.status(500).json({ error: "Failed to load unread count" });
  }
};
