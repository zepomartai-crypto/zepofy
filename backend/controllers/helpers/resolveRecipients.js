const Contact = require("../../models/Contact");
const ContactGroup = require("../../models/ContactGroup");

module.exports = async function resolveRecipients({
  userId,
  audienceType,
  groupIds = []
}) {
  let contacts = [];

  if (audienceType === "group" && groupIds.length) {
    const groups = await ContactGroup.find({
      _id: { $in: groupIds },
      userId
    });

    const contactIds = groups.flatMap(g => g.contactIds || []);

    contacts = await Contact.find({
      _id: { $in: contactIds },
      userId
    });
  } else {
    contacts = await Contact.find({ userId });
  }

  return contacts.map(c => ({
    contactId: c._id,
    phone: c.phone,
    status: "pending"
  }));
};
