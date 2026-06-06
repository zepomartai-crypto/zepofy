const express = require("express");
const router = express.Router();
const tagController = require("../controllers/tag.controller");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", tagController.getTags);
router.post("/", tagController.createTag);
router.put("/:id", tagController.updateTag);
router.delete("/:id", tagController.deleteTag);

module.exports = router;
