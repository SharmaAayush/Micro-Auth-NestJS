import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { TokenService } from './token.service';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key', // Should be env var in production
      signOptions: { expiresIn: '60s' }, // Default, we'll override in service
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, TokenService],
})
export class AuthModule {}
