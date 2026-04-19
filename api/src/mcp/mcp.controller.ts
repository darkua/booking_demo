import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { McpApiKeyGuard } from '../auth/mcp-api-key.guard';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';

@ApiExcludeController()
@Controller('mcp')
@UseGuards(McpApiKeyGuard)
export class McpController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('bookings')
  list(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) {
      throw new BadRequestException('year and month query params required');
    }
    return this.bookings.listForMonth(y, m);
  }

  @Post('bookings')
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create({
      phoneE164: dto.phoneE164,
      clientName: dto.clientName,
      start: dto.start,
      services: dto.services,
      durationMinutes: dto.durationMinutes,
      sendConfirmationTemplate: dto.sendConfirmationTemplate,
    });
  }

  @Post('bookings/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.bookings.cancel(id);
  }
}
