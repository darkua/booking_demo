import { Module } from '@nestjs/common';
import { TwilioModule } from '../twilio/twilio.module';
import { BookingToolRunnerService } from './booking-tool-runner.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TwilioModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingToolRunnerService],
  exports: [BookingsService, BookingToolRunnerService],
})
export class BookingsModule {}
