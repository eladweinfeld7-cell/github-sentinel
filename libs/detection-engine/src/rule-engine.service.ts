import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { DetectionRule, AlertData } from './detection-rule.interface';
import { RULE_METADATA_KEY, RuleMetadata } from './rule.decorator';
import { WebhookEvent } from '@github-sentinel/github-types';

interface DiscoveredRule {
  meta: RuleMetadata;
  rule: DetectionRule;
}

@Injectable()
export class RuleEngineService implements OnModuleInit {
  private readonly logger = new Logger(RuleEngineService.name);
  private rules: DiscoveredRule[] = [];

  constructor(private readonly discovery: DiscoveryService) {}

  async onModuleInit(): Promise<void> {
    const providers = await this.discovery.providersWithMetaAtKey<RuleMetadata>(
      RULE_METADATA_KEY,
    );

    this.rules = providers.map((p) => ({
      meta: p.meta,
      rule: p.discoveredClass.instance as DetectionRule,
    }));

    this.logger.log(
      `Discovered ${this.rules.length} rule(s): ${this.rules.map((r) => r.meta.name).join(', ')}`,
    );
  }

  async evaluate(event: WebhookEvent): Promise<AlertData[]> {
    const applicable = this.rules.filter((r) =>
      r.rule.eventTypes.includes(event.type),
    );

    const results = await Promise.allSettled(
      applicable.map((r) => r.rule.evaluate(event)),
    );

    const alerts: AlertData[] = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        alerts.push(result.value);
      } else if (result.status === 'rejected') {
        this.logger.error(
          `Rule "${applicable[idx].meta.name}" threw: ${result.reason}`,
        );
      }
    });

    return alerts;
  }
}
