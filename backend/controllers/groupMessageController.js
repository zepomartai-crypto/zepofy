const { sendTemplateToGroup } = require('../services/internationalCampaignProcessor');
const ContactGroup = require('../models/ContactGroup');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const auth = require('../middleware/auth');

class GroupMessageController {
  // Add contacts to group (Legacy/Compatibility)
  async addMembers(req, res) {
    try {
      const { groupId, members = [] } = req.body;
      const userId = req.user?._id || req.userId;

      if (!groupId || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Group ID and members array are required'
        });
      }

      const updated = await ContactGroup.findOneAndUpdate(
        { _id: groupId, userId },
        { $addToSet: { contactIds: { $each: members } } },
        { new: true }
      ).populate('members');

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      res.json({
        success: true,
        message: 'Members added successfully',
        group: updated
      });
    } catch (error) {
      console.error('❌ Add members error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add members to group',
        error: error.message
      });
    }
  }

  // PROBLEM 1 & 3: Add contacts to group (Specific requirement)
  async addContacts(req, res) {
    try {
      const { groupId, contactIds = [], selectAll = false, filters = {} } = req.body;
      const userId = req.user?._id || req.userId;

      if (!groupId) {
        return res.status(400).json({ success: false, message: 'groupId is required' });
      }

      let targetIds = contactIds;

      if (selectAll) {
        const q = { userId };
        if (filters.search) {
          const re = new RegExp(filters.search, "i");
          q.$or = [{ name: re }, { phone: re }, { tags: re }];
        }
        if (filters.groupId) {
          const group = await ContactGroup.findOne({ _id: filters.groupId, userId });
          if (group) q._id = { $in: group.contactIds };
        }
        if (filters.source) q.source = filters.source;
        if (filters.tag) q.tags = { $in: [filters.tag] };

        const allMatching = await Contact.find(q).select("_id");
        targetIds = allMatching.map(c => c._id);
      }

      if (!Array.isArray(targetIds) || targetIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request: contactIds array required'
        });
      }

      // Add contacts using $addToSet to prevent duplicates
      const updated = await ContactGroup.findOneAndUpdate(
        { _id: groupId, userId },
        { $addToSet: { contactIds: { $each: targetIds } } },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // Update member count
      updated.memberCount = updated.contactIds.length;
      await updated.save();

      // 🔥 UPDATE CONTACTS TO REFLECT NEW PRIMARY GROUP
      await Contact.updateMany(
        { _id: { $in: targetIds } },
        { $set: { groupId: updated._id } }
      );

      res.json({
        success: true,
        message: 'Contacts added successfully'
      });
    } catch (error) {
      console.error('❌ addContacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add contacts to group',
        error: error.message
      });
    }
  }

  // PROBLEM 2: Create group + Add contacts
  async createWithContacts(req, res) {
    try {
      const { groupName, contactIds = [], selectAll = false, filters = {} } = req.body;
      const userId = req.user?._id || req.userId;

      if (!groupName) {
        return res.status(400).json({
          success: false,
          message: 'Group name is required'
        });
      }

      let targetIds = contactIds;

      if (selectAll) {
        const q = { userId };
        if (filters.search) {
          const re = new RegExp(filters.search, "i");
          q.$or = [{ name: re }, { phone: re }, { tags: re }];
        }
        if (filters.source) q.source = filters.source;
        if (filters.tag) q.tags = { $in: [filters.tag] };

        const allMatching = await Contact.find(q).select("_id");
        targetIds = allMatching.map(c => c._id);
      }

      // Create group and add contacts immediately
      const uniqueContactIds = [...new Set(targetIds)];

      const group = await ContactGroup.create({
        userId,
        name: groupName.trim(),
        contactIds: uniqueContactIds,
        memberCount: uniqueContactIds.length
      });

      // 🔥 UPDATE CONTACTS TO REFLECT NEW PRIMARY GROUP
      await Contact.updateMany(
        { _id: { $in: uniqueContactIds } },
        { $set: { groupId: group._id } }
      );

      res.json({
        success: true,
        message: 'Group created and contacts added',
        group
      });
    } catch (error) {
      console.error('❌ createWithContacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create group and add contacts',
        error: error.message
      });
    }
  }

  // Send template to group
  async sendTemplateToGroup(req, res) {
    try {
      await sendTemplateToGroup(req, res);
    } catch (error) {
      console.error('❌ Group message controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send template to group',
        error: error.message
      });
    }
  }

  // Get group message status
  async getGroupMessageStatus(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user?._id || req.userId;

      // Get group info
      const group = await ContactGroup.findOne({
        _id: groupId,
        userId
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // Get messages for this group
      const messages = await Message.find({
        groupId: groupId,
        userId
      })
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(100);

      // Calculate statistics
      const stats = {
        total: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        failed: messages.filter(m => m.status === 'failed').length,
        pending: messages.filter(m => m.status === 'pending').length
      };

      res.json({
        success: true,
        data: {
          group: {
            _id: group._id,
            name: group.name,
            contactCount: group.contactIds?.length || 0
          },
          stats,
          messages: messages.map(msg => ({
            _id: msg._id,
            contact: msg.customerId,
            templateName: msg.content?.templateName,
            status: msg.status,
            sentAt: msg.sentAt,
            error: msg.error
          }))
        }
      });

    } catch (error) {
      console.error('❌ Get group message status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get group message status',
        error: error.message
      });
    }
  }
}

module.exports = new GroupMessageController();
