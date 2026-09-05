import { SetMeta, SET_META_KEY } from './set-meta.decorator';

describe('SetMeta decorator', () => {
  it('sets the SET_META_KEY metadata to the given object on the method', () => {
    const target = {};
    const descriptor = { value: jest.fn() } as unknown as PropertyDescriptor;
    SetMeta({ requestId: 'r1' })(target, 'handler', descriptor);

    const stored = Reflect.getMetadata(SET_META_KEY, descriptor.value);
    expect(stored).toEqual({ requestId: 'r1' });
  });
});
