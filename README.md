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

```bash
# Node.js 20+ (via nvm)
nvm install 20 && nvm use 20

# Docker Desktop (includes Docker Compose)
# macOS:
brew install --cask docker
# Then open Docker Desktop from Applications and start it

# GitHub CLI
brew install gh
gh auth login
```

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

## Scaffolding Generators

### Add a new detection rule

```bash
npm run generate:rule -- my-new-rule
# Creates: rules/my-new-rule.rule.ts + rules/my-new-rule.rule.spec.ts

# Then:
# 1. Add to RuleName enum (libs/detection-engine/src/enums.ts)
# 2. Register as provider in apps/event-worker/src/app.module.ts
# 3. Implement detection logic and tests
```

### Add a new app (e.g. API server, scheduler)

```bash
npm run generate:app -- my-app
# Creates: apps/my-app/src/main.ts + app.module.ts + tsconfig.app.json

# Then:
# 1. Add project entry to nest-cli.json
# 2. Add build/start scripts to package.json
```

### Add a new shared library

```bash
npm run generate:lib -- my-lib
# Creates: libs/my-lib/src/my-lib.module.ts + index.ts + tsconfig.lib.json

# Then:
# 1. Add "@github-sentinel/my-lib" path to tsconfig.json
# 2. Add project entry to nest-cli.json
# 3. Add moduleNameMapper entry to package.json jest config
```

## GitHub Webhook Setup (one-time)

This registers a webhook on your GitHub org. You only need to do this **once** — the webhook persists on GitHub until you delete it.

```bash
# 1. Generate a webhook secret
export GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 20)

# 2. Create a Smee channel (free webhook proxy for local dev)
#    Go to https://smee.io/new and copy the URL

# 3. Register webhook on your GitHub org
gh api orgs/<org-name>/hooks --method POST \
  --field name=web \
  --field active=true \
  --field 'events[]=push' \
  --field 'events[]=team' \
  --field 'events[]=repository' \
  --field 'config[url]=<smee-url>' \
  --field "config[secret]=$GITHUB_WEBHOOK_SECRET" \
  --field 'config[content_type]=json'

# 4. Save the secret in your .env file
echo "GITHUB_WEBHOOK_SECRET=$GITHUB_WEBHOOK_SECRET" >> .env
```

On each dev session, start the Smee proxy to forward webhooks to localhost:

```bash
npx smee-client --url <smee-url> --target http://localhost:3000/webhook
```

## Demo Walkthrough

Load env vars first (SMEE_URL and GITHUB_ORG are saved in `.env`):

```bash
source .env
```

**Terminal 1 — Start the system**
```bash
docker compose up --build -d
docker compose logs -f event-worker    # watch alerts appear here
```

**Terminal 2 — Start webhook proxy** (forwards GitHub events to localhost)
```bash
npx smee-client --url $SMEE_URL --target http://localhost:3000/webhook
```

**Terminal 3 — Trigger real GitHub events**
```bash
# 1. Hacker Team alert (HIGH)
gh api orgs/$GITHUB_ORG/teams --method POST \
  --field name=hacker-demo --field privacy=closed

# 2. Push Time Anomaly (MEDIUM) — push a code change during 14:00-16:00 Israel time
gh api orgs/$GITHUB_ORG/repos --method POST \
  --field name=push-test --field auto_init=true
gh api repos/$GITHUB_ORG/push-test/contents/test.txt --method PUT \
  --field message="demo commit" --field content="$(echo 'hello' | base64)"

# 3. Rapid Repo Delete (CRITICAL)
gh api orgs/$GITHUB_ORG/repos --method POST --field name=temp-delete-test
# wait a few seconds...
gh api repos/$GITHUB_ORG/temp-delete-test --method DELETE
```

**Browser — Show dashboards**
- Queue dashboard: `http://localhost:3000/admin/queues`
- Health check: `http://localhost:3000/health`

**Bonus — Pressure test** (50 simulated events)
```bash
npx ts-node scripts/pressure-test.ts --count 50 --concurrency 10
```

**Cleanup**
```bash
gh api orgs/$GITHUB_ORG/teams/hacker-demo --method DELETE
gh api repos/$GITHUB_ORG/push-test --method DELETE
docker compose down
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
