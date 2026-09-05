import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EnvelopeInterceptor } from './envelope.interceptor';

@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class EnvelopeModule {}
