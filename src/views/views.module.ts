import { Module } from '@nestjs/common';
import { ViewsController } from './controllers/views.controller';
import { ViewsService } from './services/views.service';

@Module({
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}