import { createHmac, randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const TOTAL = parseInt(getArg('count', '50'), 10);
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const BASE_URL = getArg('url', 'http://localhost:3000');
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret';

// --- Payload generators ---

function pushPayload(i: number) {
  // Set timestamp inside the suspicious push window (15:00 UTC) so the rule fires
  const suspicious = new Date();
  suspicious.setUTCHours(15, 0, 0, 0);
  return {
    eventType: 'push',
    body: {
      ref: 'refs/heads/main',
      before: '0'.repeat(40),
      after: randomUUID().replace(/-/g, '') + '00000000',
      pusher: { name: `user-${i}`, email: `user-${i}@test.com` },
      repository: {
        id: 100000 + i,
        name: `repo-${i}`,
        full_name: `test-org/repo-${i}`,
        owner: { login: 'test-org' },
      },
      head_commit: {
        id: randomUUID(),
        message: `pressure test commit ${i}`,
        timestamp: suspicious.toISOString(),
        author: {
          name: `user-${i}`,
          email: `user-${i}@test.com`,
          username: `user-${i}`,
        },
      },
      commits: [],
      forced: false,
      organization: { login: 'test-org', id: 1 },
      sender: { login: `user-${i}`, id: 1000 + i },
    },
  };
}

function teamPayload(i: number) {
  return {
    eventType: 'team',
    body: {
      action: 'created',
      team: {
        id: 200000 + i,
        name: i % 5 === 0 ? `hacker-team-${i}` : `normal-team-${i}`,
        slug: i % 5 === 0 ? `hacker-team-${i}` : `normal-team-${i}`,
        description: null,
        privacy: 'closed' as const,
        permission: 'pull',
      },
      organization: { login: 'test-org', id: 1 },
      sender: { login: `admin-${i}`, id: 2000 + i },
    },
  };
}

interface Payload {
  eventType: string;
  body: Record<string, unknown>;
}

// Returns a pair: [created event, deleted event] for the same repo
function repoCreateDeletePair(i: number): Payload[] {
  const created = new Date();
  const repo = {
    id: 300000 + i,
    name: `temp-repo-${i}`,
    full_name: `test-org/temp-repo-${i}`,
    private: false,
    owner: { login: 'test-org', id: 1 },
    created_at: created.toISOString(),
  };
  const org = { login: 'test-org', id: 1 };
  const sender = { login: `admin-${i}`, id: 3000 + i };

  return [
    {
      eventType: 'repository',
      body: { action: 'created', repository: repo, organization: org, sender },
    },
    {
      eventType: 'repository',
      body: { action: 'deleted', repository: repo, organization: org, sender },
    },
  ];
}

// Returns 1 or 2 payloads (repo delete needs a create first)
function randomPayloads(i: number): Payload[] {
  const r = Math.random();
  if (r < 0.6) return [pushPayload(i)]; // 60% push
  if (r < 0.85) return [teamPayload(i)]; // 25% team
  return repoCreateDeletePair(i); // 15% repo create+delete pair
}

// --- HTTP sender ---

function sign(body: string): string {
  return 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
}

interface SendResult {
  index: number;
  status: number;
  body: string;
  durationMs: number;
}

async function sendOne(
  payload: Payload,
): Promise<{ status: number; body: string; durationMs: number }> {
  const rawBody = JSON.stringify(payload.body);
  const deliveryId = randomUUID();
  const start = performance.now();

  const res = await fetch(`${BASE_URL}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': payload.eventType,
      'X-GitHub-Delivery': deliveryId,
      'X-Hub-Signature-256': sign(rawBody),
    },
    body: rawBody,
  });

  const text = await res.text();
  const durationMs = Math.round(performance.now() - start);
  return { status: res.status, body: text, durationMs };
}

async function sendEvent(i: number): Promise<SendResult> {
  const payloads = randomPayloads(i);
  const start = performance.now();
  let lastStatus = 0;
  let lastBody = '';

  // Send sequentially so "created" is processed before "deleted"
  for (const payload of payloads) {
    const result = await sendOne(payload);
    lastStatus = result.status;
    lastBody = result.body;
  }

  const durationMs = Math.round(performance.now() - start);
  return { index: i, status: lastStatus, body: lastBody, durationMs };
}

// --- Concurrency pool ---

async function runPool(
  total: number,
  concurrency: number,
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  let next = 0;

  async function worker() {
    while (next < total) {
      const i = next++;
      const result = await sendEvent(i);
      results.push(result);

      const symbol =
        result.status === 200
          ? '\x1b[32m✓\x1b[0m'
          : result.status === 429
            ? '\x1b[33m⏱\x1b[0m'
            : '\x1b[31m✗\x1b[0m';
      process.stdout.write(
        `  ${symbol} #${i + 1} → ${result.status} (${result.durationMs}ms)\n`,
      );
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

// --- Main ---

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Pressure Test: ${TOTAL} events, ${CONCURRENCY} concurrent`);
  console.log(`  Target: ${BASE_URL}/webhook`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const start = performance.now();
  const results = await runPool(TOTAL, CONCURRENCY);
  const totalMs = Math.round(performance.now() - start);

  // --- Summary ---
  const statusCounts: Record<number, number> = {};
  let totalLatency = 0;
  let minLatency = Infinity;
  let maxLatency = 0;

  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    totalLatency += r.durationMs;
    if (r.durationMs < minLatency) minLatency = r.durationMs;
    if (r.durationMs > maxLatency) maxLatency = r.durationMs;
  }

  console.log('\n━━━━━━━━━━━━━━━━ Summary ━━━━━━━━━━━━━━━━━━');
  console.log(`  Total time:     ${totalMs}ms`);
  console.log(
    `  Throughput:     ${((results.length / totalMs) * 1000).toFixed(1)} req/s`,
  );
  console.log(
    `  Avg latency:    ${Math.round(totalLatency / results.length)}ms`,
  );
  console.log(`  Min latency:    ${minLatency}ms`);
  console.log(`  Max latency:    ${maxLatency}ms`);
  console.log('  Status codes:');
  for (const [code, count] of Object.entries(statusCounts).sort()) {
    const label =
      code === '200'
        ? 'queued'
        : code === '429'
          ? 'rate-limited'
          : code === '503'
            ? 'backpressure'
            : 'error';
    console.log(`    ${code}: ${count} (${label})`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

void main();
