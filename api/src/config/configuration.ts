import * as path from 'path';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  stateRoot: process.env.STATE_ROOT ?? path.join(process.cwd(), '..', 'state'),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  adminUsername: process.env.ADMIN_USERNAME ?? 'altarise',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'Password123!',
  mcpApiKey: process.env.MCP_API_KEY ?? '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL ?? '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  appointmentTemplate: {
    contentSid: process.env.TWILIO_APPOINTMENT_TEMPLATE_SID ?? '',
  },
});
