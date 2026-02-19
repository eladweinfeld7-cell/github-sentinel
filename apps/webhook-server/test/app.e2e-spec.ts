import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';

describe('Webhook Server (E2E)', () => {
  let app: INestApplication;
  const webhookSecret = 'test-secret';

  beforeAll(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;
    process.env.MONGODB_URI = 'mongodb://localhost:27017/github-sentinel-test';
    process.env.REDIS_HOST = 'localhost';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without signature', async () => {
    await request(app.getHttpServer())
      .post('/webhook')
      .send({ action: 'created' })
      .expect(401);
  });

  it('rejects requests with invalid signature', async () => {
    await request(app.getHttpServer())
      .post('/webhook')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .set('X-GitHub-Event', 'push')
      .set('X-GitHub-Delivery', 'test-123')
      .send({ action: 'created' })
      .expect(401);
  });

  it('accepts valid push event and returns queued', async () => {
    const payload = JSON.stringify(createValidPushPayload());
    const signature = 'sha256=' + createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Event', 'push')
      .set('X-GitHub-Delivery', `test-${Date.now()}`)
      .send(payload)
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('queued');
      });
  });

  it('ignores unsupported event types', async () => {
    const payload = JSON.stringify({ action: 'completed' });
    const signature = 'sha256=' + createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Event', 'check_run')
      .set('X-GitHub-Delivery', `test-${Date.now()}`)
      .send(payload)
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('ignored');
      });
  });

  it('returns healthy on liveness check', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.status).toBe('ok');
      });
  });
});

function createValidPushPayload() {
  return {
    ref: 'refs/heads/main',
    before: 'abc',
    after: 'def',
    pusher: { name: 'user', email: 'u@e.com' },
    repository: { id: 1, name: 'r', full_name: 'o/r', owner: { login: 'o' } },
    head_commit: {
      id: 'def',
      message: 'test',
      timestamp: '2024-01-15T15:00:00Z',
      author: { name: 'u', email: 'u@e.com', username: 'u' },
    },
    commits: [],
    forced: false,
    organization: { login: 'o', id: 1 },
    sender: { login: 'u', id: 1 },
  };
}
