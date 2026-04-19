import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as twilio from 'twilio';

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const base = this.config.get<string>('twilio.webhookBaseUrl')?.replace(/\/$/, '');
    const token = this.config.get<string>('twilio.authToken');
    if (!base || !token) {
      this.logger.warn(
        'Twilio webhook rejected: set TWILIO_WEBHOOK_BASE_URL (public URL, no trailing slash) and TWILIO_AUTH_TOKEN',
      );
      throw new ForbiddenException('Twilio webhook base URL or auth token not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers['x-twilio-signature'] as string | undefined;
    const url = `${base}${req.originalUrl}`;
    const ok = twilio.validateRequest(token, signature ?? '', url, req.body ?? {});
    if (!ok) {
      this.logger.warn(
        `Twilio signature invalid for ${url} (check TWILIO_WEBHOOK_BASE_URL matches the URL Twilio POSTs to, including https and path)`,
      );
      throw new ForbiddenException('Invalid Twilio signature');
    }
    return true;
  }
}
