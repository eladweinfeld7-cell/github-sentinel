import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WebhookEventType } from '@github-sentinel/github-types';

export type EventRecordDocument = HydratedDocument<EventRecord>;

@Schema({ timestamps: true })
export class EventRecord {
  @Prop({ required: true })
  deliveryId: string;

  @Prop({ required: true, enum: Object.values(WebhookEventType) })
  eventType: WebhookEventType;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  resourceId: string;

  @Prop({ required: true, type: Date })
  eventTimestamp: Date;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop()
  senderLogin: string;

  @Prop()
  organizationLogin: string;
}

export const EventRecordSchema = SchemaFactory.createForClass(EventRecord);

EventRecordSchema.index({ deliveryId: 1 }, { unique: true });
EventRecordSchema.index({ resourceId: 1, action: 1, eventTimestamp: -1 });
EventRecordSchema.index({ eventTimestamp: 1 }, { expireAfterSeconds: 10_800 });
