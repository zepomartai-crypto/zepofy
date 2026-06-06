const WhatsAppFlow = require('../models/whatsappFlow.model');
const WhatsAppIntegration = require('../../../models/WhatsAppIntegration'); 
const Contact = require('../../../models/Contact');
const Message = require('../../../models/Message');
const conversationService = require('../../../services/conversation.service');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const flowEncryptionService = require('../../../services/flowEncryptionService');

// Get Integrated Channels for Dropdown
exports.getIntegratedChannels = async (req, res) => {
  try {
    // Attempt to fetch using userId if auth middleware sets it
    const query = {};
    if (req.userId) {
      query.userId = req.userId;
    } else if (req.user && req.user._id) {
      query.userId = req.user._id;
    }
    
    const integrations = await WhatsAppIntegration.find(query).select('businessPhoneNumber wabaId');
    // Remove duplicates using Set
    const channels = [...new Set(integrations.map(int => int.businessPhoneNumber))].filter(Boolean);
    
    return res.status(200).json({ success: true, data: channels });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching channels' });
  }
};

// Create Flow
exports.createFlow = async (req, res) => {
  try {
    const { name, categories, whatsappChannel, layout } = req.body;
    const userId = req.userId || (req.user && req.user._id);
    
    // Fix: categories is already an array from the frontend, but just in case, handle it properly
    const categoriesArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);
    
    const newFlow = new WhatsAppFlow({
      name,
      categories: categoriesArray,
      whatsappChannel: whatsappChannel || '',
      layout: layout || {},
      status: 'DRAFT',
      createdBy: userId
    });

    await newFlow.save();

    return res.status(201).json({
      success: true,
      message: 'Flow created successfully',
      data: newFlow
    });
  } catch (error) {
    console.error('Error creating flow:', error);
    return res.status(500).json({ success: false, message: 'Server error creating flow' });
  }
};

// Get all flows
exports.getFlows = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    // Find flows matching the current user, or flows without a createdBy (for legacy backward compatibility if needed, though better to just filter by userId)
    const flows = await WhatsAppFlow.find({ 
      $or: [
        { createdBy: userId },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    }).sort({ createdAt: -1 });
    
    return res.status(200).json({ success: true, data: flows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching flows' });
  }
};

// Get flow by ID
exports.getFlowById = async (req, res) => {
  try {
    const flow = await WhatsAppFlow.findById(req.params.id);
    if (!flow) {
      return res.status(404).json({ success: false, message: 'Flow not found' });
    }
    return res.status(200).json({ success: true, data: flow });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching flow' });
  }
};

const generateMetaFlowJSON = (layout) => {
  if (!layout || !layout.screens || layout.screens.length === 0) return {};

  const getSafeScreenId = (index) => {
    const numWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    return "screen_" + (numWords[index] || "extra_a");
  };

  // Gather all form field IDs to pass in the final payload
  const allFieldIds = [];
  layout.screens.forEach(s => {
    s.components.forEach(c => {
      let fieldId = c.id || c.name || (c.label ? c.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : null);
      if (['Input', 'Email', 'Number', 'Phone', 'Password', 'Passcode', 'Textarea', 'Checkbox', 'Radio', 'Dropdown', 'Date', 'Optin'].includes(c.type) && fieldId) {
        c.id = fieldId; // Ensure the component has the ID set for the next loop
        allFieldIds.push(fieldId);
      }
    });
  });

  const screens = layout.screens.map((screen, index) => {
    const children = screen.components.map(comp => {
      const compId = comp.id || comp.name || (comp.label ? comp.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'field');
      
      // Map components
      if (comp.type === 'Heading') {
        return { type: 'TextHeading', text: comp.label };
      } else if (['Input', 'Email', 'Number', 'Phone', 'Password', 'Passcode'].includes(comp.type)) {
        let inputType = comp.type.toLowerCase();
        if (inputType === 'input') inputType = 'text';
        if (inputType === 'passcode') inputType = 'password';
        const field = { type: 'TextInput', name: compId, label: comp.label, required: comp.required || false, "input-type": inputType };
        if (comp.placeholder) field["helper-text"] = comp.placeholder;
        return field;
      } else if (comp.type === 'Textarea') {
        const field = { type: 'TextArea', name: compId, label: comp.label, required: comp.required || false };
        if (comp.placeholder) field["helper-text"] = comp.placeholder;
        return field;
      } else if (comp.type === 'Checkbox') {
        return { type: 'CheckboxGroup', name: compId, label: comp.label, required: comp.required || false, "data-source": (comp.options || []).map(o => ({ id: o.replace(/[^a-zA-Z_]/g, '').toLowerCase() || 'opt', title: o })) };
      } else if (comp.type === 'Radio') {
        return { type: 'RadioButtonsGroup', name: compId, label: comp.label, required: comp.required || false, "data-source": (comp.options || []).map(o => ({ id: o.replace(/[^a-zA-Z_]/g, '').toLowerCase() || 'opt', title: o })) };
      } else if (comp.type === 'Dropdown') {
        return { type: 'Dropdown', name: compId, label: comp.label, required: comp.required || false, "data-source": (comp.options || []).map(o => ({ id: o.replace(/[^a-zA-Z_]/g, '').toLowerCase() || 'opt', title: o })) };
      } else if (comp.type === 'Date') {
        return { type: 'DatePicker', name: compId, label: comp.label, required: comp.required || false };
      } else if (comp.type === 'Optin') {
        return { type: 'OptIn', name: compId, label: comp.label, required: comp.required || false };
      }
      return null;
    }).filter(Boolean);

    // Add footer/submit button
    const isLastScreen = index === layout.screens.length - 1;
    const nextScreen = isLastScreen ? null : getSafeScreenId(index + 1);

    const submitPayload = { action: "submit_form" };
    allFieldIds.forEach(id => {
      submitPayload[id] = `\${form.${id}}`;
    });

    children.push({
      type: "Footer",
      label: isLastScreen ? "Submit" : "Next",
      "on-click-action": {
        name: isLastScreen ? "data_exchange" : "navigate",
        payload: isLastScreen ? submitPayload : { screen: nextScreen }
      }
    });

    return {
      id: getSafeScreenId(index),
      title: screen.name,
      data: {},
      terminal: false,
      layout: {
        type: "SingleColumnLayout",
        children: children
      }
    };
  });

  // Add the SUCCESS screen that the endpoint will navigate to
  screens.push({
    id: "SUCCESS",
    title: "Success",
    data: {},
    terminal: true,
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "TextHeading",
          text: "Submitted Successfully"
        },
        {
          type: "TextBody",
          text: "Thank you for your submission."
        },
        {
          type: "Footer",
          label: "Done",
          "on-click-action": {
            name: "complete",
            payload: {}
          }
        }
      ]
    }
  });

  const routing_model = {};
  layout.screens.forEach((screen, index) => {
    const currentId = getSafeScreenId(index);
    if (index < layout.screens.length - 1) {
      routing_model[currentId] = [getSafeScreenId(index + 1)];
    } else {
      routing_model[currentId] = ["SUCCESS"];
    }
  });
  routing_model["SUCCESS"] = [];

  return {
    version: "7.3",
    data_api_version: "3.0",
    routing_model,
    screens
  };
};

// Update flow (save builder layout/meta)
exports.updateFlow = async (req, res) => {
  try {
    const { name, categories, whatsappChannel, layout, status } = req.body;
    let { metaFlowJSON } = req.body;
    
    // Auto-generate metaFlowJSON from layout if layout exists
    if (layout && layout.screens && layout.screens.length > 0) {
      metaFlowJSON = generateMetaFlowJSON(layout);
    }
    
    const categoriesArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);
    
    const updateData = { 
      name, 
      categories: categoriesArray, 
      whatsappChannel, 
      layout, 
      metaFlowJSON 
    };
    
    if (status) {
      updateData.status = status;
    }

    const updatedFlow = await WhatsAppFlow.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedFlow) {
      return res.status(404).json({ success: false, message: 'Flow not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Flow updated successfully',
      data: updatedFlow
    });
  } catch (error) {
    console.error('Error updating flow:', error);
    return res.status(500).json({ success: false, message: 'Server error updating flow' });
  }
};

// Delete flow
exports.deleteFlow = async (req, res) => {
  try {
    await WhatsAppFlow.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Flow deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error deleting flow' });
  }
};

// Sync Flow with Meta
exports.syncFlowWithMeta = async (req, res) => {
  try {
    const flowId = req.params.id;
    const flow = await WhatsAppFlow.findById(flowId);
    
    if (!flow) {
      return res.status(404).json({ success: false, message: 'Flow not found' });
    }

    // 1. Get User's Integration
    let query = { status: 'connected' };
    if (req.userId) query.userId = req.userId;
    else if (req.user && req.user._id) query.userId = req.user._id;
    if (flow.whatsappChannel) query.businessPhoneNumber = flow.whatsappChannel;
    
    const integration = await WhatsAppIntegration.findOne(query).select('+accessToken');
    if (!integration) {
      return res.status(404).json({ success: false, message: 'WhatsApp Integration not found for this channel.' });
    }
    const token = integration.decryptToken();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid integration token.' });
    }

    const apiVersion = process.env.META_API_VERSION || 'v19.0';
    let metaFlowId = flow.flowId;

    // 2. Create the Flow in Meta if it doesn't exist
    if (!metaFlowId) {
      const createResponse = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${integration.wabaId}/flows`,
        {
          name: (flow.name || 'new_flow').substring(0, 30).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
          categories: flow.categories.length > 0 ? flow.categories.map(c => c.toUpperCase().replace(/\s+/g, '_')) : ['OTHER']
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      metaFlowId = createResponse.data.id;
      flow.flowId = metaFlowId;
      await flow.save();
    }

    // 3. Upload the Flow JSON Asset
    // Regenerate to ensure the latest generation logic (version 3.0, no data_api_version) is used
    if (flow.layout && flow.layout.screens && flow.layout.screens.length > 0) {
      flow.metaFlowJSON = generateMetaFlowJSON(flow.layout);
    }

    if (!flow.metaFlowJSON || Object.keys(flow.metaFlowJSON).length === 0) {
      return res.status(400).json({ success: false, message: 'Flow JSON is empty. Please save the flow layout first.' });
    }

    const formData = new FormData();
    formData.append('name', 'flow.json');
    formData.append('asset_type', 'FLOW_JSON');
    
    const jsonBuffer = Buffer.from(JSON.stringify(flow.metaFlowJSON), 'utf-8');
    formData.append('file', jsonBuffer, {
      filename: 'flow.json',
      contentType: 'application/json'
    });

    const assetResponse = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${metaFlowId}/assets`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      }
    );

    flow.status = 'PENDING';
    await flow.save();

    return res.status(200).json({
      success: true,
      message: 'Flow synced with Meta successfully.',
      data: flow
    });

  } catch (error) {
    console.error('Error syncing flow with meta:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.error?.message || 'Server error syncing flow' 
    });
  }
};

// Publish Flow to Meta
exports.publishFlow = async (req, res) => {
  try {
    const flowId = req.params.id;
    const flow = await WhatsAppFlow.findById(flowId);
    
    if (!flow || !flow.flowId) {
      return res.status(404).json({ success: false, message: 'Flow not found or not synced to Meta yet.' });
    }

    let query = { status: 'connected' };
    if (req.userId) query.userId = req.userId;
    else if (req.user && req.user._id) query.userId = req.user._id;
    if (flow.whatsappChannel) query.businessPhoneNumber = flow.whatsappChannel;
    
    const integration = await WhatsAppIntegration.findOne(query).select('+accessToken');
    const token = integration?.decryptToken();
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid integration token.' });
    }

    const apiVersion = process.env.META_API_VERSION || 'v19.0';
    
    try {
      // Check if we need to generate and upload the RSA key before publishing
      if (!integration.flowPrivateKey) {
        console.log('Generating and uploading RSA key for Flow endpoint encryption...');
        // Generate RSA Key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        // Upload to Meta
        const keyFormData = new URLSearchParams();
        keyFormData.append('business_public_key', publicKey);

        await axios.post(
          `https://graph.facebook.com/${apiVersion}/${integration.phoneNumberId}/whatsapp_business_encryption`,
          keyFormData,
          { headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${token}` 
          } }
        );

        // Save private key in DB for future decryption
        integration.flowPrivateKey = privateKey;
        await integration.save();
      }

      // Attempt to publish
      await axios.post(
        `https://graph.facebook.com/${apiVersion}/${flow.flowId}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (publishError) {
      // If Meta complains about missing public key (139002), try one more time
      const metaErr = publishError.response?.data?.error;
      if (metaErr && metaErr.code === 139002) {
        console.log('Meta reported missing public key. Retrying upload...');
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        const keyFormData = new URLSearchParams();
        keyFormData.append('business_public_key', publicKey);

        await axios.post(
          `https://graph.facebook.com/${apiVersion}/${integration.phoneNumberId}/whatsapp_business_encryption`,
          keyFormData,
          { headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${token}` 
          } }
        );

        integration.flowPrivateKey = privateKey;
        await integration.save();

        // Retry publish
        await axios.post(
          `https://graph.facebook.com/${apiVersion}/${flow.flowId}/publish`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        throw publishError; // Not a public key error, throw normally
      }
    }

    flow.status = 'PUBLISHED';
    await flow.save();

    return res.status(200).json({
      success: true,
      message: 'Flow published successfully!',
      data: flow
    });

  } catch (error) {
    console.error('Error publishing flow:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.error?.message || 'Server error publishing flow' 
    });
  }
};

const whatsappService = require('../../../services/whatsappService');

// Send Flow to Customer
exports.sendFlowToCustomer = async (req, res) => {
  try {
    const { flowId, to, customerName } = req.body;
    
    if (!flowId || !to) {
      return res.status(400).json({ success: false, message: 'Flow ID and Phone Number are required' });
    }

    const flow = await WhatsAppFlow.findById(flowId);
    if (!flow || !flow.flowId) {
      return res.status(404).json({ success: false, message: 'Flow not found or not synced to Meta.' });
    }

    if (flow.status !== 'PUBLISHED' && flow.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Only PUBLISHED flows can be sent to customers.' });
    }

    let firstScreen = 'WELCOME_SCREEN';
    try {
      const metaJson = typeof flow.metaFlowJSON === 'string' ? JSON.parse(flow.metaFlowJSON) : flow.metaFlowJSON;
      if (metaJson?.screens && metaJson.screens.length > 0) {
        firstScreen = metaJson.screens[0].id;
      } else if (metaJson?.routing?.default) {
        firstScreen = metaJson.routing.default;
      }
    } catch (e) {
      console.log('Error parsing metaFlowJSON for routing defaults', e);
    }
    
    // Construct the Interactive Flow Object
    const interactive = {
      type: "flow",
      header: {
        type: "text",
        text: flow.name || "Form"
      },
      body: {
        text: `Hi ${customerName || 'there'}! Please click the button below to open and fill out the ${flow.categories?.[0] || 'form'}.`
      },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: `zepofy_flow_${Date.now()}`,
          flow_id: flow.flowId,
          flow_cta: "Open Form",
          flow_action: "navigate",
          flow_action_payload: {
            screen: firstScreen
          }
        }
      }
    };

    // Use Zepofy's WhatsApp Service to dispatch
    const userId = req.userId || (req.user && req.user._id);
    const response = await whatsappService.sendInteractiveMessage(
      userId,
      to,
      interactive
    );

    let savedMsg = null;
    try {
      const contact = await Contact.findOne({ phone: to, userId: userId });
      let conversationId = null;
      
      if (contact) {
        const conversation = await conversationService.getOrCreateConversation(contact);
        conversationId = conversation?._id;
      }

      const bodyText = interactive.body.text;
      const buttonText = interactive.action.parameters.flow_cta;
      const combinedText = `[WhatsApp Flow: ${interactive.header.text}]\n${bodyText}\n🔗 Button: ${buttonText}`;

      savedMsg = await Message.create({
        userId: userId,
        customerId: contact ? contact._id : null,
        conversationId: conversationId,
        phone: to,
        sender: "user",
        direction: "outgoing",
        isRead: true,
        type: "interactive",
        metaMessageId: response.metaMessageId,
        status: "sent",
        text: combinedText,
        body: combinedText
      });

      if (contact) {
        contact.lastMessage = `📄 Flow: ${flow.name}`;
        contact.lastMessageTime = new Date();
        contact.lastSender = "admin";
        contact.unreadCount = 0;
        await contact.save();
      }

      if (conversationId) {
        await conversationService.markOutbound({
          conversationId: conversationId,
          metaMessageId: response.metaMessageId
        }).catch(() => { });
      }
    } catch (dbErr) {
      console.error("❌ DB SAVE ERROR:", dbErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Flow sent successfully!',
      metaMessageId: response.metaMessageId,
      msg: savedMsg
    });

  } catch (error) {
    console.error('Error sending flow to customer:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.error?.message || error.message || 'Failed to send flow to customer' 
    });
  }
};

// Handle incoming Meta Flow Data Requests (Dynamic Flows)
exports.handleFlowDataEndpoint = async (req, res) => {
  try {
    const { body, query } = req;
    const { phoneNumberId } = query;
    
    // We must find the correct integration's private key to decrypt the payload.
    // Since Meta doesn't send phoneNumberId in the body for the Data Endpoint by default,
    // we iterate through all integrations with a flowPrivateKey until decryption succeeds.
    let integrations = [];
    if (phoneNumberId) {
      integrations = await WhatsAppIntegration.find({ phoneNumberId, flowPrivateKey: { $exists: true } }).select('+flowPrivateKey');
    } else {
      integrations = await WhatsAppIntegration.find({ flowPrivateKey: { $exists: true } }).select('+flowPrivateKey');
    }
    
    if (!integrations || integrations.length === 0) {
      console.error("No integrations with a Flow private key found.");
      return res.status(421).send();
    }

    let decryptedBody, aesKeyBuffer, initialVectorBuffer;
    let successfulIntegration = null;

    for (const integration of integrations) {
      try {
        const decrypted = flowEncryptionService.decryptFlowData(body, integration.flowPrivateKey);
        decryptedBody = decrypted.decryptedBody;
        aesKeyBuffer = decrypted.aesKeyBuffer;
        initialVectorBuffer = decrypted.initialVectorBuffer;
        successfulIntegration = integration;
        break; // Successfully decrypted!
      } catch (err) {
        // Not this key, try the next one
        continue;
      }
    }

    if (!successfulIntegration) {
      console.error("Failed to decrypt Flow Data with any available private key (OAEP Decoding Error). Sending 421 to force Meta to refresh the public key.");
      return res.status(421).send();
    }

    console.log(`✅ Decrypted Flow Data for Integration: ${successfulIntegration.wabaId}`);
    console.log("Decrypted Flow Data Payload:", JSON.stringify(decryptedBody, null, 2));

    const { screen, data, version, action } = decryptedBody;
    
    // 1. Handle Endpoint Health Check (ping)
    if (action === 'ping') {
      const pingResponse = flowEncryptionService.encryptFlowResponse(
        { data: { status: "active" } },
        aesKeyBuffer,
        initialVectorBuffer
      );
      return res.send(pingResponse);
    }
    
    // 2. Send standard success screen back for all other submissions
    const screenData = {
      screen: "SUCCESS", 
      data: {
        success: true,
      },
    };

    const encryptedResponse = flowEncryptionService.encryptFlowResponse(
      screenData,
      aesKeyBuffer,
      initialVectorBuffer
    );

    return res.send(encryptedResponse);
  } catch (error) {
    console.error("Flow Data Endpoint Error:", error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};
