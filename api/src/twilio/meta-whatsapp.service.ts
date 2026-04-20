import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendResult = { sid: string; status: 'sent' | 'skipped' };

@Injectable()
export class MetaWhatsAppService {
  private readonly logger = new Logger(MetaWhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  private get accessToken() {
    return this.config.get<string>('metaWhatsApp.accessToken') ?? '';
  }

  private get phoneNumberId() {
    return this.config.get<string>('metaWhatsApp.phoneNumberId') ?? '';
  }

  private get graphVersion() {
    return this.config.get<string>('metaWhatsApp.graphVersion') ?? 'v23.0';
  }

  private get messagesUrl() {
    return `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;
  }

  private normalizeTo(to: string): string {
    return to.replace(/^whatsapp:/i, '').replace(/^\+/, '').trim();
  }

  private async post(body: Record<string, unknown>): Promise<SendResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'Meta WhatsApp not configured; set WA_ACCESS_TOKEN and PHONE_NUMBER_ID',
      );
      return { sid: 'mock', status: 'skipped' };
    }
    const res = await fetch(this.messagesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(
        `Meta send failed ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
      );
    }
    const sid = data?.messages?.[0]?.id ?? 'sent';
    return { sid, status: 'sent' };
  }

  async sendSessionMessage(to: string, body: string): Promise<SendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to: this.normalizeTo(to),
      type: 'text',
      text: { body },
    });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    contentVariables: Record<string, string>,
  ): Promise<SendResult> {
    const parameters = Object.keys(contentVariables)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({ type: 'text', text: contentVariables[key] }));
    return this.post({
      messaging_product: 'whatsapp',
      to: this.normalizeTo(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [{ type: 'body', parameters }],
      },
    });
  }
}
