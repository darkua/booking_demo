import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

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
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    if (year != null && month != null) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      return this.bookings.listForMonth(y, m);
    }
    if (from && to) {
      return this.bookings.listInRange(from, to);
    }
    return this.bookings.listAll();
  }

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create({
      clientId: dto.clientId,
      start: dto.start,
      services: dto.services,
      durationMinutes: dto.durationMinutes,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookings.delete(id);
  }
}
