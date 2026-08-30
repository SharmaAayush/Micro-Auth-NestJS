import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule, TerminusModule, ScheduleModule.forRoot()],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
