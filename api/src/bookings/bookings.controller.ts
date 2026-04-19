import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({
    name: 'window',
    required: false,
    description: 'Use window=next3days for salon-timezone next 3 calendar days',
  })
  @ApiQuery({
    name: 'includeCanceled',
    required: false,
    description: 'If true, include canceled bookings (history); default excludes them from availability views',
  })
  list(
    @Query('window') window?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('includeCanceled') includeCanceled?: string,
  ) {
    const inc = includeCanceled === 'true' || includeCanceled === '1';
    if (window === 'next3days') {
      return this.bookings.listNextThreeLocalDays(inc);
    }
    if (year != null && month != null) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      return this.bookings.listForMonth(y, m, inc);
    }
    if (from && to) {
      return this.bookings.listInRange(from, to, inc);
    }
    return this.bookings.listAll();
  }

  @Post()
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

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.bookings.cancel(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookings.delete(id);
  }
}
