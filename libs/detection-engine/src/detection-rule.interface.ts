import { WebhookEventType, WebhookEvent } from '@github-sentinel/github-types';
import { Severity, RuleName } from './enums';

export interface AlertData {
  ruleName: RuleName;
  severity: Severity;
  message: string;
  metadata: Record<string, string | number | boolean>;
}

export interface DetectionRule {
  readonly eventTypes: ReadonlyArray<WebhookEventType>;
  evaluate(event: WebhookEvent): Promise<AlertData | null>;
}
