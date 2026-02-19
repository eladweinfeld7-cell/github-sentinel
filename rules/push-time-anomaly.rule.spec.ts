import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushTimeAnomalyRule } from './push-time-anomaly.rule';
import {
  PushWebhookEvent,
  WebhookEventType,
} from '@github-sentinel/github-types';
import { RuleName, Severity } from '@github-sentinel/detection-engine';

describe('PushTimeAnomalyRule', () => {
  let rule: PushTimeAnomalyRule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushTimeAnomalyRule,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal: unknown) => {
              const config: Record<string, unknown> = {
                SUSPICIOUS_PUSH_TIMEZONE: 'UTC',
                SUSPICIOUS_PUSH_START_HOUR: 14,
                SUSPICIOUS_PUSH_END_HOUR: 16,
              };
              return config[key] ?? defaultVal;
            },
          },
        },
      ],
    }).compile();

    rule = module.get(PushTimeAnomalyRule);
  });

  it('should alert on push at 15:00 UTC', async () => {
    const event = createPushEvent('2024-01-15T15:00:00Z');
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
    expect(result?.ruleName).toBe(RuleName.PUSH_TIME_ANOMALY);
    expect(result?.severity).toBe(Severity.MEDIUM);
  });

  it('should alert on push at 14:00 UTC (inclusive start)', async () => {
    const event = createPushEvent('2024-01-15T14:00:00Z');
    const result = await rule.evaluate(event);
    expect(result).not.toBeNull();
  });

  it('should not alert on push at 13:00 UTC', async () => {
    const event = createPushEvent('2024-01-15T13:00:00Z');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on push at exactly 16:00 UTC (exclusive end)', async () => {
    const event = createPushEvent('2024-01-15T16:00:00Z');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should not alert on push at 10:00 UTC', async () => {
    const event = createPushEvent('2024-01-15T10:00:00Z');
    const result = await rule.evaluate(event);
    expect(result).toBeNull();
  });

  it('should include pusher and repository in metadata', async () => {
    const event = createPushEvent('2024-01-15T15:30:00Z');
    const result = await rule.evaluate(event);
    expect(result?.metadata.pusher).toBe('testuser');
    expect(result?.metadata.repository).toBe('test-org/test-repo');
  });
});

function createPushEvent(timestamp: string): PushWebhookEvent {
  return {
    type: WebhookEventType.PUSH,
    ref: 'refs/heads/main',
    before: 'abc123',
    after: 'def456',
    pusher: { name: 'testuser', email: 'test@example.com' },
    repository: {
      id: 1,
      name: 'test-repo',
      full_name: 'test-org/test-repo',
      owner: { login: 'test-org' },
    },
    head_commit: {
      id: 'def456',
      message: 'test commit',
      timestamp,
      author: {
        name: 'testuser',
        email: 'test@example.com',
        username: 'testuser',
      },
    },
    commits: [],
    forced: false,
    organization: { login: 'test-org', id: 1 },
    sender: { login: 'testuser', id: 1 },
  };
}
