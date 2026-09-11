import { Module } from '@nestjs/common';
import { ViewsController } from './controllers/views.controller';
import { ViewsService } from './services/views.service';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../auth/sessions/sessions.module';

@Module({
  controllers: [ViewsController],
  providers: [ViewsService],
  imports: [AuthModule, SessionsModule],
})
export class ViewsModule {}