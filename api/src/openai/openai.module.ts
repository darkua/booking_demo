import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OpenaiService } from './openai.service';

@Module({
  imports: [BookingsModule, CatalogModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
