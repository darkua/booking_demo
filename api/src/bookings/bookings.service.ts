import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StateService } from '../state/state.service';
import { MetaWhatsAppService } from '../twilio/meta-whatsapp.service';
import type { BookingFile } from './booking.types';
import {
  bookingTimeZone,
  bookingWindowDiagnostics,
  formatTemplateVars,
  isStartWithinNextThreeCalendarDays,
  nextThreeLocalDaysUtcRangeIso,
} from './booking-window.util';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly state: StateService,
    private readonly config: ConfigService,
    private readonly whatsapp: MetaWhatsAppService,
  ) {}

  private tz() {
    return bookingTimeZone(this.config.get<string>('booking.timezone') ?? undefined);
  }

  bookingPath(id: string) {
    return path.join(this.state.bookingsDir, `${id}.json`);
  }

  private debug(msg: string) {
    if (this.config.get<string>('debugState') === 'true') {
      this.logger.debug(msg);
    }
  }

  /** Legacy files may omit `canceled`; treat missing as false. */
  private normalizeBooking(b: BookingFile): BookingFile {
    return { ...b, canceled: b.canceled === true };
  }

  private async readBooking(id: string): Promise<BookingFile | null> {
    const b = await this.state.readJsonFile<BookingFile>(this.bookingPath(id));
    if (!b?.id) return null;
    return this.normalizeBooking(b);
  }

  private async loadAllBookings(): Promise<BookingFile[]> {
    const files = await this.state.listJsonFiles(this.state.bookingsDir);
    const out: BookingFile[] = [];
    for (const f of files) {
      const id = f.replace(/\.json$/, '');
      const b = await this.readBooking(id);
      if (b) out.push(b);
    }
    out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return out;
  }

  async listAll(): Promise<BookingFile[]> {
    return this.loadAllBookings();
  }

  async listInRange(
    fromIso: string,
    toIso: string,
    includeCanceled = false,
  ): Promise<BookingFile[]> {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    const all = await this.loadAllBookings();
    const inRange = all.filter((b) => {
      const t = new Date(b.start).getTime();
      return t >= from && t < to;
    });
    return includeCanceled ? inRange : inRange.filter((b) => !b.canceled);
  }

  async listForMonth(
    year: number,
    month1to12: number,
    includeCanceled = false,
  ): Promise<BookingFile[]> {
    const start = new Date(Date.UTC(year, month1to12 - 1, 1));
    const end = new Date(Date.UTC(year, month1to12, 1));
    return this.listInRange(start.toISOString(), end.toISOString(), includeCanceled);
  }

  async listNextThreeLocalDays(includeCanceled = false): Promise<BookingFile[]> {
    const range = nextThreeLocalDaysUtcRangeIso(this.tz());
    return this.listInRange(range.from, range.to, includeCanceled);
  }

  async getById(id: string): Promise<BookingFile | null> {
    return this.readBooking(id);
  }

  private assertSlotInWindow(startIso: string) {
    const zone = this.tz();
    if (!isStartWithinNextThreeCalendarDays(startIso, zone)) {
      const diag = bookingWindowDiagnostics(startIso, zone);
      this.logger.warn(
        `Booking window check failed: ${JSON.stringify(diag)}`,
      );
      throw new BadRequestException(
        'Booking must fall within the next 3 calendar days (salon timezone)',
      );
    }
  }

  private hasOverlap(
    startMs: number,
    endMs: number,
    excludeBookingId: string | undefined,
    all: BookingFile[],
  ): boolean {
    for (const b of all) {
      if (b.canceled) continue;
      if (excludeBookingId && b.id === excludeBookingId) continue;
      const bs = new Date(b.start).getTime();
      const be = bs + (b.durationMinutes ?? 60) * 60 * 1000;
      if (startMs < be && endMs > bs) return true;
    }
    return false;
  }

  async create(data: {
    phoneE164: string;
    clientName: string;
    start: string;
    services: string[];
    durationMinutes?: number;
    sendConfirmationTemplate?: boolean;
  }): Promise<BookingFile> {
    const startMs = new Date(data.start).getTime();
    if (Number.isNaN(startMs)) throw new BadRequestException('Invalid start time');
    this.assertSlotInWindow(data.start);
    const duration = data.durationMinutes ?? 60;
    const endMs = startMs + duration * 60 * 1000;
    const all = await this.loadAllBookings();
    if (this.hasOverlap(startMs, endMs, undefined, all)) {
      throw new BadRequestException('Time slot overlaps an existing booking');
    }
    const name = data.clientName.trim();
    if (!name) throw new BadRequestException('clientName is required');
    if (!data.services?.length) {
      throw new BadRequestException('At least one service is required');
    }
    const booking: BookingFile = {
      id: randomUUID(),
      phoneE164: data.phoneE164.trim(),
      clientName: name,
      start: new Date(startMs).toISOString(),
      services: data.services,
      durationMinutes: duration,
      confirmed: false,
      canceled: false,
    };
    const file = this.bookingPath(booking.id);
    this.debug(`write booking ${file}`);
    await this.state.atomicWriteJson(file, booking);
    if (data.sendConfirmationTemplate !== false) {
      await this.sendConfirmationTemplate(booking);
    }
    return booking;
  }

  private async sendConfirmationTemplate(booking: BookingFile) {
    const contentSid = this.config.get<string>('appointmentTemplate.contentSid');
    if (!contentSid) {
      this.logger.warn('WA_APPOINTMENT_TEMPLATE_NAME not set; skip confirmation template');
      return;
    }
    const vars = formatTemplateVars(booking.start, this.tz());
    try {
      await this.whatsapp.sendTemplate(booking.phoneE164, contentSid, vars);
      this.logger.log(`Confirmation template sent for booking ${booking.id}`);
    } catch (err: unknown) {
      this.logger.error(
        `WhatsApp template failed for booking ${booking.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async patch(
    id: string,
    partial: {
      start?: string;
      services?: string[];
      clientName?: string;
      confirmed?: boolean;
    },
  ): Promise<BookingFile> {
    const current = await this.getById(id);
    if (!current) throw new NotFoundException('Booking not found');
    if (current.canceled) {
      throw new BadRequestException('Booking is canceled');
    }
    const nextStart = partial.start ?? current.start;
    if (partial.start !== undefined) {
      const t = new Date(nextStart).getTime();
      if (Number.isNaN(t)) throw new BadRequestException('Invalid start time');
      this.assertSlotInWindow(nextStart);
      const duration = current.durationMinutes ?? 60;
      const endMs = t + duration * 60 * 1000;
      const all = await this.loadAllBookings();
      if (this.hasOverlap(t, endMs, id, all)) {
        throw new BadRequestException('Time slot overlaps an existing booking');
      }
    }
    const next: BookingFile = {
      ...current,
      ...(partial.start !== undefined ? { start: nextStart } : {}),
      ...(partial.services !== undefined ? { services: partial.services } : {}),
      ...(partial.clientName !== undefined
        ? { clientName: partial.clientName.trim() || current.clientName }
        : {}),
      ...(partial.confirmed !== undefined ? { confirmed: partial.confirmed } : {}),
    };
    this.debug(`patch booking ${this.bookingPath(id)}`);
    await this.state.atomicWriteJson(this.bookingPath(id), next);
    return next;
  }

  async confirmLatestUnconfirmedForPhone(phoneE164: string): Promise<BookingFile | null> {
    const all = await this.loadAllBookings();
    const mine = all.filter(
      (b) => b.phoneE164 === phoneE164 && !b.confirmed && !b.canceled,
    );
    if (!mine.length) return null;
    mine.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
    const latest = mine[0];
    return this.patch(latest.id, { confirmed: true });
  }

  /** Marks booking as canceled; file is kept. Idempotent if already canceled. */
  async cancel(id: string): Promise<BookingFile> {
    const current = await this.getById(id);
    if (!current) throw new NotFoundException('Booking not found');
    if (current.canceled) return current;
    const next: BookingFile = { ...current, canceled: true };
    this.debug(`cancel booking ${this.bookingPath(id)}`);
    await this.state.atomicWriteJson(this.bookingPath(id), next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.state.deleteFile(this.bookingPath(id));
    if (!ok) throw new NotFoundException('Booking not found');
  }
}
