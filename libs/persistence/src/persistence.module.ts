import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventRecord, EventRecordSchema } from './schemas/event-record.schema';
import { AlertRecord, AlertRecordSchema } from './schemas/alert-record.schema';
import { EventRecordService } from './event-record.service';
import { AlertRecordService } from './alert-record.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventRecord.name, schema: EventRecordSchema },
      { name: AlertRecord.name, schema: AlertRecordSchema },
    ]),
  ],
  providers: [EventRecordService, AlertRecordService],
  exports: [EventRecordService, AlertRecordService],
})
export class PersistenceModule {}
