import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as twilio from 'twilio';

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const base = this.config.get<string>('twilio.webhookBaseUrl')?.replace(/\/$/, '');
    const token = this.config.get<string>('twilio.authToken');
    if (!base || !token) {
      throw new ForbiddenException('Twilio webhook base URL or auth token not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.headers['x-twilio-signature'] as string | undefined;
    const url = `${base}${req.originalUrl}`;
    const ok = twilio.validateRequest(token, signature ?? '', url, req.body ?? {});
    if (!ok) throw new ForbiddenException('Invalid Twilio signature');
    return true;
  }
}
