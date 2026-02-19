import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventRecord, EventRecordDocument } from './schemas/event-record.schema';
import { WebhookEvent, WebhookEventType } from '@github-sentinel/github-types';

@Injectable()
export class EventRecordService {
  private readonly logger = new Logger(EventRecordService.name);

  constructor(
    @InjectModel(EventRecord.name) private readonly model: Model<EventRecordDocument>,
  ) {}

  async exists(deliveryId: string): Promise<boolean> {
    const count = await this.model.countDocuments({ deliveryId }).limit(1).exec();
    return count > 0;
  }

  async create(deliveryId: string, event: WebhookEvent): Promise<EventRecordDocument> {
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

  async findRecentByResource(
    resourceId: string,
    action: string,
    windowMinutes: number,
  ): Promise<EventRecordDocument | null> {
    const cutoff = new Date(Date.now() - windowMinutes * 60_000);
    return this.model.findOne({
      resourceId,
      action,
      eventTimestamp: { $gte: cutoff },
    })
    .sort({ eventTimestamp: -1 })
    .exec();
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
        return new Date(event.head_commit?.timestamp ?? new Date().toISOString());
      case WebhookEventType.TEAM:
        return new Date(event.team.created_at);
      case WebhookEventType.REPOSITORY:
        return new Date(event.repository.created_at);
    }
  }
}
