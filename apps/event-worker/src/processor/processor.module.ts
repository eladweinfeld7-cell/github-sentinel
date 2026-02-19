import { Module } from '@nestjs/common';
import { EventProcessor } from './event.processor';

@Module({
  providers: [EventProcessor],
})
export class ProcessorModule {}
