import { plainToInstance } from 'class-transformer';
import { SessionDto } from './session.dto';

describe('SessionDto', () => {
  it('accepts a fully populated payload', () => {
    const dto = plainToInstance(SessionDto, {
      id: '4d2c1b6e-1f9a-4c2e-9a8e-2c4b1f0e2b7a',
      userAgent: 'Mozilla/5.0',
      ipAddress: '203.0.113.42',
      createdAt: new Date('2026-09-05T10:24:01.352Z'),
      expiresAt: new Date('2026-09-12T10:24:01.352Z'),
    });
    expect(dto.id).toBe('4d2c1b6e-1f9a-4c2e-9a8e-2c4b1f0e2b7a');
    expect(dto.userAgent).toBe('Mozilla/5.0');
    expect(dto.ipAddress).toBe('203.0.113.42');
    expect(dto.createdAt).toEqual(new Date('2026-09-05T10:24:01.352Z'));
    expect(dto.expiresAt).toEqual(new Date('2026-09-12T10:24:01.352Z'));
  });

  it('accepts nullable userAgent and ipAddress', () => {
    const dto = plainToInstance(SessionDto, {
      id: 'jti-1',
      userAgent: null,
      ipAddress: null,
      createdAt: new Date(),
      expiresAt: new Date(),
    });
    expect(dto.userAgent).toBeNull();
    expect(dto.ipAddress).toBeNull();
  });
});
