import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RapidRepoDeleteRule } from './rapid-repo-delete.rule';
import {
  RepositoryWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { EventRecordService } from '@github-sentinel/persistence';
import { RuleName, Severity } from '@github-sentinel/detection-engine';

describe('RapidRepoDeleteRule', () => {
  let rule: RapidRepoDeleteRule;
  let eventRecordService: { findRecentByResource: jest.Mock };

  beforeEach(async () => {
    eventRecordService = {
      findRecentByResource: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RapidRepoDeleteRule,
        {
          provide: EventRecordService,
          useValue: eventRecordService,
        },
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
    eventRecordService.findRecentByResource.mockResolvedValue({
      eventTimestamp: createdAt,
    });

    const event = createRepoEvent('deleted');
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
    expect(result?.ruleName).toBe(RuleName.RAPID_REPO_DELETE);
    expect(result?.severity).toBe(Severity.CRITICAL);
  });

  it('should not alert when no creation record is found', async () => {
    eventRecordService.findRecentByResource.mockResolvedValue(null);

    const event = createRepoEvent('deleted');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on repo creation', async () => {
    const event = createRepoEvent('created');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
    expect(eventRecordService.findRecentByResource).not.toHaveBeenCalled();
  });

  it('should not alert on repo edit', async () => {
    const event = createRepoEvent('edited');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should query with correct resource ID and action', async () => {
    eventRecordService.findRecentByResource.mockResolvedValue(null);

    const event = createRepoEvent('deleted');
    await rule.evaluate(event);

    expect(eventRecordService.findRecentByResource).toHaveBeenCalledWith(
      '123',
      'created',
      10,
    );
  });

  it('should include timing details in metadata', async () => {
    const createdAt = new Date(Date.now() - 3 * 60_000); // 3 minutes ago
    eventRecordService.findRecentByResource.mockResolvedValue({
      eventTimestamp: createdAt,
    });

    const event = createRepoEvent('deleted');
    const result = await rule.evaluate(event);
    expect(result?.metadata.minutesBetween).toBeLessThanOrEqual(3);
    expect(result?.metadata.repoName).toBe('test-repo');
  });
});

function createRepoEvent(action: string): RepositoryWebhookEvent {
  return {
    type: WebhookEventType.REPOSITORY,
    action: action as RepositoryWebhookEvent['action'],
    repository: {
      id: 123,
      name: 'test-repo',
      full_name: 'test-org/test-repo',
      private: false,
      owner: { login: 'test-org', id: 1 },
      created_at: '2024-01-15T14:00:00Z',
    },
    organization: { login: 'test-org', id: 1 },
    sender: { login: 'testuser', id: 1 },
  };
}
