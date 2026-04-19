import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const start = Date.now();
    const label = `${req.method} ${req.url}`;
    return next.handle().pipe(
      finalize(() => {
        const res = context.switchToHttp().getResponse<{ statusCode?: number }>();
        const ms = Date.now() - start;
        const code = res.statusCode ?? '?';
        this.logger.log(`${label} → ${code} ${ms}ms`);
      }),
    );
  }
}
