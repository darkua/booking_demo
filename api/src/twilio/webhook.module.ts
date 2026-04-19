import { Module } from '@nestjs/common';
import { ChatsModule } from '../chats/chats.module';
import { OpenaiModule } from '../openai/openai.module';
import { TwilioModule } from './twilio.module';
import { TwilioSignatureGuard } from './twilio-signature.guard';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [TwilioModule, ChatsModule, OpenaiModule],
  controllers: [WhatsappWebhookController],
  providers: [TwilioSignatureGuard],
})
export class WebhookModule {}
