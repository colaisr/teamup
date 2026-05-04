# TeamUp Infra (Single VPS, Lean Ops)

## Includes

- `docker-compose.prod.yml` for frontend/backend/postgres/nginx
- `nginx.conf` reverse-proxy + HTTPS routing
- `deploy.sh` deployment script
- `setup_https.sh` Let's Encrypt certificate helper
- `backup_postgres.sh` daily backup script

## VPS Prerequisites

1. Ubuntu LTS
2. Docker + Docker Compose
3. Domain DNS pointing to VPS
4. `.env` file in repository root

## Deploy

```bash
cd infra
chmod +x deploy.sh setup_https.sh backup_postgres.sh
./deploy.sh
```

## HTTPS

```bash
cd infra
./setup_https.sh your.domain.com admin@your.domain.com
docker restart teamup_nginx
```

## Daily Backup (cron)

```bash
0 3 * * * cd /path/to/TeamUp/infra && ./backup_postgres.sh >> /var/log/teamup_backup.log 2>&1
```

