import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatMessage } from '../chats/chat.types';
import {
  BookingToolContext,
  BookingToolRunnerService,
} from '../bookings/booking-tool-runner.service';
import { BOOKING_TOOL_DEFINITIONS } from '../bookings/booking-tools.definitions';
import { CatalogService } from '../catalog/catalog.service';
import { bookingTimeZone, formatSalonNowAndBookingDaysPrompt } from '../bookings/booking-window.util';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly bookingTools: BookingToolRunnerService,
    private readonly catalog: CatalogService,
  ) {
    const key = this.config.get<string>('openai.apiKey');
    if (key) this.client = new OpenAI({ apiKey: key });
  }

  get model() {
    return this.config.get<string>('openai.model') ?? 'gpt-4o-mini';
  }

  private ensureClient(): OpenAI {
    if (!this.client) throw new Error('OPENAI_API_KEY not configured');
    return this.client;
  }

  /** Map stored WhatsApp messages to OpenAI roles (full thread, newest last). */
  private chatHistoryToOpenAIMessages(
    messages: ChatMessage[],
  ): OpenAI.ChatCompletionMessageParam[] {
    const max = this.config.get<number>('whatsappHistoryMaxMessages') ?? 80;
    const slice = messages.length > max ? messages.slice(-max) : messages;
    const out: OpenAI.ChatCompletionMessageParam[] = [];
    for (const m of slice) {
      const text = (m.body ?? '').trim();
      if (!text) continue;
      out.push({
        role: m.direction === 'in' ? 'user' : 'assistant',
        content: text,
      });
    }
    return out;
  }

  async runToolLoop(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { toolContext?: BookingToolContext; maxRounds?: number },
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const client = this.ensureClient();
    const max = options?.maxRounds ?? 8;
    const ctx = options?.toolContext;
    let current = [...messages];
    for (let i = 0; i < max; i++) {
      const completion = await client.chat.completions.create({
        model: this.model,
        messages: current,
        tools: BOOKING_TOOL_DEFINITIONS,
        tool_choice: 'auto',
      });
      const choice = completion.choices[0];
      const msg = choice.message;
      current.push(msg);
      const calls = msg.tool_calls;
      if (!calls?.length) break;
      for (const call of calls) {
        if (call.type !== 'function') continue;
        let args: unknown = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        const output = await this.bookingTools.execute(
          call.function.name,
          args,
          ctx,
        );
        current.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        });
      }
    }
    return current;
  }

  async replyForWhatsApp(context: {
    systemExtra: string;
    chatMessages: ChatMessage[];
    toolContext: BookingToolContext;
  }): Promise<string> {
    const zone = bookingTimeZone(this.config.get<string>('booking.timezone') ?? undefined);
    const salonCalendar = formatSalonNowAndBookingDaysPrompt(zone);
    const services = this.catalog.formatServicesForPrompt();
    const system = `You are AltaRise Beauty Salon's WhatsApp assistant. Be concise and friendly.

${salonCalendar}

BOOKING RULES (non-negotiable):
- **Phone:** Never ask the customer for their phone number. This chat is WhatsApp — their number is already known to the system (see Conversation phone in context). For **create_booking**, omit **phoneE164** so the server uses that inbound WhatsApp number automatically. Do not ask them to type it, confirm it, or provide it.
- A booking is only valid when you have ALL of: (1) the client's full name (never guess; if the display name is "Unknown" you must ask), (2) one or more services from the menu by exact name, (3) an agreed date/time on one of the three bookable days listed above, as ISO8601 in create_booking. The phone is always taken from the WhatsApp session — not from the user’s message.
- Do NOT call create_booking until name, services (non-empty), and time are explicitly settled in the conversation.
- Each appointment is 1 hour. Use list_bookings_next_3_days and list_services tools to avoid conflicts and to pick valid service names (canceled appointments do not block slots).
- To cancel an appointment use cancel_booking with the booking id from list tools.
- Never use a year or calendar day that is not in the AUTHORITATIVE CLOCK / bookable days block above.

WHATSAPP CONFIRMATION FLOW (non-negotiable):
- After create_booking succeeds, the system sends the customer a WhatsApp **template** message so they can **confirm** the appointment (e.g. button or reply CONFIRM/YES). Until they complete that step, the booking is **pending**, not final.
- In your **reply text** after create_booking: do **not** say the appointment is fully confirmed, do not celebrate as if it is final, and do not use phrases like "you're all set", "confirmed", "see you then", "your appointment is booked" as a done deal.
- Instead: briefly recap date/time/services, say they should **confirm using the WhatsApp template message** (or follow the prompt on that message). Only after they confirm does the salon treat it as final (you may get a later message when they have confirmed).
- If the tool result says confirmation is pending, follow that instruction exactly.

UPDATING AN EXISTING BOOKING (non-negotiable):
- For changes to time, services, or name on a booking that already exists, use **update_booking** (identify the booking with list_bookings_next_3_days first when needed).
- Do **not** tell the customer to wait, hold, or pause — no "please hold", "one moment", "wait while I update", or asking them to wait for extra confirmation. Call **update_booking** when the new details are clear, then reply with the updated details in the same response flow.
- A successful update is applied by the server immediately; your reply should **confirm what changed** (new time, services, etc.) in plain language. Do not imply a separate approval step unless the tool returns an error.

Service menu (names must match when booking):
${services}

${context.systemExtra}`;

    const history = this.chatHistoryToOpenAIMessages(context.chatMessages);
    if (!history.length) {
      this.logger.warn('WhatsApp reply with empty chat history');
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...history,
    ];

    const finalMsgs = await this.runToolLoop(messages, {
      toolContext: context.toolContext,
    });
    const last = finalMsgs[finalMsgs.length - 1];
    const text =
      last.role === 'assistant' && typeof last.content === 'string'
        ? last.content
        : '';
    if (!text) {
      this.logger.warn('Empty assistant text after tool loop');
      return 'Thanks for your message! A team member will get back to you shortly.';
    }
    return text;
  }

  async adminChat(
    messages: OpenAI.ChatCompletionMessageParam[],
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const zone = bookingTimeZone(this.config.get<string>('booking.timezone') ?? undefined);
    const salonCalendar = formatSalonNowAndBookingDaysPrompt(zone);
    const services = this.catalog.formatServicesForPrompt();
    const system: OpenAI.ChatCompletionMessageParam = {
      role: 'system',
      content: `You are an internal admin copilot for AltaRise Beauty Salon.

${salonCalendar}

Every booking MUST include: clientName, phoneE164, non-empty services list, start (ISO on one of the bookable days above), then create_booking.
Use tools: list_bookings_next_3_days, list_bookings_month, create_booking, update_booking, cancel_booking, list_services.
For update_booking: do not ask the user to wait or hold — apply the change and report the result.
Services menu:
${services}
Be concise.`,
    };
    const full = [system, ...messages.filter((m) => m.role !== 'system')];
    return this.runToolLoop(full);
  }
}
