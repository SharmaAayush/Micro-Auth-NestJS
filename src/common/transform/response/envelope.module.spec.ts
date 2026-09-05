import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvelopeModule } from './envelope.module';
import { EnvelopeInterceptor } from './envelope.interceptor';

describe('EnvelopeModule', () => {
  it('is decorated with @Global()', () => {
    // Reflect on the class to confirm the @Global metadata is present.
    const isGlobal = Reflect.getMetadata(
      '__module:global__',
      EnvelopeModule,
    ) as boolean | undefined;
    expect(isGlobal).toBe(true);
    // Sanity: @Global is imported and callable, so this would also have been
    // caught at import time if the decorator were misapplied.
    expect(Global).toBeDefined();
    expect(Module).toBeDefined();
  });

  it('declares a provider keyed by APP_INTERCEPTOR that uses EnvelopeInterceptor', () => {
    // Reflectively inspect the provider list since the APP_INTERCEPTOR token is
    // not directly resolvable from a TestingModule (it lives behind @Global +
    // APP_* wiring that only registers when the module is used in a full
    // NestApplicationContext).
    const providers = (Reflect.getMetadata('providers', EnvelopeModule) ??
      []) as Array<{ provide?: string; useClass?: unknown }>;
    const interceptorProvider = providers.find(
      (p) => p.provide === APP_INTERCEPTOR,
    );
    expect(interceptorProvider).toBeDefined();
    expect(interceptorProvider?.useClass).toBe(EnvelopeInterceptor);
  });

  it('compiles cleanly when imported into a testing module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EnvelopeModule],
    }).compile();
    await module.init();
    await module.close();
  });
});
