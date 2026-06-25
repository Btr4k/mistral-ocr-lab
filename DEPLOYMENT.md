# Deployment

## VPS Preparation

Target directory: `/opt/mistral-ocr-lab`. Verify disk and memory before deployment:

```bash
df -h
free -h
```

## DNS Setup

Create:

- Type: A
- Name: ocr
- Value: <YOUR_SERVER_IP>
- TTL: 300

Verify before Certbot:

```bash
dig +short ocr.a8d.ai
```

Expected output includes `<YOUR_SERVER_IP>`.

## Docker And Nginx Verification

```bash
docker --version
docker compose version
nginx -v
sudo nginx -t
```

## Environment File

```bash
cd /opt/mistral-ocr-lab
cp .env.production.example .env.production
chmod 600 .env.production
```

Set `MISTRAL_API_KEY` without printing it.

## Docker Compose Deployment

```bash
./deployment/deploy.sh
docker compose ps
curl --fail http://127.0.0.1:3010/api/health
```

## Nginx Virtual Host

Inspect existing config first:

```bash
sudo nginx -T | grep -n "ocr.a8d.ai" || true
```

Install dedicated files:

```bash
sudo cp deployment/nginx/ocr-rate-limit.conf /etc/nginx/conf.d/ocr-rate-limit.conf
sudo cp deployment/nginx/ocr.a8d.ai.conf /etc/nginx/sites-available/ocr.a8d.ai
sudo ln -s /etc/nginx/sites-available/ocr.a8d.ai /etc/nginx/sites-enabled/ocr.a8d.ai
sudo nginx -t
sudo systemctl reload nginx
```

Back up existing files before overwriting anything.

## TLS With Certbot

Only after DNS resolves:

```bash
sudo certbot --nginx -d ocr.a8d.ai
sudo certbot renew --dry-run
```

## Firewall Verification

```bash
sudo ufw status verbose
sudo ss -ltnp | grep 3010
```

Ports 80 and 443 should be public; 3010 must remain loopback-only.

## Health Checks

```bash
curl -i http://127.0.0.1:3010/api/health
curl -i https://ocr.a8d.ai/api/health
```

## Updating

Copy new code, keep `.env.production`, then run `./deployment/deploy.sh`.

## Rolling Back

Tag a known-good image before updating and use `./deployment/rollback.sh` if needed.

## Safe Logs

```bash
docker compose logs --tail=100 ocr-app
sudo journalctl -u nginx --since "1 hour ago"
```

## Backups

Back up `.env.production` securely outside the repo and keep Nginx config backups before edits. Do not back up uploaded documents because the app does not persist them.

## Troubleshooting

Check Docker health, local health, Nginx `nginx -t`, DNS, TLS dates, and loopback binding using `deployment/verify.sh`.
