#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="mistral-ocr-lab"
PORT="3010"

[[ -f package.json ]] || { echo "Run from project root"; exit 1; }
grep -q "\"name\": \"mistral-ocr-lab\"" package.json || { echo "Wrong project"; exit 1; }
command -v docker >/dev/null || { echo "Docker missing"; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose plugin missing"; exit 1; }
[[ -f .env.production ]] || { echo ".env.production missing"; exit 1; }

perm="$(stat -c '%a' .env.production)"
if [[ "$perm" != "600" ]]; then
  echo "Warning: .env.production permissions are $perm; recommended 600"
fi

if ! grep -q '^MISTRAL_API_KEY=.' .env.production; then
  echo "Warning: MISTRAL_API_KEY is empty; deploying in not_configured mode."
fi

if ss -ltn "( sport = :$PORT )" | grep -q "$PORT"; then
  if ! docker ps --format '{{.Names}}' | grep -qx "$APP_NAME"; then
    echo "Port $PORT is already in use by another process; not stopping it."
    exit 1
  fi
fi

npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build

docker compose build
docker compose up -d

for _ in {1..30}; do
  status="$(docker inspect --format='{{.State.Health.Status}}' "$APP_NAME" 2>/dev/null || true)"
  [[ "$status" == "healthy" ]] && break
  sleep 2
done

docker inspect --format='{{.State.Health.Status}}' "$APP_NAME"
curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health" >/dev/null
echo "Deployment complete for $APP_NAME"
