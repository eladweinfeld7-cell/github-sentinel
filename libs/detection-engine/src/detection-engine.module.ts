import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { RuleEngineService } from './rule-engine.service';

@Module({
  imports: [DiscoveryModule],
  providers: [RuleEngineService],
  exports: [RuleEngineService],
})
export class DetectionEngineModule {}
