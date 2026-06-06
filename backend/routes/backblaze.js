const express = require('express');
const router = express.Router();
const backblazeController = require('../controllers/backblazeController');
const { upload, uploadMultiple } = backblazeController;

/**
 * @route   POST /api/backblaze/upload
 * @desc    Upload single file to Backblaze B2
 * @access   Private
 */
router.post('/upload', upload.single('file'), backblazeController.uploadFile);

/**
 * @route   POST /api/backblaze/upload-multiple
 * @desc    Upload multiple files to Backblaze B2
 * @access   Private
 */
router.post('/upload-multiple', uploadMultiple, backblazeController.uploadMultipleFiles);

/**
 * @route   POST /api/backblaze/backup
 * @desc    Upload backup data to Backblaze B2
 * @access   Private
 */
router.post('/backup', backblazeController.uploadBackup);

/**
 * @route   DELETE /api/backblaze/file/:fileName
 * @desc    Delete file from Backblaze B2
 * @access   Private
 */
router.delete('/file/:fileName', backblazeController.deleteFile);

/**
 * @route   GET /api/backblaze/file/:fileName/signed-url
 * @desc    Get signed URL for private file
 * @access   Private
 */
router.get('/file/:fileName/signed-url', backblazeController.getSignedUrl);

/**
 * @route   GET /api/backblaze/file/:fileName/info
 * @desc    Get file information
 * @access   Private
 */
router.get('/file/:fileName/info', backblazeController.getFileInfo);

/**
 * @route   POST /api/backblaze/system-backup
 * @desc    Trigger manual administrative system ZIP backup
 * @access   Private
 */
router.post('/system-backup', backblazeController.triggerSystemBackup);

module.exports = router;
