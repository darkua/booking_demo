import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: twilio.Twilio | null = null;

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>('twilio.accountSid');
    const token = this.config.get<string>('twilio.authToken');
    if (sid && token) {
      this.client = twilio(sid, token);
    }
  }

  get whatsappFrom() {
    return this.config.get<string>('twilio.whatsappFrom')!;
  }

  ensureToAddress(to: string) {
    const t = to.trim();
    return t.startsWith('whatsapp:') ? t : `whatsapp:${t}`;
  }

  async sendSessionMessage(to: string, body: string) {
    if (!this.client) {
      this.logger.warn('Twilio client not configured; skip send');
      return { sid: 'mock', status: 'skipped' as const };
    }
    try {
      const msg = await this.client.messages.create({
        from: this.whatsappFrom,
        to: this.ensureToAddress(to),
        body,
      });
      return { sid: msg.sid, status: 'sent' as const };
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; moreInfo?: string };
      this.logger.error(
        `Twilio sendSessionMessage failed: ${e.code} ${e.message} ${e.moreInfo ?? ''}`,
      );
      throw err;
    }
  }

  async sendTemplate(
    to: string,
    contentSid: string,
    contentVariables: Record<string, string>,
  ) {
    if (!this.client) {
      this.logger.warn('Twilio client not configured; skip template');
      return { sid: 'mock', status: 'skipped' as const };
    }
    const payload = JSON.stringify(contentVariables);
    this.logger.log(
      `Twilio Content template: to=${this.ensureToAddress(to)} contentSid=${contentSid} ContentVariables=${payload}`,
    );
    try {
      const msg = await this.client.messages.create({
        from: this.whatsappFrom,
        to: this.ensureToAddress(to),
        contentSid,
        contentVariables: payload,
      });
      return { sid: msg.sid, status: 'sent' as const };
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; moreInfo?: string };
      this.logger.error(
        `Twilio sendTemplate failed: ${e.code} ${e.message} ${e.moreInfo ?? ''}`,
      );
      throw err;
    }
  }
}
