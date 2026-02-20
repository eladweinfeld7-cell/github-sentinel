import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventRecord,
  EventRecordDocument,
} from './schemas/event-record.schema';
import { WebhookEvent, WebhookEventType } from '@github-sentinel/github-types';

@Injectable()
export class EventRecordService {
  constructor(
    @InjectModel(EventRecord.name)
    private readonly model: Model<EventRecordDocument>,
  ) {}

  async exists(deliveryId: string): Promise<boolean> {
    const count = await this.model
      .countDocuments({ deliveryId })
      .limit(1)
      .exec();
    return count > 0;
  }

  async create(
    deliveryId: string,
    event: WebhookEvent,
  ): Promise<EventRecordDocument> {
    return this.model.create({
      deliveryId,
      eventType: event.type,
      action: this.extractAction(event),
      resourceId: this.extractResourceId(event),
      eventTimestamp: this.extractTimestamp(event),
      payload: event as unknown as Record<string, unknown>,
      senderLogin: event.sender.login,
      organizationLogin: event.organization.login,
    });
  }

  private extractAction(event: WebhookEvent): string {
    switch (event.type) {
      case WebhookEventType.PUSH:
        return WebhookEventType.PUSH;
      case WebhookEventType.TEAM:
        return event.action;
      case WebhookEventType.REPOSITORY:
        return event.action;
    }
  }

  private extractResourceId(event: WebhookEvent): string {
    switch (event.type) {
      case WebhookEventType.PUSH:
        return String(event.repository.id);
      case WebhookEventType.TEAM:
        return String(event.team.id);
      case WebhookEventType.REPOSITORY:
        return String(event.repository.id);
    }
  }

  private extractTimestamp(event: WebhookEvent): Date {
    switch (event.type) {
      case WebhookEventType.PUSH:
        return new Date(
          event.head_commit?.timestamp ?? new Date().toISOString(),
        );
      case WebhookEventType.TEAM:
        return new Date();
      case WebhookEventType.REPOSITORY:
        return new Date(event.repository.created_at);
    }
  }
}
