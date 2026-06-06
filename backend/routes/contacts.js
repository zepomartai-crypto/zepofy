const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth"); // 🔥 MUST be function
const { checkLimits, checkPermission } = require("../middleware/resourceLimits.middleware.js");
const contactController = require("../controllers/contactController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// ROUTES
router.use(auth);
router.use(checkPermission("contacts"));

router.get("/", contactController.getContacts);
router.get("/unread-total", contactController.getUnreadTotal);
router.get("/tags", contactController.getTags);
router.post("/", checkLimits("contact"), contactController.addContact);


router.put("/:id", contactController.updateContact);

// 🔥 NEW: Update contact groups specifically
router.put("/:id/groups", contactController.updateContactGroups);


router.post("/bulk-action", contactController.bulkAction);
router.delete("/:id", contactController.deleteContact);
router.post(
  "/import",
  checkLimits("contact"),
  upload.single("file"),
  contactController.importContacts
);


module.exports = router;
