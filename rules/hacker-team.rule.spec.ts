import { Test, TestingModule } from '@nestjs/testing';
import { HackerTeamRule } from './hacker-team.rule';
import {
  TeamWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { RuleName, Severity } from '@github-sentinel/detection-engine';

describe('HackerTeamRule', () => {
  let rule: HackerTeamRule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HackerTeamRule],
    }).compile();

    rule = module.get(HackerTeamRule);
  });

  it('should alert when team name starts with "hacker"', async () => {
    const event = createTeamEvent('created', 'hackerTeam');
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
    expect(result?.ruleName).toBe(RuleName.HACKER_TEAM);
    expect(result?.severity).toBe(Severity.HIGH);
  });

  it('should alert when team name starts with "HACKER" (case-insensitive)', async () => {
    const event = createTeamEvent('created', 'HACKERElite');
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
  });

  it('should not alert on team without "hacker" prefix', async () => {
    const event = createTeamEvent('created', 'engineering');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on team deletion even with "hacker" prefix', async () => {
    const event = createTeamEvent('deleted', 'hackerTeam');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on team edit even with "hacker" prefix', async () => {
    const event = createTeamEvent('edited', 'hackerTeam');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should include team details in metadata', async () => {
    const event = createTeamEvent('created', 'hackerSquad');
    const result = await rule.evaluate(event);
    expect(result?.metadata.teamName).toBe('hackerSquad');
    expect(result?.metadata.creator).toBe('testuser');
  });
});

function createTeamEvent(action: string, teamName: string): TeamWebhookEvent {
  return {
    type: WebhookEventType.TEAM,
    action: action as TeamWebhookEvent['action'],
    team: {
      id: 42,
      name: teamName,
      slug: teamName.toLowerCase(),
      description: null,
      privacy: 'closed',
      permission: 'pull',
      created_at: '2024-01-15T14:00:00Z',
    },
    organization: { login: 'test-org', id: 1 },
    sender: { login: 'testuser', id: 1 },
  };
}
