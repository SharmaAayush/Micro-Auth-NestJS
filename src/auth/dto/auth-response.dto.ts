import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape of the JSON body returned by POST /auth/register, /auth/login,
 * and /auth/refresh-token.
 *
 * The global EnvelopeInterceptor wraps the controller return value in
 * `{ data: <value> }`, so the wire body looks like `{ data: { accessToken } }`.
 * The `AccessTokenResponseDto` documents the inner shape; the wrapper is
 * implicit in the global envelope and visible in the response example below.
 */
export class AccessTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Signed JWT access token. Send as `Authorization: Bearer <token>` on subsequent requests.',
  })
  accessToken!: string;
}
