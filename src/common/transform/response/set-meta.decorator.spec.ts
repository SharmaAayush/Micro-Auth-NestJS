import { SetMeta, SET_META_KEY } from './set-meta.decorator';

describe('SetMeta decorator', () => {
  it('sets the SET_META_KEY metadata to the given object on the method', () => {
    const target: object = {};
    const handler: object = jest.fn();
    const descriptor = { value: handler } as unknown as PropertyDescriptor;
    const meta: Record<string, unknown> = { requestId: 'r1' };

    SetMeta(meta)(target, 'handler', descriptor);

    const stored: unknown = Reflect.getMetadata(SET_META_KEY, handler);
    expect(stored).toEqual(meta);
  });
});
