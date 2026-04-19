#!/usr/bin/env node
/**
 * Test Twilio WhatsApp Sandbox: send a message.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 * Optional env (sandbox defaults):
 *   TWILIO_WHATSAPP_FROM  default: whatsapp:+14155238886
 *   TWILIO_WHATSAPP_TO    your joined sandbox number, e.g. whatsapp:+4915901600682
 *
 * Usage:
 *   TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_WHATSAPP_TO=whatsapp:+... \
 *     node send-whatsapp.js "Your message here"
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from =
  process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const to = process.env.TWILIO_WHATSAPP_TO;

const messageBody = process.argv.slice(2).join(' ').trim();

if (!accountSid || !authToken) {
  console.error(
    'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the environment.'
  );
  process.exit(1);
}

if (!to) {
  console.error(
    'Set TWILIO_WHATSAPP_TO (e.g. whatsapp:+4915901600682 — your sandbox-joined number).'
  );
  process.exit(1);
}

if (!messageBody) {
  console.error('Usage: node send-whatsapp.js <message text>');
  process.exit(1);
}

const client = require('twilio')(accountSid, authToken);

client.messages
  .create({
    body: messageBody,
    from,
    to,
  })
  .then((message) => {
    console.log(message.sid);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
