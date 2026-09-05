import { getClientIp } from './client-ip.util';
import type { Request } from 'express';

const buildReq = (
  headers: Record<string, string | string[] | undefined> = {},
  ip?: string,
  remoteAddress?: string,
): Request =>
  ({
    headers,
    ip,
    socket: remoteAddress
      ? { remoteAddress }
      : ({} as { remoteAddress?: string }),
  }) as unknown as Request;

describe('getClientIp', () => {
  it('returns the first value from a comma-separated x-forwarded-for header', () => {
    const req = buildReq(
      { 'x-forwarded-for': '203.0.113.42, 10.0.0.1, 10.0.0.2' },
      '127.0.0.1',
    );
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  it('trims whitespace around the forwarded IP', () => {
    const req = buildReq(
      { 'x-forwarded-for': '   203.0.113.42   , 10.0.0.1' },
      '127.0.0.1',
    );
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  it('falls back to req.ip when the forwarded header is empty', () => {
    const req = buildReq({ 'x-forwarded-for': '' }, '10.0.0.5');
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('falls back to req.ip when the first forwarded IP is empty after the split', () => {
    const req = buildReq({ 'x-forwarded-for': ', 10.0.0.1' }, '10.0.0.5');
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('falls back to req.ip when no forwarded header is present', () => {
    const req = buildReq({}, '10.0.0.5');
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('falls back to req.socket.remoteAddress when req.ip is undefined', () => {
    const req = buildReq({}, undefined, '10.0.0.6');
    expect(getClientIp(req)).toBe('10.0.0.6');
  });

  it('returns null when nothing is available', () => {
    const req = buildReq({});
    expect(getClientIp(req)).toBeNull();
  });

  it('ignores a forwarded header that is an array (unexpected shape)', () => {
    const req = buildReq(
      { 'x-forwarded-for': ['203.0.113.42', '10.0.0.1'] },
      '10.0.0.5',
    );
    expect(getClientIp(req)).toBe('10.0.0.5');
  });
});
