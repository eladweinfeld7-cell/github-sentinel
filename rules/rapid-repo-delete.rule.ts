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
  RepositoryWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { ConfigService } from '@nestjs/config';

@Rule({
  name: RuleName.RAPID_REPO_DELETE,
  description:
    'Detects repository deleted within configured window of creation',
})
@Injectable()
export class RapidRepoDeleteRule implements DetectionRule {
  readonly eventTypes = [WebhookEventType.REPOSITORY] as const;

  private readonly windowMinutes: number;

  constructor(config: ConfigService) {
    this.windowMinutes = config.get<number>('RAPID_DELETE_WINDOW_MINUTES', 10);
  }

  async evaluate(event: WebhookEvent): Promise<AlertData | null> {
    const repoEvent = event as RepositoryWebhookEvent;

    if (repoEvent.action !== 'deleted') {
      return null;
    }

    // Use created_at from the payload — no DB lookup needed, no race condition
    const createdAt = new Date(repoEvent.repository.created_at);
    const deletedAt = new Date();
    const diffMs = deletedAt.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    if (diffMinutes > this.windowMinutes) {
      return null;
    }

    return {
      ruleName: RuleName.RAPID_REPO_DELETE,
      severity: Severity.CRITICAL,
      message: `Repository "${repoEvent.repository.name}" deleted ${diffMinutes} minute(s) after creation`,
      metadata: {
        repoName: repoEvent.repository.name,
        repoId: repoEvent.repository.id,
        createdAt: createdAt.toISOString(),
        deletedAt: deletedAt.toISOString(),
        minutesBetween: diffMinutes,
        deletedBy: repoEvent.sender.login,
        organization: repoEvent.organization.login,
      },
    };
  }
}
