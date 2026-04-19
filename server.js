/**
 * @deprecated Use the Nest app in `api/` (`npm run dev:api`).
 * Webhook: POST /webhook/whatsapp — see api/src/twilio/whatsapp-webhook.controller.ts
 *
 * Listen for incoming WhatsApp (Twilio) messages.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN — same as send script
 *   PORT — default 3000
 *   TWILIO_WEBHOOK_BASE_URL — optional, full public origin Twilio calls (e.g. https://abc.ngrok.io)
 *     If set with TWILIO_AUTH_TOKEN, requests are validated with X-Twilio-Signature.
 *
 * Twilio Console → Messaging → WhatsApp sandbox → "When a message comes in":
 *   POST https://<your-public-host>/webhook/whatsapp
 *
 * Local dev: expose with ngrok (or similar) and paste that URL + path above.
 */

require('dotenv').config();

const express = require('express');
const twilio = require('twilio');

const app = express();
const port = Number(process.env.PORT) || 3000;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const webhookBase = process.env.TWILIO_WEBHOOK_BASE_URL;

app.use(express.urlencoded({ extended: false }));

function validateTwilioSignature(req, res, next) {
  if (!webhookBase || !authToken) {
    return next();
  }

  const signature = req.headers['x-twilio-signature'];
  const url = `${webhookBase.replace(/\/$/, '')}${req.originalUrl}`;

  const ok = twilio.validateRequest(authToken, signature, url, req.body);
  if (!ok) {
    console.warn('Twilio signature validation failed');
    return res.status(403).send('Forbidden');
  }
  next();
}

app.post('/webhook/whatsapp', validateTwilioSignature, (req, res) => {
  const { Body, From, To, MessageSid, NumMedia } = req.body;

  console.log('[incoming whatsapp]', {
    MessageSid,
    From,
    To,
    Body,
    NumMedia: NumMedia || '0',
  });

  // Acknowledge; reply in TwiML here if you want an automated text back.
  res.type('text/xml').send('<Response></Response>');
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.listen(port, () => {
  console.log(`Webhook server listening on http://localhost:${port}`);
  console.log(`POST incoming messages to /webhook/whatsapp`);
  if (!webhookBase) {
    console.log(
      '(Optional) Set TWILIO_WEBHOOK_BASE_URL to enable signature verification.'
    );
  }
});
