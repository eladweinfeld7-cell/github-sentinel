import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AlertRecord, AlertRecordDocument } from './schemas/alert-record.schema';
import { AlertData } from '@github-sentinel/detection-engine';

@Injectable()
export class AlertRecordService {
  private readonly logger = new Logger(AlertRecordService.name);

  constructor(
    @InjectModel(AlertRecord.name) private readonly model: Model<AlertRecordDocument>,
  ) {}

  async create(deliveryId: string, alert: AlertData): Promise<AlertRecordDocument> {
    return this.model.create({
      ruleName: alert.ruleName,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata,
      deliveryId,
    });
  }
}
