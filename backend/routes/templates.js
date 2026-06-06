const router = require("express").Router();
const auth = require("../middleware/auth");
const { checkLimits, checkPermission } = require("../middleware/resourceLimits.middleware.js");
const templateController = require("../controllers/templateController");

// 🔐 AUTH REQUIRED FOR ALL
router.use(auth);
router.use(checkPermission("templates"));

// ================= CREATE TEMPLATE =================
// Supports standard JSON (Image upload is now handled via /api/upload/template-image)
router.post(
  "/",
  checkLimits("template"),
  templateController.createTemplate
);

// ================= LIST =================
router.get("/", templateController.listTemplates);

// ================= DELETE (DRAFT ONLY) =================
router.delete("/:id", templateController.deleteTemplate);

// ================= VALIDATE DELETE =================
router.get("/:id/validate-delete", templateController.validateDelete);

// ================= SUBMIT TO META =================
router.post("/:id/submit", templateController.submitForApproval);

// ================= SYNC META =================
router.get("/sync/meta", templateController.syncMetaTemplates);

// ================= UPDATE TEMPLATE =================
router.put(
  "/:id",
  templateController.updateTemplate
);

module.exports = router;
