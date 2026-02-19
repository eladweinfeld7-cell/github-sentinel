import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { DetectionEngineModule } from '@github-sentinel/detection-engine';
import { PersistenceModule } from '@github-sentinel/persistence';
import { NotificationsModule } from '@github-sentinel/notifications';
import { ProcessorModule } from './processor/processor.module';
import { PushTimeAnomalyRule } from '../../../rules/push-time-anomaly.rule';
import { HackerTeamRule } from '../../../rules/hacker-team.rule';
import { RapidRepoDeleteRule } from '../../../rules/rapid-repo-delete.rule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/github-sentinel'),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    DetectionEngineModule,
    PersistenceModule,
    NotificationsModule,
    ProcessorModule,
  ],
  providers: [PushTimeAnomalyRule, HackerTeamRule, RapidRepoDeleteRule],
})
export class AppModule {}
