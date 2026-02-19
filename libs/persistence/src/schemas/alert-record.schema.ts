import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  AlertStatus,
  RuleName,
  Severity,
} from '@github-sentinel/detection-engine';

export type AlertRecordDocument = HydratedDocument<AlertRecord>;

@Schema({ timestamps: true })
export class AlertRecord {
  @Prop({ required: true, enum: Object.values(RuleName) })
  ruleName: RuleName;

  @Prop({ required: true, enum: Object.values(Severity) })
  severity: Severity;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  metadata: Record<string, unknown>;

  @Prop({ required: true })
  deliveryId: string;

  @Prop({
    required: true,
    enum: Object.values(AlertStatus),
    default: AlertStatus.OPEN,
  })
  status: AlertStatus;
}

export const AlertRecordSchema = SchemaFactory.createForClass(AlertRecord);

AlertRecordSchema.index({ ruleName: 1, createdAt: -1 });
AlertRecordSchema.index({ status: 1, createdAt: -1 });
