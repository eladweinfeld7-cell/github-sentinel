import { Controller, Post, Req, UseGuards, HttpCode, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SignatureGuard } from './guards/signature.guard';
import { QueueProducerService, WebhookJobData } from '@github-sentinel/queue';
import { WebhookEvent, WebhookEventType } from '@github-sentinel/github-types';

const SUPPORTED_EVENTS = new Set(Object.values(WebhookEventType));
const MAX_QUEUE_SIZE = 10_000;

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly queueProducer: QueueProducerService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(SignatureGuard)
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  async handleWebhook(@Req() req: Request): Promise<{ status: string }> {
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    if (!SUPPORTED_EVENTS.has(eventType as WebhookEventType)) {
      this.logger.debug(`Ignoring unsupported event type: ${eventType}`);
      return { status: 'ignored' };
    }

    const queueSize = await this.queueProducer.getQueueSize();
    if (queueSize >= MAX_QUEUE_SIZE) {
      this.logger.warn(`Queue full (${queueSize}), applying backpressure`);
      throw new ServiceUnavailableException('Queue full, retry later');
    }

    const event: WebhookEvent = {
      ...req.body,
      type: eventType as WebhookEventType,
    };

    const jobData: WebhookJobData = {
      deliveryId,
      event,
      receivedAt: new Date().toISOString(),
    };

    await this.queueProducer.enqueue(jobData);

    this.logger.log(`Enqueued ${eventType} event [${deliveryId}]`);
    return { status: 'queued' };
  }
}
