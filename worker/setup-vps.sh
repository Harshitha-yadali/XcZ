#!/usr/bin/env bash
# One-time setup of the Auto Apply runner on a fresh Ubuntu VPS (Hostinger KVM 1/2).
# Run as root:  bash setup-vps.sh <git repo url> [branch]
# Afterwards put the secrets in /opt/primoboost/worker/.env (see worker/.env.example)
# and start it with:  bash /opt/primoboost/worker/setup-vps.sh start
set -euo pipefail

APP=/opt/primoboost

if [ "${1:-}" = "start" ]; then
  cd "$APP"
  git pull --ff-only
  docker build -f worker/Dockerfile -t primoboost-apply-worker .
  docker rm -f apply-worker 2>/dev/null || true
  docker run -d --name apply-worker --restart=always --env-file worker/.env --shm-size=1g primoboost-apply-worker
  docker logs --tail 20 apply-worker
  exit 0
fi

REPO="${1:?usage: setup-vps.sh <git repo url> [branch]}"
BRANCH="${2:-main}"

apt-get update
apt-get install -y docker.io git
systemctl enable --now docker

if [ ! -d "$APP/.git" ]; then git clone --branch "$BRANCH" "$REPO" "$APP"; fi
cp -n "$APP/worker/.env.example" "$APP/worker/.env"
chmod 600 "$APP/worker/.env"
echo "Now fill in $APP/worker/.env, then run: bash $APP/worker/setup-vps.sh start"
