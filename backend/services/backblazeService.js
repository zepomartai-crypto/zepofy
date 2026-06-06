const backblazeB2 = require('../config/backblaze');
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const mongoose = require('mongoose');

const TEMP_DIR = path.join(__dirname, "../temp_backup");
const UPLOADS_PATH = path.join(__dirname, "../uploads");

/**
 * Backblaze B2 File Upload Service
 * Handles file uploads to Backblaze B2 cloud storage
 */
class BackblazeService {
  /**
   * Upload file from buffer
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Original file name
   * @param {string} contentType - MIME type
   * @param {string} folder - Folder path (default: 'zepofy')
   * @returns {Promise<Object>} - Upload result with URL
   */
  static async uploadFromBuffer(fileBuffer, fileName, contentType = 'application/octet-stream', folder = 'zepofy') {
    try {
      console.log(`📤 Uploading file from buffer: ${fileName}`);
      
      const result = await backblazeB2.uploadFile(fileBuffer, fileName, contentType, folder);
      
      console.log(`✅ File uploaded successfully: ${result.publicUrl}`);
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      console.error('❌ Buffer upload failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload file from local path
   * @param {string} filePath - Local file path
   * @param {string} folder - Folder path (default: 'zepofy')
   * @returns {Promise<Object>} - Upload result with URL
   */
  static async uploadFromPath(filePath, folder = 'zepofy') {
    try {
      console.log(`📤 Uploading file from path: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const contentType = this.getContentType(fileName);

      const result = await backblazeB2.uploadFile(fileBuffer, fileName, contentType, folder);
      
      console.log(`✅ File uploaded successfully: ${result.publicUrl}`);
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      console.error('❌ Path upload failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files
   * @param {Array} files - Array of file objects {buffer, name, contentType}
   * @param {string} folder - Folder path (default: 'zepofy')
   * @returns {Promise<Array>} - Array of upload results
   */
  static async uploadMultiple(files, folder = 'zepofy') {
    try {
      console.log(`📤 Uploading ${files.length} files...`);
      
      const results = [];
      
      for (const file of files) {
        const result = await this.uploadFromBuffer(
          file.buffer, 
          file.name, 
          file.contentType || 'application/octet-stream', 
          folder
        );
        results.push(result);
      }
      
      const successful = results.filter(r => r.success).length;
      console.log(`✅ ${successful}/${files.length} files uploaded successfully`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Multiple upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} fileName - File name
   * @returns {string} - MIME type
   */
  static getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Create backup folder structure
   * @param {string} backupType - Type of backup (e.g., 'campaigns', 'templates', 'messages')
   * @returns {string} - Folder path
   */
  static createBackupFolder(backupType) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const timestamp = Date.now();
    return `zepofy/backups/${backupType}/${date}/${timestamp}`;
  }

  /**
   * Upload backup data
   * @param {Object} data - Data to backup
   * @param {string} backupType - Type of backup
   * @param {string} fileName - File name
   * @returns {Promise<Object>} - Upload result
   */
  static async uploadBackup(data, backupType, fileName) {
    try {
      console.log(`💾 Creating backup: ${backupType}/${fileName}`);
      
      const jsonString = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonString, 'utf8');
      const folder = this.createBackupFolder(backupType);
      
      const result = await this.uploadFromBuffer(
        buffer, 
        `${fileName}.json`, 
        'application/json', 
        folder
      );
      
      if (result.success) {
        console.log(`✅ Backup uploaded: ${result.data.publicUrl}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Backup upload failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file
   * @param {string} fileName - File name in bucket
   * @returns {Promise<Object>} - Delete result
   */
  static async deleteFile(fileName) {
    try {
      console.log(`🗑️ Deleting file: ${fileName}`);
      
      await backblazeB2.deleteFile(fileName);
      
      return {
        success: true,
        message: 'File deleted successfully'
      };
      
    } catch (error) {
      console.error('❌ File deletion failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List file names in the bucket with an optional prefix
   * @param {string} prefix - Optional prefix folder
   * @returns {Promise<Array>} - List of files
   */
  static async listFileNames(prefix = '') {
    try {
      const files = await backblazeB2.listFileNames(prefix);
      return {
        success: true,
        files: files
      };
    } catch (error) {
      console.error('❌ Listing file names failed:', error.message);
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  /**
   * Get signed URL for private files
   * @param {string} fileName - File name
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} - Signed URL
   */
  static async getSignedUrl(fileName, expiresIn = 3600) {
    try {
      const url = await backblazeB2.getSignedUrl(fileName, expiresIn);
      return url;
    } catch (error) {
      console.error('❌ Failed to get signed URL:', error.message);
      throw error;
    }
  }

  /**
   * Dynamically exports all documents from all Mongoose collections as JSON
   * @param {string} mongoDumpPath - Path to dump JSON files
   */
  static async exportDatabase(mongoDumpPath) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Mongoose is not connected to MongoDB");
    }

    console.log("📦 Starting Mongoose dynamic collections dump...");
    
    // List all collections in the active database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections to dump.`);

    for (const col of collections) {
      const colName = col.name;
      console.log(`   Dumping collection: ${colName}...`);
      
      // Fetch all documents from this collection
      const docs = await mongoose.connection.db.collection(colName).find({}).toArray();
      
      // Write documents to a JSON file
      const filePath = path.join(mongoDumpPath, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
    }
    
    console.log("✅ Database collections successfully dumped to JSON files!");
  }

  /**
   * Creates a high-compression ZIP of uploads and database dumps
   * @param {string} filePath - Path to zip output file
   * @param {string} dbName - Database name
   */
  static async createBackupZip(filePath, dbName) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on("close", () => {
        console.log(`🤐 Zip archive created successfully: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      });
      
      archive.on("error", (err) => reject(err));
      archive.pipe(output);

      // 1. Pack local system uploads directory if it exists
      if (fs.existsSync(UPLOADS_PATH)) {
        console.log("📁 Adding uploads directory to ZIP...");
        archive.directory(UPLOADS_PATH, "uploads");
      } else {
        console.log("ℹ️ No uploads directory found to backup.");
      }

      // 2. Add dynamic database dumps to ZIP
      const mongoDumpPath = path.join(TEMP_DIR, "mongo-dump");
      if (fs.existsSync(mongoDumpPath)) {
        console.log("📁 Adding database JSON dumps to ZIP...");
        archive.directory(mongoDumpPath, "mongo-data");
      }

      // 3. Append project-info metadata file
      const projectInfo = {
        projectId: dbName,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
      };
      archive.append(JSON.stringify(projectInfo, null, 2), {
        name: "project-info.json",
      });

      archive.finalize();
    });
  }

  /**
   * Cleans up historical backups in B2 older than 7 days
   * @param {string} dbName - Database name
   */
  static async cleanupOldBackups(dbName) {
    const prefix = `${dbName}/daily/`;

    try {
      console.log(`🧹 Sweeping historical backups under B2 folder prefix: ${prefix}`);
      
      const resp = await this.listFileNames(prefix);
      const files = resp.files || [];

      if (files.length === 0) {
        console.log("✅ No backups found in bucket prefix to prune.");
        return;
      }

      // Define cutoff date (7 days ago)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Filter backups older than 7 days
      const filesToDelete = files.filter((file) => {
        return file.uploadTimestamp && file.uploadTimestamp < sevenDaysAgo;
      });

      console.log(`📊 Found ${filesToDelete.length} backups older than 7 days.`);

      for (const file of filesToDelete) {
        console.log(`🗑️ Deleting expired backup from B2: ${file.fileName}`);
        await this.deleteFile(file.fileName);
      }

      if (filesToDelete.length > 0) {
        console.log("✨ Backblaze 7-day retention cleanup complete!");
      }
    } catch (error) {
      console.error("⚠️ Warning: B2 retention cleanup sweep failed:", error.message);
    }
  }

  /**
   * Main system backup executor
   */
  static async performSystemBackup() {
    // Dynamically resolve active database name
    const dbName = mongoose.connection.name || "zepofy-server";
    console.log(`⏳ Starting daily system backup for database: [${dbName}]...`);

    try {
      // 1. Clean & Recreate Temp Workspace
      if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(TEMP_DIR);
      
      const mongoDumpPath = path.join(TEMP_DIR, "mongo-dump");
      fs.mkdirSync(mongoDumpPath);

      // 2. Dump all DB collections
      await this.exportDatabase(mongoDumpPath);

      // 3. Zip files
      const zipPath = path.join(TEMP_DIR, "backup.zip");
      console.log("🤐 Compiling ZIP archive...");
      await this.createBackupZip(zipPath, dbName);

      // 4. Prepare file buffer for upload
      const fileStats = fs.statSync(zipPath);
      const fileSize = fileStats.size;
      const fileBuffer = fs.readFileSync(zipPath);

      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const fileName = `backup_${dbName}_${day}_${month}_${year}.zip`;
      const folder = `${dbName}/daily`;

      console.log(`☁️ Uploading ZIP backup (${(fileSize / 1024 / 1024).toFixed(2)} MB) to Backblaze B2...`);

      const result = await this.uploadFromBuffer(
        fileBuffer,
        fileName,
        "application/zip",
        folder
      );

      if (!result.success) {
        throw new Error(`B2 Upload failed: ${result.error}`);
      }

      const uploadedFileName = result.data.fileName;
      console.log(`✅ System ZIP backup uploaded successfully! Key/FileName: ${uploadedFileName}`);

      // 5. Sweep expired backups (older than 7 days)
      await this.cleanupOldBackups(dbName);

      return {
        success: true,
        dbName,
        fileName: uploadedFileName,
        key: uploadedFileName,
        sizeBytes: fileSize,
      };
    } catch (error) {
      console.error("❌ Backup service pipeline failed:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // 6. Cleanup temp workspace
      try {
        if (fs.existsSync(TEMP_DIR)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          fs.rmSync(TEMP_DIR, { recursive: true, force: true });
          console.log("🧹 Staging directory cleaned up.");
        }
      } catch (cleanupErr) {
        console.warn("⚠️ Staging folder cleanup warning:", cleanupErr.message);
      }
    }
  }
}

module.exports = BackblazeService;
