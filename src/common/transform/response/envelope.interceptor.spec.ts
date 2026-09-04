import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, lastValueFrom } from 'rxjs';
import { EnvelopeInterceptor } from './envelope.interceptor';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';
import { SET_META_KEY } from './set-meta.decorator';

const buildInterceptor = (handlerMeta: Record<string, unknown> = {}, classMeta: Record<string, unknown> = {}): {
  interceptor: EnvelopeInterceptor;
  context: ExecutionContext;
} => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    if (key === SKIP_ENVELOPE_KEY) return handlerMeta.skip ?? classMeta.skip;
    if (key === SET_META_KEY) return handlerMeta.meta ?? classMeta.meta;
    return undefined;
  });
  const context = {
    getHandler: () => handlerMeta,
    getClass: () => classMeta,
    switchToHttp: () => ({}),
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getRequest: () => undefined,
    getResponse: () => undefined,
    getNext: () => undefined,
  } as unknown as ExecutionContext;
  return { interceptor: new EnvelopeInterceptor(reflector), context };
};

describe('EnvelopeInterceptor', () => {
  it('wraps a value in { data }', async () => {
    const { interceptor, context } = buildInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ accessToken: 'x' }) } as CallHandler).pipe(),
    );
    expect(result).toEqual({ data: { accessToken: 'x' } });
  });

  it('merges meta when @SetMeta is applied', async () => {
    const { interceptor, context } = buildInterceptor({ meta: { requestId: 'r1' } });
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('hello') } as CallHandler).pipe(),
    );
    expect(result).toEqual({ data: 'hello', meta: { requestId: 'r1' } });
  });

  it('returns the original value when @SkipEnvelope is set', async () => {
    const { interceptor, context } = buildInterceptor({ skip: true });
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ status: 'alive' }) } as CallHandler).pipe(),
    );
    expect(result).toEqual({ status: 'alive' });
  });

  it('propagates errors from the handler unchanged', async () => {
    const { interceptor, context } = buildInterceptor();
    const observable = interceptor.intercept(context, {
      handle: () => throwError(() => new Error('boom')),
    } as CallHandler);
    await expect(lastValueFrom(observable)).rejects.toThrow('boom');
  });
});
