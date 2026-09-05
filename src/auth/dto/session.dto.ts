import { ApiProperty } from '@nestjs/swagger';

/**
 * One session as returned by GET /auth/sessions. The `id` is the JWT
 * `jti` claim; `userAgent` and `ipAddress` are captured at session
 * creation from the registration or login request.
 */
export class SessionDto {
  @ApiProperty({
    example: '4d2c1b6e-1f9a-4c2e-9a8e-2c4b1f0e2b7a',
    description: 'Session id; also the JWT jti claim.',
  })
  id!: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (X11; Linux x86_64) ...',
    nullable: true,
    description: 'User-Agent header from the request that created the session.',
  })
  userAgent!: string | null;

  @ApiProperty({
    example: '203.0.113.42',
    nullable: true,
    description: 'Client IP captured at session creation.',
  })
  ipAddress!: string | null;

  @ApiProperty({
    example: '2026-09-05T10:24:01.352Z',
    description: 'When the session row was created.',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-09-12T10:24:01.352Z',
    description:
      'When the session expires. Matches the refresh token `exp` claim; sessions past this time are rejected even if the JWT signature is valid.',
  })
  expiresAt!: Date;
}
