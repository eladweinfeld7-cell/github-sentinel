#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$ROOT_DIR/deploy/k8s"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 1. Start minikube ────────────────────────────────────────────────
if minikube status --format='{{.Host}}' 2>/dev/null | grep -q Running; then
  info "Minikube already running"
else
  warn "Starting minikube..."
  minikube start
  info "Minikube started"
fi

# ── 2. Enable metrics-server ─────────────────────────────────────────
if minikube addons list | grep -q "metrics-server.*enabled"; then
  info "metrics-server already enabled"
else
  minikube addons enable metrics-server
  info "metrics-server enabled"
fi

# ── 3. Install KEDA ──────────────────────────────────────────────────
if kubectl get namespace keda &>/dev/null; then
  info "KEDA already installed"
else
  warn "Installing KEDA..."
  kubectl apply --server-side \
    -f https://github.com/kedacore/keda/releases/download/v2.13.0/keda-2.13.0.yaml
  kubectl wait --for=condition=ready pod -l app=keda-operator -n keda --timeout=120s
  info "KEDA installed"
fi

# ── 4. Build images inside minikube ──────────────────────────────────
warn "Building images inside minikube..."
eval $(minikube docker-env)
docker build -f "$ROOT_DIR/Dockerfile.webhook-server" -t github-sentinel/webhook-server:latest "$ROOT_DIR"
docker build -f "$ROOT_DIR/Dockerfile.event-worker"   -t github-sentinel/event-worker:latest   "$ROOT_DIR"
info "Images built"

# ── 5. Apply manifests in order ───────────────────────────────────────
warn "Applying K8s manifests..."

kubectl apply -f "$K8S_DIR/namespace.yaml"
kubectl apply -f "$K8S_DIR/configmap.yaml"
kubectl apply -f "$K8S_DIR/secret.yaml"
kubectl apply -f "$K8S_DIR/redis.yaml"
kubectl apply -f "$K8S_DIR/mongodb.yaml"

info "Waiting for Redis & MongoDB..."
kubectl wait --for=condition=ready pod -l app=redis   -n github-sentinel --timeout=90s
kubectl wait --for=condition=ready pod -l app=mongodb -n github-sentinel --timeout=90s

kubectl apply -f "$K8S_DIR/webhook-server-deployment.yaml"
kubectl apply -f "$K8S_DIR/event-worker-deployment.yaml"
kubectl apply -f "$K8S_DIR/webhook-server-hpa.yaml"
kubectl apply -f "$K8S_DIR/event-worker-keda.yaml"

info "Waiting for app pods..."
kubectl wait --for=condition=ready pod -l app=webhook-server -n github-sentinel --timeout=120s
kubectl wait --for=condition=ready pod -l app=event-worker   -n github-sentinel --timeout=120s

# ── 6. Summary ───────────────────────────────────────────────────────
echo ""
info "All pods:"
kubectl -n github-sentinel get pods
echo ""
info "Services:"
kubectl -n github-sentinel get svc
echo ""
info "Deploy complete! To access the webhook-server run:"
echo "  minikube service webhook-server -n github-sentinel"
echo ""
info "To tear down:"
echo "  npm run k8s:destroy"
