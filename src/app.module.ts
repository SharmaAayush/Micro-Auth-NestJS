import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';
import dataSource from './db/typeorm.config';
import { EnvelopeModule } from './common/transform/response/envelope.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({}), // Empty factory
      dataSourceFactory: async () => {
        // Reuses the identical configuration instance
        return dataSource.initialize();
      },
    }),
    AuthModule,
    HealthModule,
    EnvelopeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
