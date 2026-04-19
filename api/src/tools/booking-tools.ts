import OpenAI from 'openai';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';

export const BOOKING_TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_bookings_month',
      description:
        'List all bookings for a given calendar month (local UTC month boundaries).',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'e.g. 2026' },
          month: { type: 'integer', description: '1-12' },
        },
        required: ['year', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description:
        'Create a one-hour appointment. clientId is the internal chat id (base64url of E.164 phone).',
      parameters: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
          start: {
            type: 'string',
            description: 'ISO8601 start time',
          },
          services: {
            type: 'array',
            items: { type: 'string' },
            description: 'One or more service names from the salon menu',
          },
        },
        required: ['clientId', 'start', 'services'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'List available salon services.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export async function executeBookingTool(
  name: string,
  args: unknown,
  bookings: BookingsService,
  catalog: CatalogService,
): Promise<string> {
  switch (name) {
    case 'list_bookings_month': {
      const a = args as { year: number | string; month: number | string };
      const year = typeof a.year === 'string' ? parseInt(a.year, 10) : a.year;
      const month = typeof a.month === 'string' ? parseInt(a.month, 10) : a.month;
      const list = await bookings.listForMonth(year, month);
      return JSON.stringify({ bookings: list });
    }
    case 'create_booking': {
      const a = args as { clientId: string; start: string; services: string[] };
      const b = await bookings.create({
        clientId: a.clientId,
        start: a.start,
        services: a.services,
        durationMinutes: 60,
      });
      return JSON.stringify({ booking: b });
    }
    case 'list_services': {
      const s = await catalog.getServices();
      return JSON.stringify({ services: s });
    }
    default:
      return JSON.stringify({ error: `Unknown tool ${name}` });
  }
}
