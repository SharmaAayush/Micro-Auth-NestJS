import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of an existing user.',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description:
      'Plaintext password. Validated against the stored bcrypt hash.',
  })
  @IsString()
  password!: string;
}
