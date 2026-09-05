import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address; must be unique across users.',
    format: 'email',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description:
      'Plaintext password. Minimum 8 characters; hashed before storage.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'Ada Lovelace',
    description: 'Optional display name. Max 120 characters.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
