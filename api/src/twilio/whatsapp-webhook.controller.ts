import { Body, Controller, Header, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ChatsService } from '../chats/chats.service';
import { OpenaiService } from '../openai/openai.service';
import { TwilioSignatureGuard } from './twilio-signature.guard';
import { TwilioService } from './twilio.service';

@ApiExcludeController()
@Controller('webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly chats: ChatsService,
    private readonly openai: OpenaiService,
    private readonly twilio: TwilioService,
  ) {}

  @Post('whatsapp')
  @UseGuards(TwilioSignatureGuard)
  @Header('Content-Type', 'text/xml')
  async inbound(@Body() body: Record<string, string>) {
    const From = body.From ?? '';
    const text = body.Body ?? '';
    const messageSid = body.MessageSid;
    const chat = await this.chats.upsertFromInbound(From, text, messageSid);
    try {
      const reply = await this.openai.replyForWhatsApp({
        systemExtra: `Client chat id: ${chat.id}. Phone E.164: ${chat.phoneE164}. Name: ${chat.name}.`,
        userMessage: text,
      });
      const send = await this.twilio.sendSessionMessage(chat.phoneE164, reply);
      await this.chats.appendOutbound(chat.id, reply, send.sid);
    } catch (err) {
      this.logger.error('WhatsApp AI reply failed', err);
    }
    return '<Response></Response>';
  }
}
