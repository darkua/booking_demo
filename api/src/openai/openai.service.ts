import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { BOOKING_TOOL_DEFINITIONS, executeBookingTool } from '../tools/booking-tools';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
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

  async runToolLoop(
    messages: OpenAI.ChatCompletionMessageParam[],
    options?: { maxRounds?: number },
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const client = this.ensureClient();
    const max = options?.maxRounds ?? 8;
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
        const output = await executeBookingTool(
          call.function.name,
          args,
          this.bookings,
          this.catalog,
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
    userMessage: string;
  }): Promise<string> {
    const services = this.catalog.formatServicesForPrompt();
    const system = `You are AltaRise Beauty Salon's WhatsApp assistant. Be concise and friendly.
Help clients book appointments. All appointments last 1 hour. Avoid double-booking; use tools to check and create bookings.
Available services (names must match when booking):
${services}

${context.systemExtra}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      { role: 'user', content: context.userMessage },
    ];
    const finalMsgs = await this.runToolLoop(messages);
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
    const services = this.catalog.formatServicesForPrompt();
    const system: OpenAI.ChatCompletionMessageParam = {
      role: 'system',
      content: `You are an internal admin copilot for AltaRise Beauty Salon.
You can list services and manage bookings for the current month using tools.
Services menu:
${services}
Be concise.`,
    };
    const full = [system, ...messages.filter((m) => m.role !== 'system')];
    return this.runToolLoop(full);
  }
}
