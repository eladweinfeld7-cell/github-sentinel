import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueProducerService } from './queue-producer.service';
import { WEBHOOK_EVENTS_QUEUE } from './constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: 1000,
        },
      }),
    }),
    BullModule.registerQueue({
      name: WEBHOOK_EVENTS_QUEUE,
    }),
  ],
  providers: [QueueProducerService],
  exports: [QueueProducerService, BullModule],
})
export class QueueModule {}
