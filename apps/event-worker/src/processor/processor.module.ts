import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventProcessor } from './event.processor';
import { DetectionEngineModule } from '@github-sentinel/detection-engine';
import { PersistenceModule } from '@github-sentinel/persistence';
import { NotificationsModule } from '@github-sentinel/notifications';
import { WEBHOOK_EVENTS_QUEUE } from '@github-sentinel/queue';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_EVENTS_QUEUE }),
    DetectionEngineModule,
    PersistenceModule,
    NotificationsModule,
  ],
  providers: [EventProcessor],
})
export class ProcessorModule {}
