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
  TeamWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';

@Rule({
  name: RuleName.HACKER_TEAM,
  description: 'Detects team creation with "hacker" prefix',
})
@Injectable()
export class HackerTeamRule implements DetectionRule {
  readonly eventTypes = [WebhookEventType.TEAM] as const;

  async evaluate(event: WebhookEvent): Promise<AlertData | null> {
    const teamEvent = event as TeamWebhookEvent;

    if (teamEvent.action !== 'created') {
      return null;
    }

    const teamName = teamEvent.team.name.toLowerCase();

    if (teamName.startsWith('hacker')) {
      return {
        ruleName: RuleName.HACKER_TEAM,
        severity: Severity.HIGH,
        message: `Team created with suspicious "hacker" prefix: "${teamEvent.team.name}"`,
        metadata: {
          teamName: teamEvent.team.name,
          teamId: teamEvent.team.id,
          creator: teamEvent.sender.login,
          organization: teamEvent.organization.login,
        },
      };
    }

    return null;
  }
}
