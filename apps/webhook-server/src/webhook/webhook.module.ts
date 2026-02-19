import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { QueueModule } from '@github-sentinel/queue';

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
