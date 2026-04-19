import { Body, Controller, Header, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { BookingsService } from '../bookings/bookings.service';
import { ChatsService, phoneFromTwilio } from '../chats/chats.service';
import { OpenaiService } from '../openai/openai.service';
import { TwilioSignatureGuard } from './twilio-signature.guard';
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

@ApiExcludeController()
@Controller('webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly chats: ChatsService,
    private readonly openai: OpenaiService,
    private readonly twilio: TwilioService,
    private readonly bookings: BookingsService,
  ) {}

  @Post('whatsapp')
  @UseGuards(TwilioSignatureGuard)
  @Header('Content-Type', 'text/xml')
  async inbound(@Body() body: Record<string, string>) {
    const From = body.From ?? '';
    const text =
      (body.Body ?? body.ButtonText ?? body.ListItem ?? body.ButtonPayload ?? '').trim();
    const messageSid = body.MessageSid;
    const phoneE164 = phoneFromTwilio(From);

    this.logger.log(
      `Inbound WhatsApp messageSid=${messageSid ?? 'n/a'} from=${phoneE164} len=${text.length}`,
    );

    const chat = await this.chats.upsertFromInbound(
      From,
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
          return '<Response></Response>';
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
        return '<Response></Response>';
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
    return '<Response></Response>';
  }
}
