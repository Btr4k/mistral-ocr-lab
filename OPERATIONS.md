# Operations

## Start

```bash
docker compose up -d
```

## Stop

```bash
docker compose down
```

## Restart

```bash
docker compose restart ocr-app
```

## Status

```bash
docker compose ps
docker inspect --format='{{.State.Health.Status}}' mistral-ocr-lab
```

## Safe Logs

```bash
docker compose logs --tail=100 ocr-app
```

## Health Check

```bash
curl -i http://127.0.0.1:3010/api/health
```

## Nginx Status

```bash
sudo nginx -t
systemctl is-active nginx
```

## Certificate Status

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## Update Workflow

Pull or copy the new release, preserve `.env.production`, run validation, then run `deployment/deploy.sh`.

## Rollback Workflow

Use the documented previous image tag strategy in `deployment/rollback.sh`.

## Resource Monitoring

```bash
docker stats mistral-ocr-lab
df -h
free -h
```

## Rate-Limit Tuning

Change `OCR_RATE_LIMIT_PER_MINUTE` for app-level limits and `deployment/nginx/ocr-rate-limit.conf` for Nginx limits.

## Incident Isolation

Disable the Nginx site symlink or stop only `ocr-app`. Do not stop unrelated containers.
