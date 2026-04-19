import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpenaiService } from '../openai/openai.service';

@ApiTags('admin-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/ai')
export class AdminController {
  constructor(private readonly openai: OpenaiService) {}

  @Post('chat')
  @ApiBody({
    schema: {
      properties: {
        messages: {
          type: 'array',
          items: { type: 'object' },
          description: 'OpenAI-compatible chat messages (user/assistant)',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Full message list including tool calls' })
  async chat(@Body() body: { messages: ChatCompletionMessageParam[] }) {
    const out = await this.openai.adminChat(body.messages ?? []);
    return { messages: out };
  }
}
