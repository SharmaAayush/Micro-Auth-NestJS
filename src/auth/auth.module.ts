import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { TokenService } from './token.service';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.secret'),
        // We don't set signOptions here because we want to set expiresIn per token type
        // in the TokenService.
        signOptions: {},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, TokenService],
})
export class AuthModule {}
