const BackblazeService = require('../services/backblazeService');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  }
});

/**
 * Upload single file to Backblaze B2
 */
exports.uploadFile = async (req, res) => {
  try {
    const { folder = 'zepofy' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log(`📤 Uploading file: ${req.file.originalname}`);

    const result = await BackblazeService.uploadFromBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileId: result.data.fileId,
          fileName: result.data.fileName,
          publicUrl: result.data.publicUrl,
          size: result.data.size,
          contentType: result.data.contentType,
          uploadTimestamp: result.data.uploadTimestamp
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Upload controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during upload'
    });
  }
};

/**
 * Upload multiple files to Backblaze B2
 */
exports.uploadMultipleFiles = async (req, res) => {
  try {
    const { folder = 'zepofy' } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    console.log(`📤 Uploading ${req.files.length} files`);

    const files = req.files.map(file => ({
      buffer: file.buffer,
      name: file.originalname,
      contentType: file.mimetype
    }));

    const results = await BackblazeService.uploadMultiple(files, folder);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      message: `Uploaded ${successful.length}/${files.length} files successfully`,
      data: {
        successful: successful.map(r => r.data),
        failed: failed.map(r => ({ error: r.error, name: r.name })),
        summary: {
          total: files.length,
          successful: successful.length,
          failed: failed.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Multiple upload controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during upload'
    });
  }
};

/**
 * Upload backup data to Backblaze B2
 */
exports.uploadBackup = async (req, res) => {
  try {
    const { backupType, fileName, data } = req.body;
    
    if (!backupType || !fileName || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: backupType, fileName, data'
      });
    }

    console.log(`💾 Creating backup: ${backupType}/${fileName}`);

    const result = await BackblazeService.uploadBackup(data, backupType, fileName);

    if (result.success) {
      res.json({
        success: true,
        message: 'Backup uploaded successfully',
        data: {
          backupUrl: result.data.publicUrl,
          fileName: result.data.fileName,
          size: result.data.size,
          uploadTimestamp: result.data.uploadTimestamp
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Backup controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during backup'
    });
  }
};

/**
 * Delete file from Backblaze B2
 */
exports.deleteFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'File name is required'
      });
    }

    console.log(`🗑️ Deleting file: ${fileName}`);

    const result = await BackblazeService.deleteFile(fileName);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Delete controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during deletion'
    });
  }
};

/**
 * Get signed URL for private file
 */
exports.getSignedUrl = async (req, res) => {
  try {
    const { fileName } = req.params;
    const { expiresIn = 3600 } = req.query;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'File name is required'
      });
    }

    const signedUrl = await BackblazeService.getSignedUrl(fileName, parseInt(expiresIn));

    res.json({
      success: true,
      data: {
        signedUrl,
        expiresIn: parseInt(expiresIn)
      }
    });

  } catch (error) {
    console.error('❌ Signed URL controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error generating signed URL'
    });
  }
};

/**
 * Get file info (metadata)
 */
exports.getFileInfo = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'File name is required'
      });
    }

    // This would require implementing file listing and info retrieval
    // For now, return basic info
    res.json({
      success: true,
      data: {
        fileName,
        publicUrl: `https://f002.backblazeb2.com/file/zepofy/${fileName}`,
        message: 'File info retrieval not fully implemented'
      }
    });

  } catch (error) {
    console.error('❌ File info controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error getting file info'
    });
  }
};

// Export upload middleware for use in routes
exports.upload = upload;
exports.uploadMultiple = upload.array('files', 10); // Max 10 files

/**
 * Trigger manual system ZIP backup
 */
exports.triggerSystemBackup = async (req, res) => {
  try {
    const backupService = require('../services/backblazeService');
    const result = await backupService.performSystemBackup();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Global system backup completed successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Backup execution failed'
      });
    }
  } catch (error) {
    console.error('❌ Manual system backup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error triggering system backup'
    });
  }
};
