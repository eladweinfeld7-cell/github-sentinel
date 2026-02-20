import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from '../src/app.module';
import { WEBHOOK_EVENTS_QUEUE, WebhookJobData } from '@github-sentinel/queue';
import {
  WebhookEventType,
  PushWebhookEvent,
  TeamWebhookEvent,
  RepositoryWebhookEvent,
} from '@github-sentinel/github-types';
import { RuleName, Severity } from '@github-sentinel/detection-engine';
import { AlertRecord } from '@github-sentinel/persistence';

jest.setTimeout(30_000);

describe('Event Worker (E2E)', () => {
  let app: INestApplication;
  let queue: Queue;
  let mongoConnection: Connection;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      'mongodb://localhost:27017/github-sentinel-e2e-worker';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.SUSPICIOUS_PUSH_TIMEZONE = 'UTC';
    process.env.SUSPICIOUS_PUSH_START_HOUR = '14';
    process.env.SUSPICIOUS_PUSH_END_HOUR = '16';
    process.env.RAPID_DELETE_WINDOW_MINUTES = '10';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    queue = app.get<Queue>(getQueueToken(WEBHOOK_EVENTS_QUEUE));
    mongoConnection = app.get<Connection>(getConnectionToken());

    // Give the BullMQ worker time to connect to Redis
    await sleep(2000);
  });

  beforeEach(async () => {
    // Clean DB between tests
    const collections = mongoConnection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }

    // Remove ALL jobs (waiting, completed, failed, etc.) so jobId reuse works
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await queue.obliterate({ force: true });
    await app.close();
  });

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function enqueue(
    deliveryId: string,
    event: PushWebhookEvent | TeamWebhookEvent | RepositoryWebhookEvent,
  ): Promise<void> {
    const jobData: WebhookJobData = {
      deliveryId,
      event,
      receivedAt: new Date().toISOString(),
    };
    await queue.add('process-event', jobData, {
      jobId: deliveryId,
      attempts: 1,
    });
  }

  /**
   * Poll MongoDB for the expected number of event records.
   * The worker processes async, so we need to wait for DB writes.
   */
  async function waitForEvents(
    expectedCount: number,
    timeoutMs = 10_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const count = await mongoConnection
        .collection('eventrecords')
        .countDocuments();
      if (count >= expectedCount) return;
      await sleep(200);
    }
  }

  /**
   * Wait for alert count to stabilise (no new alerts for 500ms).
   * Useful for negative tests where we expect 0 alerts.
   */
  async function waitForStable(timeoutMs = 5_000): Promise<void> {
    let prev = -1;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const count = await mongoConnection
        .collection('alertrecords')
        .countDocuments();
      if (count === prev) return;
      prev = count;
      await sleep(500);
    }
  }

  async function getAlerts(): Promise<AlertRecord[]> {
    return mongoConnection
      .collection('alertrecords')
      .find({})
      .toArray() as unknown as AlertRecord[];
  }

  async function getEventRecords() {
    return mongoConnection.collection('eventrecords').find({}).toArray();
  }

  // ------------------------------------------------------------------
  // Test payloads
  // ------------------------------------------------------------------

  function pushEvent(timestamp: string, pusher = 'testuser'): PushWebhookEvent {
    return {
      type: WebhookEventType.PUSH,
      ref: 'refs/heads/main',
      before: 'aaa',
      after: 'bbb',
      pusher: { name: pusher, email: `${pusher}@test.com` },
      repository: {
        id: 1,
        name: 'repo',
        full_name: 'org/repo',
        owner: { login: 'org' },
      },
      head_commit: {
        id: 'bbb',
        message: 'test commit',
        timestamp,
        author: {
          name: pusher,
          email: `${pusher}@test.com`,
          username: pusher,
        },
      },
      commits: [],
      forced: false,
      organization: { login: 'org', id: 1 },
      sender: { login: pusher, id: 1 },
    };
  }

  function teamEvent(
    name: string,
    action: 'created' | 'deleted' | 'edited' = 'created',
  ): TeamWebhookEvent {
    return {
      type: WebhookEventType.TEAM,
      action,
      team: {
        id: 42,
        name,
        slug: name.toLowerCase(),
        description: null,
        privacy: 'closed',
        permission: 'pull',
      },
      organization: { login: 'org', id: 1 },
      sender: { login: 'testuser', id: 1 },
    };
  }

  function repoEvent(
    action: 'created' | 'deleted',
    repoId = 999,
  ): RepositoryWebhookEvent {
    return {
      type: WebhookEventType.REPOSITORY,
      action,
      repository: {
        id: repoId,
        name: 'temp-repo',
        full_name: 'org/temp-repo',
        private: false,
        owner: { login: 'org', id: 1 },
        created_at: new Date().toISOString(),
      },
      organization: { login: 'org', id: 1 },
      sender: { login: 'testuser', id: 1 },
    };
  }

  // ------------------------------------------------------------------
  // Tests
  // ------------------------------------------------------------------

  it('should create a push-time-anomaly alert for push at 15:00 UTC', async () => {
    await enqueue('push-anomaly-1', pushEvent('2024-01-15T15:00:00Z'));
    await waitForEvents(1);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleName).toBe(RuleName.PUSH_TIME_ANOMALY);
    expect(alerts[0].severity).toBe(Severity.MEDIUM);
    expect(alerts[0].deliveryId).toBe('push-anomaly-1');
  });

  it('should NOT alert for push at 10:00 UTC (outside window)', async () => {
    await enqueue('push-safe-1', pushEvent('2024-01-15T10:00:00Z'));
    await waitForEvents(1);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(0);

    // But the event record should still be persisted
    const events = await getEventRecords();
    expect(events).toHaveLength(1);
  });

  it('should create a hacker-team alert for team named "hackerSquad"', async () => {
    await enqueue('team-hacker-1', teamEvent('hackerSquad'));
    await waitForEvents(1);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleName).toBe(RuleName.HACKER_TEAM);
    expect(alerts[0].severity).toBe(Severity.HIGH);
  });

  it('should NOT alert for team named "engineering"', async () => {
    await enqueue('team-safe-1', teamEvent('engineering'));
    await waitForEvents(1);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('should create a rapid-repo-delete alert when repo is deleted shortly after creation', async () => {
    // 1. Enqueue the "created" event and wait for it to be persisted
    await enqueue('repo-create-1', repoEvent('created', 500));
    await waitForEvents(1);

    // 2. Now enqueue the "deleted" event for the same repo
    await enqueue('repo-delete-1', repoEvent('deleted', 500));
    await waitForEvents(2);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleName).toBe(RuleName.RAPID_REPO_DELETE);
    expect(alerts[0].severity).toBe(Severity.CRITICAL);
  });

  it('should NOT alert when repo is deleted without a prior creation record', async () => {
    await enqueue('repo-delete-orphan', repoEvent('deleted', 777));
    await waitForEvents(1);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('should handle idempotency — duplicate deliveryId produces no extra alerts', async () => {
    await enqueue('idempotent-1', teamEvent('hackerDupe'));
    await waitForEvents(1);
    await waitForStable();

    // Try to enqueue the same deliveryId again
    // BullMQ deduplicates by jobId, but even if it doesn't, the processor checks
    try {
      await enqueue('idempotent-1', teamEvent('hackerDupe'));
    } catch {
      // BullMQ may reject duplicate jobId — that's fine
    }
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(1);
  });

  it('should process multiple events and generate correct alerts', async () => {
    // Push inside window → 1 alert
    await enqueue('multi-push', pushEvent('2024-06-01T14:30:00Z'));
    // Hacker team → 1 alert
    await enqueue('multi-team', teamEvent('hackerElite'));
    // Normal push → 0 alerts
    await enqueue('multi-safe', pushEvent('2024-06-01T10:00:00Z'));

    await waitForEvents(3);
    await waitForStable();

    const alerts = await getAlerts();
    expect(alerts).toHaveLength(2);

    const ruleNames = alerts.map((a) => a.ruleName).sort();
    expect(ruleNames).toEqual(
      [RuleName.HACKER_TEAM, RuleName.PUSH_TIME_ANOMALY].sort(),
    );

    // All 3 events should be recorded
    const events = await getEventRecords();
    expect(events).toHaveLength(3);
  });
});
