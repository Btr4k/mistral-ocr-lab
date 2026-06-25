#!/usr/bin/env bash
set -Eeuo pipefail

echo "Rollback strategy: retag the previous known-good image as mistral-ocr-lab-rollback before deployment."
if docker image inspect mistral-ocr-lab-rollback >/dev/null 2>&1; then
  docker compose down
  docker tag mistral-ocr-lab-rollback mistral-ocr-lab-ocr-app
  docker compose up -d
  curl --fail --silent --show-error http://127.0.0.1:3010/api/health >/dev/null
  echo "Rollback health check passed."
else
  echo "No mistral-ocr-lab-rollback image found."
  exit 1
fi
