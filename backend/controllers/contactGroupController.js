const ContactGroup = require("../models/ContactGroup");

// ---------------- CREATE GROUP WITH CONTACTS ----------------
exports.createGroup = async (req, res) => {
  try {
    const { name, contactIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Group name required" });
    }

    // Validate contact IDs exist and belong to user
    if (contactIds.length > 0) {
      const Contact = require("../models/Contact");
      const contacts = await Contact.find({ 
        _id: { $in: contactIds },
        userId: req.userId 
      });

      if (contacts.length !== contactIds.length) {
        return res.status(400).json({ error: "Some contacts not found or don't belong to you" });
      }
    }

    const group = new ContactGroup({
      userId: req.userId,
      name: name.trim(),
      contactIds,
      memberCount: contactIds.length
    });
    
    await group.save();

    res.json({ 
      success: true, 
      message: `Group "${name}" created successfully`,
      group,
      groupId: group._id 
    });
  } catch (err) {
    console.error("createGroup error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
};

// ---------------- LIST GROUPS ----------------
exports.getGroups = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: req.userId };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { _id: search.match(/^[0-9a-fA-F]{24}$/) ? search : undefined }
      ].filter(Boolean);
    }

    const [groups, total] = await Promise.all([
      ContactGroup.find(query)
        .populate("members")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ContactGroup.countDocuments(query)
    ]);

    const formattedGroups = groups.map((g) => {
      const gObj = g.toObject(); // To apply virtuals
      return {
        ...gObj,
        membersCount: g.members ? g.members.length : (gObj.contactIds ? gObj.contactIds.length : 0),
      };
    });

    res.json({
      success: true,
      groups: formattedGroups,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error("getGroups error:", err);
    res.status(500).json({ error: "Failed to load groups" });
  }
};

// ---------------- UPDATE GROUP ----------------
exports.updateGroup = async (req, res) => {
  try {
    const { name, contactIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Group name required" });
    }

    const group = await ContactGroup.findOne({ _id: req.params.id, userId: req.userId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    group.name = name.trim();
    group.contactIds = contactIds;
    group.memberCount = contactIds.length;
    await group.save();

    res.json({ success: true, group });
  } catch (err) {
    console.error("updateGroup error:", err);
    res.status(500).json({ error: "Failed to update group" });
  }
};

// ---------------- ADD MEMBERS TO GROUP (Bulk) ----------------
exports.addMembers = async (req, res) => {
  try {
    const { groupId, contactIds = [] } = req.body;

    if (!groupId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "Invalid request: groupId and contactIds array required" });
    }

    const group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Validate contact IDs exist and belong to user
    if (contactIds.length > 0) {
      const Contact = require("../models/Contact");
      const contacts = await Contact.find({ 
        _id: { $in: contactIds },
        userId: req.userId 
      });

      if (contacts.length !== contactIds.length) {
        return res.status(400).json({ error: "Some contacts not found or don't belong to you" });
      }
    }

    // Use a Set locally to ensure uniqueness before saving
    const currentIds = group.contactIds.map(id => id.toString());
    const newIds = contactIds.filter(id => !currentIds.includes(id.toString()));
    
    if (newIds.length > 0) {
      group.contactIds.push(...newIds);
      group.memberCount = group.contactIds.length;
      await group.save();
    }

    res.json({ 
      success: true, 
      message: `${newIds.length} contacts added to group successfully`,
      addedCount: newIds.length,
      alreadyInGroup: contactIds.length - newIds.length,
      totalMembers: group.memberCount,
      group 
    });
  } catch (err) {
    console.error("addMembers error:", err);
    res.status(500).json({ error: "Failed to add members to group" });
  }
};

// ---------------- GET GROUP DETAILS WITH MEMBERS ----------------
exports.getGroupDetails = async (req, res) => {
  try {
    const group = await ContactGroup.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    })
      .populate("members", "name phone email")
      .sort({ createdAt: -1 });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const groupObj = group.toObject();
    
    res.json({ 
      success: true, 
      group: {
        ...groupObj,
        members: group.members || []
      }
    });
  } catch (err) {
    console.error("getGroupDetails error:", err);
    res.status(500).json({ error: "Failed to load group details" });
  }
};

// ---------------- ADD NEW CONTACT TO GROUP ----------------
exports.addNewContactToGroup = async (req, res) => {
  try {
    const { groupId, name, phone, email } = req.body;

    // Validation
    if (!groupId || !name || !phone) {
      return res.status(400).json({ 
        error: "Group ID, name, and phone number are required" 
      });
    }

    // Validate group exists and belongs to user
    const group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Create new contact
    const Contact = require("../models/Contact");
    const newContact = await Contact.create({
      userId: req.userId,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined
    });

    // Add contact to group
    const contactId = newContact._id.toString();
    const currentIds = group.contactIds.map(id => id.toString());
    
    // Prevent duplicates
    if (!currentIds.includes(contactId)) {
      group.contactIds.push(newContact._id);
      group.memberCount = group.contactIds.length;
      await group.save();
    }

    res.json({ 
      success: true, 
      message: "Contact created and added to group",
      contact: newContact,
      group 
    });
  } catch (err) {
    console.error("addNewContactToGroup error:", err);
    res.status(500).json({ error: "Failed to add contact to group" });
  }
};

// ---------------- DELETE GROUP ----------------
exports.deleteGroup = async (req, res) => {
  try {
    const deleted = await ContactGroup.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId, // ✅ IMPORTANT
    });

    if (!deleted) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ 
      success: true, 
      message: `Group "${deleted.name}" deleted successfully`,
      deletedGroupId: deleted._id 
    });
  } catch (err) {
    console.error("deleteGroup error:", err);
    res.status(500).json({ error: "Failed to delete group" });
  }
};
