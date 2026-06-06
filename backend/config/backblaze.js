const axios = require('axios');
const crypto = require('crypto');

/**
 * Backblaze B2 Configuration and Authorization with Logging
 */
class BackblazeB2 {
  constructor() {
    this.applicationKeyId = process.env.BACKBLAZE_APPLICATION_KEY_ID;
    this.applicationKey = process.env.BACKBLAZE_APPLICATION_KEY;
    this.accountId = process.env.BACKBLAZE_ACCOUNT_ID;
    this.bucketName = process.env.BACKBLAZE_BUCKET_NAME || 'zepofy-storage';
    this.apiBaseUrl = null;
    this.authorizationToken = null;
    this.apiUrl = null;
    this.bucketId = null;
  }

  /**
   * Authorize with Backblaze B2 API with detailed logging
   */
  async authorize() {
    try {
      if (!this.applicationKeyId || !this.applicationKey) {
        throw new Error('Missing Backblaze credentials in environment variables');
      }

      const credentials = Buffer.from(`${this.applicationKeyId}:${this.applicationKey}`).toString('base64');

      const response = await axios.post('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {}, {
        headers: {
          'Authorization': `Basic ${credentials}`
        },
        timeout: 10000
      });

      const data = response.data;

      this.authorizationToken = data.authorizationToken;
      this.apiUrl = data.apiUrl;
      this.apiBaseUrl = data.apiUrl;

      // IMPORTANT: Use the account ID returned by the API, not from .env
      this.accountId = data.accountId;

      return data;

    } catch (error) {
      console.error('❌ [Backblaze] Authorization failed!');
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details:`, error.response.data);
      }
      console.error('   Please check your BACKBLAZE_APPLICATION_KEY_ID and BACKBLAZE_APPLICATION_KEY');
      throw new Error(`Backblaze B2 authorization failed: ${error.message}`);
    }
  }

  /**
   * Get bucket ID by bucket name with detailed logging
   */
  async getBucketId() {
    try {
      if (!this.authorizationToken) {
        await this.authorize();
      }

      const response = await axios.get(`${this.apiUrl}/b2api/v2/b2_list_buckets`, {
        headers: {
          'Authorization': this.authorizationToken
        },
        params: {
          accountId: this.accountId
        },
        timeout: 10000
      });

      const buckets = response.data.buckets;
      const bucket = buckets.find(b => b.bucketName === this.bucketName);

      if (!bucket) {
        console.error(`❌ [Backblaze] Bucket '${this.bucketName}' not found!`);
        console.error('   Available buckets:', buckets.map(b => b.bucketName));
        throw new Error(`Bucket '${this.bucketName}' not found`);
      }

      this.bucketId = bucket.bucketId;
      return this.bucketId;

    } catch (error) {
      console.error('❌ [Backblaze] Failed to get bucket ID!');
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details:`, error.response.data);
      }
      throw new Error(`Failed to get bucket ID: ${error.message}`);
    }
  }

  /**
   * Get upload URL for a file with logging
   */
  async getUploadUrl() {
    try {
      if (!this.bucketId) {
        await this.getBucketId();
      }

      const response = await axios.post(`${this.apiUrl}/b2api/v2/b2_get_upload_url`, {
        bucketId: this.bucketId
      }, {
        headers: {
          'Authorization': this.authorizationToken
        },
        timeout: 10000
      });

      const data = response.data;

      if (!data.uploadUrl || !data.authorizationToken) {
        throw new Error('Invalid upload URL response from Backblaze');
      }

      return {
        uploadUrl: data.uploadUrl,
        authorizationToken: data.authorizationToken
      };

    } catch (error) {
      console.error('❌ [Backblaze] Failed to get upload URL!');
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details:`, error.response.data);
      }
      throw new Error(`Failed to get upload URL: ${error.message}`);
    }
  }

  /**
   * Upload file to Backblaze B2
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - File name
   * @param {string} contentType - MIME type
   * @param {string} folder - Folder path (optional)
   * @returns {Promise<Object>} - Upload result with file info
   */
  async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream', folder = '') {
    try {
      // Generate unique file name with timestamp
      const timestamp = Date.now();
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fullFileName = folder ? `${folder}/${timestamp}-${cleanFileName}` : `zepofy/${timestamp}-${cleanFileName}`;

      console.log(`📤 Uploading file: ${fullFileName}`);

      // Get upload URL
      const { uploadUrl, authorizationToken } = await this.getUploadUrl();

      // Calculate SHA1 hash
      const sha1Hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');

      // Upload file
      const response = await axios.post(uploadUrl, fileBuffer, {
        headers: {
          'Authorization': authorizationToken,
          'X-Bz-File-Name': fullFileName,
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length,
          'X-Bz-Content-Sha1': sha1Hash
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const uploadData = response.data;

      console.log(`✅ File uploaded successfully: ${uploadData.fileName}`);

      // Construct public URL (if bucket is public)
      const publicUrl = `https://f002.backblazeb2.com/file/${this.bucketName}/${uploadData.fileName}`;

      return {
        fileId: uploadData.fileId,
        fileName: uploadData.fileName,
        bucketId: uploadData.bucketId,
        uploadTimestamp: uploadData.uploadTimestamp,
        contentSha1: uploadData.contentSha1,
        contentLength: uploadData.contentLength,
        publicUrl: publicUrl,
        size: fileBuffer.length,
        contentType: contentType
      };

    } catch (error) {
      console.error('❌ File upload failed:', error.response?.data || error.message);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Generate signed URL for private files (optional implementation)
   */
  async getSignedUrl(fileName, expiresIn = 3600) {
    try {
      // This would require implementing signed URL generation
      // For now, return public URL
      const publicUrl = `https://f002.backblazeb2.com/file/${this.bucketName}/${fileName}`;
      return publicUrl;
    } catch (error) {
      console.error('❌ Failed to generate signed URL:', error.message);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * List file names in the bucket with an optional prefix
   */
  async listFileNames(prefix = '') {
    try {
      if (!this.authorizationToken) {
        await this.authorize();
      }
      if (!this.bucketId) {
        await this.getBucketId();
      }

      console.log(`📋 [Backblaze] Listing files with prefix: ${prefix}`);

      const response = await axios.post(`${this.apiUrl}/b2api/v2/b2_list_file_names`, {
        bucketId: this.bucketId,
        prefix: prefix,
        maxFileCount: 1000
      }, {
        headers: {
          'Authorization': this.authorizationToken
        },
        timeout: 10000
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ [Backblaze] Failed to list file names:', error.message);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Delete file from Backblaze B2
   */
  async deleteFile(fileName) {
    try {
      if (!this.authorizationToken) {
        await this.authorize();
      }

      console.log(`🗑️ [Backblaze] Deleting file: ${fileName}`);

      // First get file info to get fileId
      const listResponse = await axios.post(`${this.apiUrl}/b2api/v2/b2_list_file_names`, {
        bucketId: this.bucketId,
        startFileName: fileName,
        maxFileCount: 1
      }, {
        headers: {
          'Authorization': this.authorizationToken
        },
        timeout: 10000
      });

      const files = listResponse.data.files;
      const file = files.find(f => f.fileName === fileName);

      if (!file) {
        throw new Error(`File '${fileName}' not found`);
      }

      // Delete the file
      const deleteResponse = await axios.post(`${this.apiUrl}/b2api/v2/b2_delete_file_version`, {
        fileId: file.fileId,
        fileName: fileName
      }, {
        headers: {
          'Authorization': this.authorizationToken
        },
        timeout: 10000
      });

      console.log(`✅ [Backblaze] File deleted successfully: ${fileName}`);
      return deleteResponse.data;

    } catch (error) {
      console.error('❌ [Backblaze] File deletion failed!');
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details:`, error.response.data);
      }
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Test connection and verify bucket existence
   */
  async testConnection() {
    try {
      // Test authorization
      await this.authorize();

      // Test bucket access
      await this.getBucketId();

      // Test upload URL generation
      await this.getUploadUrl();

      console.log('✅ [Backblaze] Connection Successful');
      return true;

    } catch (error) {
      console.error('❌ [Backblaze] Connection test failed!');
      console.error(`   Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get bucket information and status
   */
  async getBucketInfo() {
    try {
      if (!this.authorizationToken) {
        await this.authorize();
      }

      console.log('📊 [Backblaze] Getting bucket information...');

      const response = await axios.get(`${this.apiUrl}/b2api/v2/b2_list_buckets`, {
        headers: {
          'Authorization': this.authorizationToken
        },
        params: {
          accountId: this.accountId
        },
        timeout: 10000
      });

      const buckets = response.data.buckets;
      const bucket = buckets.find(b => b.bucketName === this.bucketName);

      if (!bucket) {
        throw new Error(`Bucket '${this.bucketName}' not found`);
      }

      console.log('📋 [Backblaze] Bucket Information:');
      console.log(`   Name: ${bucket.bucketName}`);
      console.log(`   ID: ${bucket.bucketId}`);
      console.log(`   Type: ${bucket.bucketType}`);
      console.log(`   Account ID: ${this.accountId}`);
      console.log(`   Created: ${new Date(bucket.bucketInfo?.createdAt * 1000).toISOString() || 'Unknown'}`);
      console.log(`   Files: ${bucket.revision || 'Unknown'}`);

      return bucket;

    } catch (error) {
      console.error('❌ [Backblaze] Failed to get bucket info!');
      console.error(`   Error: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Details:`, error.response.data);
      }
      throw new Error(`Failed to get bucket info: ${error.message}`);
    }
  }
}

module.exports = new BackblazeB2();
