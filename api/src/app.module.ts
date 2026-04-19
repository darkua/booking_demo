import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BookingsModule } from './bookings/bookings.module';
import { CatalogModule } from './catalog/catalog.module';
import { ChatsModule } from './chats/chats.module';
import { McpModule } from './mcp/mcp.module';
import { OpenaiModule } from './openai/openai.module';
import { StateModule } from './state/state.module';
import { TwilioModule } from './twilio/twilio.module';
import { WebhookModule } from './twilio/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),
    StateModule,
    CatalogModule,
    BookingsModule,
    ChatsModule,
    TwilioModule,
    OpenaiModule,
    AuthModule,
    AdminModule,
    McpModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
