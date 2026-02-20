import { Injectable } from '@nestjs/common';
import { Rule } from '@github-sentinel/detection-engine';
import {
  DetectionRule,
  AlertData,
  RuleName,
  Severity,
} from '@github-sentinel/detection-engine';
import {
  WebhookEvent,
  PushWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { ConfigService } from '@nestjs/config';

@Rule({
  name: RuleName.PUSH_TIME_ANOMALY,
  description: 'Detects code pushes between 14:00 and 16:00',
})
@Injectable()
export class PushTimeAnomalyRule implements DetectionRule {
  readonly eventTypes = [WebhookEventType.PUSH] as const;

  private readonly timezone: string;
  private readonly startHour: number;
  private readonly endHour: number;

  constructor(config: ConfigService) {
    this.timezone = config.get<string>(
      'SUSPICIOUS_PUSH_TIMEZONE',
      'Asia/Jerusalem',
    );
    this.startHour = config.get<number>('SUSPICIOUS_PUSH_START_HOUR', 14);
    this.endHour = config.get<number>('SUSPICIOUS_PUSH_END_HOUR', 16);
  }

  async evaluate(event: WebhookEvent): Promise<AlertData | null> {
    const pushEvent = event as PushWebhookEvent;

    const timestamp =
      pushEvent.head_commit?.timestamp ?? new Date().toISOString();
    const pushDate = new Date(timestamp);

    const hour = this.getHourInTimezone(pushDate, this.timezone);

    if (hour >= this.startHour && hour < this.endHour) {
      return {
        ruleName: RuleName.PUSH_TIME_ANOMALY,
        severity: Severity.MEDIUM,
        message: `Push detected during suspicious hours (${this.startHour}:00-${this.endHour}:00 ${this.timezone})`,
        metadata: {
          pusher: pushEvent.pusher.name,
          repository: pushEvent.repository.full_name,
          pushHour: hour,
          timestamp,
          timezone: this.timezone,
        },
      };
    }

    return null;
  }

  private getHourInTimezone(date: Date, timezone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });

    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    const hour = parseInt(hourPart?.value ?? '0', 10);
    return hour === 24 ? 0 : hour;
  }
}
