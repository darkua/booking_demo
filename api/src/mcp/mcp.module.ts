import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [BookingsModule],
  controllers: [McpController],
})
export class McpModule {}
