import { Module } from '@nestjs/common';
import { OpenaiModule } from '../openai/openai.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [OpenaiModule],
  controllers: [AdminController],
})
export class AdminModule {}
