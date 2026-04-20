import { Module } from '@nestjs/common';
import { MetaWhatsAppService } from './meta-whatsapp.service';

@Module({
  providers: [MetaWhatsAppService],
  exports: [MetaWhatsAppService],
})
export class TwilioModule {}
