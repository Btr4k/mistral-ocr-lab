#!/usr/bin/env bash
set -Eeuo pipefail

echo "Docker container:"
docker compose ps

echo "Local health:"
curl -i --max-time 10 http://127.0.0.1:3010/api/health

echo "Nginx config:"
if command -v nginx >/dev/null; then sudo nginx -t; else echo "nginx not installed"; fi

echo "Nginx service:"
if command -v systemctl >/dev/null; then systemctl is-active nginx || true; fi

echo "DNS:"
dig +short ocr.a8d.ai || true

echo "HTTP:"
curl -I --max-time 10 http://ocr.a8d.ai || true

echo "HTTPS:"
curl -I --max-time 10 https://ocr.a8d.ai || true

echo "TLS certificate:"
echo | openssl s_client -servername ocr.a8d.ai -connect ocr.a8d.ai:443 2>/dev/null | openssl x509 -noout -dates || true

echo "Loopback binding:"
ss -ltnp | grep 3010 || true

echo "No-store header:"
curl -sI http://127.0.0.1:3010/api/health | grep -i cache-control
