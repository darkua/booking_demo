import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StateService } from '../state/state.service';
import type { BookingFile } from './booking.types';

const SLOT_MS = 60 * 60 * 1000;

@Injectable()
export class BookingsService {
  constructor(private readonly state: StateService) {}

  bookingPath(id: string) {
    return path.join(this.state.bookingsDir, `${id}.json`);
  }

  async listAll(): Promise<BookingFile[]> {
    const files = await this.state.listJsonFiles(this.state.bookingsDir);
    const out: BookingFile[] = [];
    for (const f of files) {
      const id = f.replace(/\.json$/, '');
      const b = await this.state.readJsonFile<BookingFile>(this.bookingPath(id));
      if (b) out.push(b);
    }
    out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return out;
  }

  async listInRange(fromIso: string, toIso: string): Promise<BookingFile[]> {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    const all = await this.listAll();
    return all.filter((b) => {
      const t = new Date(b.start).getTime();
      return t >= from && t < to;
    });
  }

  async listForMonth(year: number, month1to12: number): Promise<BookingFile[]> {
    const start = new Date(Date.UTC(year, month1to12 - 1, 1));
    const end = new Date(Date.UTC(year, month1to12, 1));
    return this.listInRange(start.toISOString(), end.toISOString());
  }

  async getById(id: string): Promise<BookingFile | null> {
    return this.state.readJsonFile<BookingFile>(this.bookingPath(id));
  }

  async create(data: {
    clientId: string;
    start: string;
    services: string[];
    durationMinutes?: number;
  }): Promise<BookingFile> {
    const startMs = new Date(data.start).getTime();
    if (Number.isNaN(startMs)) throw new BadRequestException('Invalid start time');
    const duration = data.durationMinutes ?? 60;
    const endMs = startMs + duration * 60 * 1000;
    const all = await this.listAll();
    for (const b of all) {
      const bs = new Date(b.start).getTime();
      const be = bs + (b.durationMinutes ?? 60) * 60 * 1000;
      if (startMs < be && endMs > bs) {
        throw new BadRequestException('Time slot overlaps an existing booking');
      }
    }
    const booking: BookingFile = {
      id: randomUUID(),
      clientId: data.clientId,
      start: new Date(startMs).toISOString(),
      services: data.services,
      durationMinutes: duration,
    };
    await this.state.atomicWriteJson(this.bookingPath(booking.id), booking);
    return booking;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.state.deleteFile(this.bookingPath(id));
    if (!ok) throw new NotFoundException('Booking not found');
  }
}
