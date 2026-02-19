import { Injectable } from '@nestjs/common';
import { Rule } from '@github-sentinel/detection-engine';
import { DetectionRule, AlertData, RuleName, Severity } from '@github-sentinel/detection-engine';
import { WebhookEvent, RepositoryWebhookEvent, WebhookEventType } from '@github-sentinel/github-types';
import { EventRecordService } from '@github-sentinel/persistence';
import { ConfigService } from '@nestjs/config';

@Rule({
  name: RuleName.RAPID_REPO_DELETE,
  description: 'Detects repository deleted within 10 minutes of creation',
})
@Injectable()
export class RapidRepoDeleteRule implements DetectionRule {
  readonly eventTypes = [WebhookEventType.REPOSITORY] as const;

  private readonly windowMinutes: number;

  constructor(
    private readonly eventRecordService: EventRecordService,
    config: ConfigService,
  ) {
    this.windowMinutes = config.get<number>('RAPID_DELETE_WINDOW_MINUTES', 10);
  }

  async evaluate(event: WebhookEvent): Promise<AlertData | null> {
    const repoEvent = event as RepositoryWebhookEvent;

    if (repoEvent.action !== 'deleted') {
      return null;
    }

    const repoId = String(repoEvent.repository.id);

    const creationRecord = await this.eventRecordService.findRecentByResource(
      repoId,
      'created',
      this.windowMinutes,
    );

    if (!creationRecord) {
      return null;
    }

    const createdAt = creationRecord.eventTimestamp;
    const deletedAt = new Date();
    const diffMs = deletedAt.getTime() - createdAt.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

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
