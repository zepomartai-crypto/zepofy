const whatsappService = require('../services/whatsappService');

exports.verify = (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
};

exports.receiveMessage = async (req, res) => {
  try {
    const body = req.body;
    console.log('WEBHOOK POST body:', JSON.stringify(body, null, 2));

    // Check typical WhatsApp Cloud format
    const entry = body.entry && body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from; // phone number
      const text = msg.text && msg.text.body;

      console.log('Incoming message from:', from, 'text:', text);

      // simple auto-reply example
      const replyText = `Thanks for your message: "${text}". We will reply soon.`;
      await whatsappService.sendTextMessage(from, replyText);
    }

    // respond 200 to webhook
    res.sendStatus(200);
  } catch (err) {
    console.error('Error handling webhook:', err);
    res.sendStatus(500);
  }
};
