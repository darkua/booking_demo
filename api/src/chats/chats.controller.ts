import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { formatAppointmentTemplateVars } from '../bookings/booking-window.util';
import { BookingsService } from '../bookings/bookings.service';
import { ConfigService } from '@nestjs/config';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendTemplateDto } from './dto/send-template.dto';
import { MetaWhatsAppService } from '../twilio/meta-whatsapp.service';

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly whatsapp: MetaWhatsAppService,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list() {
    return this.chats.listChats();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const c = await this.chats.getById(id);
    if (!c) throw new NotFoundException('Chat not found');
    return c;
  }

  @Post(':id/messages')
  async sendSession(@Param('id') id: string, @Body() dto: SendMessageDto) {
    const chat = await this.chats.getById(id);
    if (!chat) throw new NotFoundException('Chat not found');
    if (!this.chats.within24h(chat.lastInboundAt)) {
      throw new BadRequestException({
        message:
          'Session messaging window expired (24h). Use template reminder instead.',
        within24h: false,
      });
    }
    const res = await this.whatsapp.sendSessionMessage(chat.phoneE164, dto.body);
    await this.chats.appendOutbound(id, dto.body, res.sid);
    return { ok: true, whatsapp: res };
  }

  @Post(':id/template-reminder')
  async sendTemplate(@Param('id') id: string, @Body() dto: SendTemplateDto) {
    const chat = await this.chats.getById(id);
    if (!chat) throw new NotFoundException('Chat not found');
    const contentSid = this.config.get<string>('appointmentTemplate.contentSid');
    const salonName = this.config.get<string>('booking.salonName') ?? 'AltaRise Beauty Sallon';
    if (!contentSid) {
      return { error: 'WA_APPOINTMENT_CONFIRMATION not configured' };
    }
    let v1 = dto.var1;
    let v2 = dto.var2;
    let v3 = dto.var3;
    let v4 = dto.var4;
    let v5 = dto.var5;
    if (dto.bookingId) {
      const b = await this.bookings.getById(dto.bookingId);
      if (b && b.phoneE164 === chat.phoneE164) {
        const zone = this.config.get<string>('booking.timezone') ?? 'Europe/Berlin';
        const vars = formatAppointmentTemplateVars(b, zone, salonName);
        v1 = v1 ?? vars['1'];
        v2 = v2 ?? vars['2'];
        v3 = v3 ?? vars['3'];
        v4 = v4 ?? vars['4'];
        v5 = v5 ?? vars['5'];
      }
    }
    if (!v1 || !v2 || !v3 || !v4 || !v5) {
      return { error: 'Provide bookingId or var1..var5 for template' };
    }
    const res = await this.whatsapp.sendTemplate(chat.phoneE164, contentSid, {
      '1': v1,
      '2': v2,
      '3': v3,
      '4': v4,
      '5': v5,
    });
    await this.chats.appendOutbound(
      id,
      `[Template reminder] ${v1} | ${v3} | ${v4} ${v5}`,
      res.sid,
    );
    return { ok: true, whatsapp: res };
  }
}
