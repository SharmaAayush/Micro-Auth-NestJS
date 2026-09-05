import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';
import { SET_META_KEY } from './set-meta.decorator';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }
    return next.handle().pipe(
      map((value: unknown) => {
        const meta = this.reflector.getAllAndOverride<
          Record<string, unknown> | undefined
        >(SET_META_KEY, [context.getHandler(), context.getClass()]);
        return meta ? { data: value, meta } : { data: value };
      }),
    );
  }
}
