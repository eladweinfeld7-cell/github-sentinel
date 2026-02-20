# GitHub Sentinel

A production-grade webhook security monitor that detects suspicious behaviors in GitHub organizations.

## Architecture

```
GitHub Org ──webhook──> webhook-server (Producer) ──BullMQ──> event-worker (Consumer)
                              |                                      |
                              |                                +-----+-----+
                              |                                | Rule      |
                              v                                | Engine    |
                        Rate Limiting                          +-----+-----+
                        HMAC Signature                    +----------+----------+
                        Backpressure                      v          v          v
                                                    Push Time   Hacker    Rapid Repo
                                                    Anomaly     Team      Delete
                                                         |          |          |
                                                         +----------+----------+
                                                                    |
                                                              +-----+-----+
                                                              |  MongoDB  |
                                                              |  Console  |
                                                              +-----------+
```

**Two independent apps:**
- **webhook-server** -- Receives webhooks, verifies HMAC signatures, enqueues to Redis
- **event-worker** -- Processes queue, runs detection rules, persists alerts, notifies

## Detection Rules

| Rule | Trigger | Severity |
|------|---------|----------|
| Push Time Anomaly | Code pushed between 14:00-16:00 (configurable timezone) | MEDIUM |
| Hacker Team | Team created with name starting with "hacker" | HIGH |
| Rapid Repo Delete | Repository deleted within 10 minutes of creation | CRITICAL |

## Tech Stack

- **NestJS 10** monorepo (TypeScript strict mode)
- **BullMQ + Redis** -- async queue with exponential backoff + jitter
- **MongoDB + Mongoose** -- event correlation (TTL: 3h) + permanent alert history
- **Docker Compose** -- dev mode (one command)
- **Kubernetes + KEDA** -- prod mode with auto-scaling

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- GitHub CLI (`gh`)

### Setup

```bash
git clone <repo-url> && cd github-sentinel
npm install
cp .env.example .env
# Edit .env — set GITHUB_WEBHOOK_SECRET
```

### Option A — Docker Compose (recommended for demo/testing)

Runs everything in containers. No local Node.js needed after install.

```bash
docker compose up --build -d

# Watch alert output in real-time
docker compose logs -f event-worker
```

### Option B — Hybrid Dev (for active development)

Runs Redis + MongoDB in Docker, apps locally with hot-reload.

```bash
# 1. Start only infrastructure
docker compose up redis mongodb -d

# 2. Start apps locally (hot-reload on code changes)
npm run start:dev
```

> **Important:** Do not mix the two modes. If you ran `docker compose up --build`, stop everything first with `docker compose down` before using Option B.

### Stop

```bash
# Docker Compose
docker compose down            # stop containers
docker compose down -v         # stop + delete volumes (MongoDB data)

# Local dev (npm run start:dev)
# Ctrl+C in the terminal
```

### Clean the Database

```bash
docker exec -it github-sentinel-mongodb-1 mongosh github-sentinel --eval "db.dropDatabase()"
```

### Queue Dashboard

Bull Board UI is available at `http://localhost:3000/admin/queues` when the webhook-server is running.

### Run Tests

```bash
# Unit tests (no external deps needed)
npm test

# E2E tests (requires only Redis + MongoDB — stop app containers first)
docker compose up redis mongodb -d
npm run test:e2e:webhook-server
npm run test:e2e:event-worker
```

### Pressure Test

```bash
# Send 50 simulated webhook events at 10 concurrency (requires webhook-server running)
npx ts-node scripts/pressure-test.ts --count 50 --concurrency 10
```

## Project Structure

```
github-sentinel/
├── apps/
│   ├── webhook-server/          # HTTP producer
│   └── event-worker/            # Queue consumer
├── libs/
│   ├── github-types/            # Typed webhook payloads
│   ├── detection-engine/        # Rule engine + @Rule() decorator
│   ├── persistence/             # MongoDB schemas + services
│   ├── notifications/           # Console notifier
│   └── queue/                   # BullMQ producer
├── rules/                       # Detection rules (one file per rule)
├── scripts/                     # Generator scripts
├── deploy/k8s/                  # Kubernetes manifests
├── Dockerfile.webhook-server
├── Dockerfile.event-worker
└── docker-compose.yml
```

## Adding a New Rule

```bash
# 1. Generate scaffolding
npm run generate:rule -- my-new-rule

# 2. Add to RuleName enum (libs/detection-engine/src/enums.ts)
# 3. Register as provider in apps/event-worker/src/app.module.ts
# 4. Implement detection logic in rules/my-new-rule.rule.ts
# 5. Write tests in rules/my-new-rule.rule.spec.ts
```

## GitHub Webhook Setup

```bash
# Generate a webhook secret
export GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 20)

# Start webhook proxy for local dev
npx smee-client --url https://smee.io/new --target http://localhost:3000/webhook

# Register webhook on your GitHub org
gh api orgs/<org-name>/hooks --method POST \
  --field name=web \
  --field active=true \
  --field 'events[]=push' \
  --field 'events[]=team' \
  --field 'events[]=repository' \
  --field 'config[url]=<smee-url>' \
  --field "config[secret]=$GITHUB_WEBHOOK_SECRET" \
  --field 'config[content_type]=json'
```

## Deployment

### Dev Mode
```bash
docker compose up --build
```

### Prod Mode (Kubernetes)
```bash
kubectl apply -f deploy/k8s/
```

| Component | Dev (Docker Compose) | Prod (Kubernetes) |
|-----------|---------------------|-------------------|
| webhook-server | 1 container | HPA: 2-10 pods (CPU) |
| event-worker | 2 containers | KEDA: 2-20 pods (queue depth) |
| Redis | 1 container | 1 pod |
| MongoDB | 1 container | 1 pod + PVC |

## Key Design Decisions

- **Discriminated unions** -- `type` field added during ingestion enables TypeScript narrowing
- **Enums over string literals** -- compile-time safety, runtime existence, centralized
- **3-layer idempotency** -- BullMQ jobId, exists() check, unique MongoDB index
- **TTL on EventRecords (3h)** -- self-cleaning working data, generous buffer for retries
- **KEDA for workers** -- scales on queue depth, not CPU (workers are CPU-idle when queue is empty)
- **Strong consistency** -- MongoDB defaults (primary reads, w:1 writes)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_WEBHOOK_SECRET` | -- | HMAC secret for signature verification |
| `MONGODB_URI` | `mongodb://localhost:27017/github-sentinel` | MongoDB connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `SUSPICIOUS_PUSH_TIMEZONE` | `Asia/Jerusalem` | Timezone for push time checks |
| `SUSPICIOUS_PUSH_START_HOUR` | `14` | Start of suspicious window |
| `SUSPICIOUS_PUSH_END_HOUR` | `16` | End of suspicious window |
| `RAPID_DELETE_WINDOW_MINUTES` | `10` | Time window for rapid delete detection |
| `PORT` | `3000` | HTTP server port |
