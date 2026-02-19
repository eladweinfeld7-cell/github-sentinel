import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhookEvent } from '@github-sentinel/github-types';

export interface WebhookJobData {
  deliveryId: string;
  event: WebhookEvent;
  receivedAt: string;
}

@Injectable()
export class QueueProducerService {
  constructor(@InjectQueue('webhook-events') private readonly queue: Queue) {}

  async enqueue(data: WebhookJobData): Promise<void> {
    await this.queue.add('process-event', data, {
      jobId: data.deliveryId,
      attempts: 5,
      backoff: {
        type: 'custom',
      },
    });
  }

  async getQueueSize(): Promise<number> {
    return this.queue.count();
  }
}
