const router = require("express").Router();
const auth = require("../middleware/auth");
const flowRunController = require("../controllers/flowRunController");

router.post("/start", auth, flowRunController.startFlow);
router.post("/reply", auth, flowRunController.handleReply);

module.exports = router;
