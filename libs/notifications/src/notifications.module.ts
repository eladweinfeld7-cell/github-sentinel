import { Module } from '@nestjs/common';
import { ConsoleNotifierService } from './console-notifier.service';
import { NOTIFIER } from './notifier.interface';

@Module({
  providers: [
    {
      provide: NOTIFIER,
      useClass: ConsoleNotifierService,
    },
  ],
  exports: [NOTIFIER],
})
export class NotificationsModule {}
