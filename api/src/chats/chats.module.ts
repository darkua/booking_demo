import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { TwilioModule } from '../twilio/twilio.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [BookingsModule, TwilioModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
