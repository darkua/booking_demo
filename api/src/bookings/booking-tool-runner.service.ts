import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { BookingsService } from './bookings.service';

export type BookingToolContext = {
  phoneE164: string;
  clientNameHint: string;
};

@Injectable()
export class BookingToolRunnerService {
  private readonly logger = new Logger(BookingToolRunnerService.name);

  constructor(
    private readonly bookings: BookingsService,
    private readonly catalog: CatalogService,
  ) {}

  /** Nest HttpException or Error → message string for tool JSON. */
  private httpErrorMessage(e: unknown): string {
    if (e instanceof HttpException) {
      const r = e.getResponse();
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && 'message' in r) {
        const m = (r as { message: unknown }).message;
        return Array.isArray(m) ? m.join(' ') : String(m);
      }
      return e.message;
    }
    if (e instanceof Error) return e.message;
    return String(e);
  }

  /** Return JSON for the model so the webhook does not fail; optional overlap hint. */
  private toolHttpFailure(tool: string, e: unknown): string {
    const msg = this.httpErrorMessage(e);
    this.logger.warn(`${tool} failed: ${msg}`);
    const lower = msg.toLowerCase();
    const overlap =
      lower.includes('overlap') ||
      lower.includes('already booked') ||
      lower.includes('time slot');
    return JSON.stringify({
      error: msg,
      assistantInstruction: overlap
        ? 'That time slot is already taken. Call list_bookings_next_3_days to see existing bookings, tell the customer it is unavailable, and choose a different hour before retrying create_booking or update_booking.'
        : `The server rejected this: ${msg}. Fix inputs or explain clearly to the customer and retry if appropriate.`,
    });
  }

  async execute(
    name: string,
    args: unknown,
    ctx?: BookingToolContext,
  ): Promise<string> {
    switch (name) {
      case 'list_bookings_next_3_days': {
        const list = await this.bookings.listNextThreeLocalDays();
        return JSON.stringify({ bookings: list });
      }
      case 'list_bookings_month': {
        const a = args as { year: number | string; month: number | string };
        const year = typeof a.year === 'string' ? parseInt(a.year, 10) : a.year;
        const month = typeof a.month === 'string' ? parseInt(a.month, 10) : a.month;
        const list = await this.bookings.listForMonth(year, month);
        return JSON.stringify({ bookings: list });
      }
      case 'create_booking': {
        const a = args as {
          phoneE164?: string;
          clientName?: string;
          start: string;
          services: string[];
        };
        const phone = a.phoneE164?.trim() || ctx?.phoneE164;
        if (!phone) {
          return JSON.stringify({
            error:
              'phoneE164 is required (use the conversation phone from context or pass explicitly).',
          });
        }
        const clientName = a.clientName?.trim();
        if (!clientName) {
          return JSON.stringify({
            error:
              'clientName is required — ask the customer for their name before create_booking.',
          });
        }
        const services = Array.isArray(a.services)
          ? a.services.map((s) => String(s).trim()).filter(Boolean)
          : [];
        if (!services.length) {
          return JSON.stringify({
            error:
              'services must be a non-empty list of menu service names — confirm which services before create_booking.',
          });
        }
        this.logger.log(
          `create_booking tool: start=${JSON.stringify(a.start)} clientName=${JSON.stringify(clientName)} services=${JSON.stringify(services)} phone=${phone}`,
        );
        try {
          const b = await this.bookings.create({
            phoneE164: phone,
            clientName,
            start: a.start,
            services,
            durationMinutes: 60,
          });
          return JSON.stringify({
            booking: b,
            confirmationStatus: 'pending_customer_confirmation',
            assistantInstruction:
              'The booking exists but is NOT final until the customer confirms (CONFIRM/YES). The system has already sent a pending-details WhatsApp message with date/time/services and confirmation instructions. In your next message: recap slot + services and ask them to confirm. Do not say the appointment is fully confirmed or use all-set / see-you-then as final.',
          });
        } catch (e: unknown) {
          return this.toolHttpFailure('create_booking', e);
        }
      }
      case 'update_booking': {
        const a = args as {
          bookingId: string;
          start?: string;
          services?: string[];
          clientName?: string;
        };
        const patch: {
          start?: string;
          services?: string[];
          clientName?: string;
        } = {};
        if (a.start !== undefined) patch.start = a.start;
        if (a.clientName !== undefined) patch.clientName = a.clientName;
        if (a.services !== undefined) {
          const list = a.services.map((s) => String(s).trim()).filter(Boolean);
          if (!list.length) {
            return JSON.stringify({
              error: 'If updating services, provide at least one non-empty service name.',
            });
          }
          patch.services = list;
        }
        try {
          const b = await this.bookings.patch(a.bookingId, patch);
          return JSON.stringify({ booking: b });
        } catch (e: unknown) {
          return this.toolHttpFailure('update_booking', e);
        }
      }
      case 'cancel_booking': {
        const a = args as { bookingId: string };
        try {
          const b = await this.bookings.cancel(a.bookingId);
          return JSON.stringify({ booking: b });
        } catch (e: unknown) {
          return this.toolHttpFailure('cancel_booking', e);
        }
      }
      case 'list_services': {
        const s = await this.catalog.getServices();
        return JSON.stringify({ services: s });
      }
      default:
        return JSON.stringify({ error: `Unknown tool ${name}` });
    }
  }
}
