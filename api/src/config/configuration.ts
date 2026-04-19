import * as path from 'path';

/**
 * Resolves STATE_ROOT. Reuses host `.env` with `STATE_ROOT=../state` inside the API
 * image: cwd is e.g. `/app`, so `../state` becomes `/state` (EACCES). Map that to `./state`
 * under cwd instead.
 */
function resolveStateRoot(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') {
    return path.resolve(path.join(process.cwd(), '..', 'state'));
  }
  const trimmed = raw.trim();
  const resolved = path.resolve(process.cwd(), trimmed);
  if (trimmed === '../state' && resolved === '/state') {
    return path.resolve(process.cwd(), 'state');
  }
  return resolved;
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  stateRoot: resolveStateRoot(process.env.STATE_ROOT),
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
  booking: {
    timezone: process.env.BOOKING_TIMEZONE ?? 'Europe/Berlin',
  },
  /** Max prior WhatsApp turns (user+assistant pairs count as separate messages) sent to OpenAI */
  whatsappHistoryMaxMessages: parseInt(
    process.env.WHATSAPP_HISTORY_MAX_MESSAGES ?? '80',
    10,
  ),
  debugState: process.env.DEBUG_STATE ?? '',
});
