import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class McpApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('mcpApiKey');
    if (!key) throw new UnauthorizedException('MCP_API_KEY not configured');
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-mcp-api-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (provided !== key) throw new UnauthorizedException();
    return true;
  }
}
