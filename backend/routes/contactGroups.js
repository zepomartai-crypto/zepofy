// routes/contactGroups.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/contactGroupController");

router.get("/", auth, ctrl.getGroups);
router.get("/:id", auth, ctrl.getGroupDetails);
router.post("/", auth, ctrl.createGroup);
router.put("/:id", auth, ctrl.updateGroup);
router.post("/add-members", auth, ctrl.addMembers);
router.post("/add-new-contact", auth, ctrl.addNewContactToGroup);

// ✅ THIS WAS MISSING — VERY IMPORTANT
router.delete("/:id", auth, ctrl.deleteGroup);

module.exports = router;
