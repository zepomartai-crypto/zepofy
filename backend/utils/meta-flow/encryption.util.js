const crypto = require('crypto');

/**
 * Decrypts the WhatsApp Flow request payload
 * @param {Object} body - The parsed JSON body containing encrypted_aes_key, encrypted_flow_data, initial_vector
 * @param {String} privatePem - The RSA Private Key in PEM format generated during flow publication
 * @returns {Object} - The decrypted JSON body, along with buffers for AES key and IV
 */
const decryptFlowData = (body, privatePem) => {
  try {
    const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
    
    if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
      throw new Error("Missing encrypted data fields in body");
    }

    // Decrypt the AES key created by the client using RSA private key
    const decryptedAesKey = crypto.privateDecrypt(
      {
        key: crypto.createPrivateKey(privatePem),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );

    // Decrypt the Flow data using AES-GCM
    const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
    const initialVectorBuffer = Buffer.from(initial_vector, "base64");

    const TAG_LENGTH = 16;
    const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
    const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

    const decipher = crypto.createDecipheriv(
      "aes-128-gcm",
      decryptedAesKey,
      initialVectorBuffer
    );
    decipher.setAuthTag(encrypted_flow_data_tag);

    const decryptedJSONString = Buffer.concat([
      decipher.update(encrypted_flow_data_body),
      decipher.final(),
    ]).toString("utf-8");

    return {
      decryptedBody: JSON.parse(decryptedJSONString),
      aesKeyBuffer: decryptedAesKey,
      initialVectorBuffer,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Encrypts the response to send back to the WhatsApp Flow client
 * @param {Object} response - The JSON payload to send to the client (next screen, etc)
 * @param {Buffer} aesKeyBuffer - The AES key retrieved from decryptFlowData
 * @param {Buffer} initialVectorBuffer - The IV retrieved from decryptFlowData
 * @returns {String} - Base64 string of encrypted response payload
 */
const encryptFlowResponse = (response, aesKeyBuffer, initialVectorBuffer) => {
  try {
    // Flip the initialization vector bits
    const flipped_iv = [];
    for (const pair of initialVectorBuffer.entries()) {
      flipped_iv.push(~pair[1]);
    }
    
    // Encrypt the response data
    const cipher = crypto.createCipheriv(
      "aes-128-gcm",
      aesKeyBuffer,
      Buffer.from(flipped_iv)
    );
    
    return Buffer.concat([
      cipher.update(JSON.stringify(response), "utf-8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
  } catch (error) {
    console.error("Error encrypting WhatsApp Flow response:", error);
    throw error;
  }
};

/**
 * Iterate through integrations to decrypt the payload.
 * Useful when Meta doesn't specify exactly which WABA the flow request is for.
 */
const resolveAndDecrypt = (body, integrations) => {
  if (!integrations || integrations.length === 0) {
    throw new Error("NO_KEYS");
  }

  for (const integration of integrations) {
    if (!integration.flowPrivateKey) continue;
    try {
      const result = decryptFlowData(body, integration.flowPrivateKey);
      return {
        ...result,
        integration
      };
    } catch (err) {
      continue;
    }
  }

  throw new Error("DECRYPTION_FAILED");
};

module.exports = {
  decryptFlowData,
  encryptFlowResponse,
  resolveAndDecrypt
};
