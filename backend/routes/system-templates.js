const express = require("express");
const router = express.Router();
const systemTemplateController = require("../controllers/systemTemplateController");
const auth = require("../middleware/auth"); // Fixed path: middleware (singular)

router.get("/", auth, systemTemplateController.getAll);
router.post("/", auth, systemTemplateController.create);
router.put("/:id", auth, systemTemplateController.update);
router.delete("/:id", auth, systemTemplateController.delete);

module.exports = router;
