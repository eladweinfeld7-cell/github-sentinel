#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $1"; }

kubectl delete namespace github-sentinel --ignore-not-found
info "Namespace deleted"

minikube stop
info "Minikube stopped"
