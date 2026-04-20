import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from '../bookings/bookings.service';
import { ChatsService, phoneFromWhatsapp } from '../chats/chats.service';
import { OpenaiService } from '../openai/openai.service';
import { TwilioService } from './twilio.service';

function isConfirmationText(raw: string): boolean {
  const t = raw.trim().toUpperCase();
  if (!t) return false;
  return (
    t === 'CONFIRM' ||
    t === 'YES' ||
    t === 'OK' ||
    t === 'SI' ||
    t.startsWith('CONFIRM ')
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function firstFromArray(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return asRecord(value[0]);
}

@ApiExcludeController()
@Controller('webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chats: ChatsService,
    private readonly openai: OpenaiService,
    private readonly twilio: TwilioService,
    private readonly bookings: BookingsService,
  ) {}

  @Get()
  verify(
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('webhook.verifyToken');
    if (!expected) {
      throw new ForbiddenException('WEBHOOK_VERIFY_TOKEN not configured');
    }
    if (verifyToken !== expected) {
      throw new ForbiddenException('Invalid webhook verification token');
    }
    const parsed = parseInt(challenge, 10);
    if (Number.isNaN(parsed)) {
      throw new ForbiddenException('Invalid hub.challenge');
    }
    return parsed;
  }

  @Post()
  async inbound(@Body() body: Record<string, unknown>) {
    const twilioLikeFrom = String(body.From ?? '');
    const twilioLikeText = String(
      body.Body ?? body.ButtonText ?? body.ListItem ?? body.ButtonPayload ?? '',
    );
    const twilioLikeSid = body.MessageSid ? String(body.MessageSid) : undefined;

    const entry0 = firstFromArray(body.entry);
    const change0 = firstFromArray(entry0?.changes);
    const value =
      asRecord(change0?.value) ??
      (body.object === 'whatsapp_business_account' ? asRecord(body) : null);
    const message = firstFromArray(value?.messages);
    const messageText = asRecord(message?.text);
    const metaFrom = message?.from ? String(message.from) : '';
    const metaText = messageText?.body ? String(messageText.body) : '';
    const metaMessageId = message?.id ? String(message.id) : undefined;

    const from = (metaFrom || twilioLikeFrom).trim();
    const text = (metaText || twilioLikeText).trim();
    const messageSid = metaMessageId || twilioLikeSid;
    if (!from) {
      this.logger.warn('Inbound webhook ignored: no sender found');
      return { status: 'ignored' as const };
    }
    const phoneE164 = phoneFromWhatsapp(from);

    this.logger.log(
      `Inbound WhatsApp messageSid=${messageSid ?? 'n/a'} from=${phoneE164} len=${text.length}`,
    );

    const chat = await this.chats.upsertFromInbound(
      from,
      text || '(interactive)',
      messageSid,
    );

    if (isConfirmationText(text)) {
      try {
        const updated = await this.bookings.confirmLatestUnconfirmedForPhone(phoneE164);
        if (updated) {
          this.logger.log(`Booking ${updated.id} confirmed via WhatsApp for ${phoneE164}`);
          const send = await this.twilio.sendSessionMessage(
            phoneE164,
            'Your appointment is confirmed. See you then!',
          );
          await this.chats.appendOutbound(
            chat.id,
            'Your appointment is confirmed.',
            send.sid,
          );
          return { status: 'ok' as const };
        }
        try {
          const nudge = await this.twilio.sendSessionMessage(
            phoneE164,
            'We could not find a pending appointment to confirm.',
          );
          await this.chats.appendOutbound(
            chat.id,
            'We could not find a pending appointment to confirm.',
            nudge.sid,
          );
        } catch (e) {
          this.logger.warn(`Nudge after failed confirm: ${e instanceof Error ? e.message : e}`);
        }
        return { status: 'ok' as const };
      } catch (err) {
        this.logger.warn(`Confirm handler: ${err instanceof Error ? err.message : err}`);
      }
    }

    try {
      const reply = await this.openai.replyForWhatsApp({
        systemExtra: `Conversation phone E.164 (always use this for bookings; omit phoneE164 in create_booking — do NOT ask the customer for their number): ${chat.phoneE164}. Chat id: ${chat.id}. Display name from profile (may be Unknown): ${chat.name}.`,
        chatMessages: chat.messages,
        toolContext: {
          phoneE164: chat.phoneE164,
          clientNameHint: chat.name,
        },
      });
      const send = await this.twilio.sendSessionMessage(chat.phoneE164, reply);
      await this.chats.appendOutbound(chat.id, reply, send.sid);
    } catch (err) {
      this.logger.error('WhatsApp AI reply failed', err);
    }
    return { status: 'ok' as const };
  }
}
