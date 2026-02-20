import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RapidRepoDeleteRule } from './rapid-repo-delete.rule';
import {
  RepositoryWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { RuleName, Severity } from '@github-sentinel/detection-engine';

describe('RapidRepoDeleteRule', () => {
  let rule: RapidRepoDeleteRule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RapidRepoDeleteRule,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal: unknown) => {
              const config: Record<string, unknown> = {
                RAPID_DELETE_WINDOW_MINUTES: 10,
              };
              return config[key] ?? defaultVal;
            },
          },
        },
      ],
    }).compile();

    rule = module.get(RapidRepoDeleteRule);
  });

  it('should alert when repo is deleted shortly after creation', async () => {
    const createdAt = new Date(Date.now() - 5 * 60_000); // 5 minutes ago
    const event = createRepoEvent('deleted', createdAt.toISOString());
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
    expect(result?.ruleName).toBe(RuleName.RAPID_REPO_DELETE);
    expect(result?.severity).toBe(Severity.CRITICAL);
  });

  it('should not alert when repo was created long ago', async () => {
    const createdAt = new Date(Date.now() - 60 * 60_000); // 60 minutes ago
    const event = createRepoEvent('deleted', createdAt.toISOString());
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert at exactly the window boundary (10 minutes)', async () => {
    const createdAt = new Date(Date.now() - 10 * 60_000); // exactly 10 minutes ago
    const event = createRepoEvent('deleted', createdAt.toISOString());
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should alert at 9 minutes (just under the window)', async () => {
    const createdAt = new Date(Date.now() - 9 * 60_000); // 9 minutes ago
    const event = createRepoEvent('deleted', createdAt.toISOString());
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
  });

  it('should not alert on repo creation', async () => {
    const event = createRepoEvent('created');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on repo edit', async () => {
    const event = createRepoEvent('edited');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should include timing details in metadata', async () => {
    const createdAt = new Date(Date.now() - 3 * 60_000); // 3 minutes ago
    const event = createRepoEvent('deleted', createdAt.toISOString());
    const result = await rule.evaluate(event);
    expect(result?.metadata.minutesBetween).toBeLessThanOrEqual(3);
    expect(result?.metadata.repoName).toBe('test-repo');
  });
});

function createRepoEvent(
  action: string,
  createdAt = '2024-01-15T14:00:00Z',
): RepositoryWebhookEvent {
  return {
    type: WebhookEventType.REPOSITORY,
    action: action as RepositoryWebhookEvent['action'],
    repository: {
      id: 123,
      name: 'test-repo',
      full_name: 'test-org/test-repo',
      private: false,
      owner: { login: 'test-org', id: 1 },
      created_at: createdAt,
    },
    organization: { login: 'test-org', id: 1 },
    sender: { login: 'testuser', id: 1 },
  };
}
