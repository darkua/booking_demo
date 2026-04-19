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
import { BookingsService } from '../bookings/bookings.service';
import { ConfigService } from '@nestjs/config';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendTemplateDto } from './dto/send-template.dto';
import { TwilioService } from '../twilio/twilio.service';

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly twilio: TwilioService,
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
    const res = await this.twilio.sendSessionMessage(chat.phoneE164, dto.body);
    await this.chats.appendOutbound(id, dto.body, res.sid);
    return { ok: true, twilio: res };
  }

  @Post(':id/template-reminder')
  async sendTemplate(@Param('id') id: string, @Body() dto: SendTemplateDto) {
    const chat = await this.chats.getById(id);
    if (!chat) throw new NotFoundException('Chat not found');
    const contentSid = this.config.get<string>('appointmentTemplate.contentSid');
    if (!contentSid) {
      return { error: 'TWILIO_APPOINTMENT_TEMPLATE_SID not configured' };
    }
    let v1 = dto.var1;
    let v2 = dto.var2;
    if (dto.bookingId) {
      const b = await this.bookings.getById(dto.bookingId);
      if (b && b.clientId === id) {
        const d = new Date(b.start);
        v1 = v1 ?? `${d.getMonth() + 1}/${d.getDate()}`;
        v2 =
          v2 ??
          d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    }
    if (!v1 || !v2) {
      return { error: 'Provide bookingId or var1 and var2 for template' };
    }
    const res = await this.twilio.sendTemplate(chat.phoneE164, contentSid, {
      '1': v1,
      '2': v2,
    });
    await this.chats.appendOutbound(
      id,
      `[Template reminder] ${v1} at ${v2}`,
      res.sid,
    );
    return { ok: true, twilio: res };
  }
}
