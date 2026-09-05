import type { RequestUser, RequestMeta } from './types';

describe('auth types', () => {
  it('RequestUser can be constructed with id, email, jti', () => {
    const u: RequestUser = { id: '7', email: 'a@b.c', jti: 'jti-1' };
    expect(u.id).toBeDefined();
  });

  it('RequestMeta can be constructed', () => {
    const m: RequestMeta = { userAgent: 'ua', ipAddress: '1.2.3.4' };
    expect(m.userAgent).toBe('ua');
  });
});
