import OpenAI from 'openai';

export const BOOKING_TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_bookings_next_3_days',
      description:
        'List bookings for the next 3 calendar days (salon timezone). Use this instead of month view for WhatsApp.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_bookings_month',
      description: 'List bookings for a calendar month (UTC month boundaries).',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer' },
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
        'Create a one-hour appointment when clientName, services (non-empty), and start (ISO8601 within next 3 days) are known. On WhatsApp, omit phoneE164 — the server uses the inbound WhatsApp number from context; never ask the user for their phone. The server sends a WhatsApp template for the customer to confirm; the booking stays pending until they confirm—do not tell them it is fully confirmed in your chat reply.',
      parameters: {
        type: 'object',
        properties: {
          phoneE164: {
            type: 'string',
            description:
              'Optional. For WhatsApp, omit — conversation phone is applied automatically. Only pass if an admin tool explicitly needs a different number.',
          },
          clientName: { type: 'string', description: "Client's name as agreed in chat" },
          start: { type: 'string', description: 'ISO8601 start time' },
          services: {
            type: 'array',
            items: { type: 'string' },
            description: 'One or more menu service names',
            minItems: 1,
          },
        },
        required: ['clientName', 'start', 'services'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_booking',
      description:
        'Change an existing booking time, services, or client name (same 3-day window rules for start). Not for canceled bookings. Apply when the customer’s new choices are clear — do not ask them to wait or hold; call this tool and then tell them what changed.',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          start: { type: 'string' },
          services: { type: 'array', items: { type: 'string' }, minItems: 1 },
          clientName: { type: 'string' },
        },
        required: ['bookingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description:
        'Cancel an appointment by id. Marks it canceled (kept for history); the time slot becomes available again.',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string', description: 'Booking id from list_bookings_*' },
        },
        required: ['bookingId'],
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
