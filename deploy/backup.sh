#!/bin/sh
# Nightly Postgres backup for the docker-compose.prod.yml stack.
# crontab:  15 2 * * *  /opt/papervault/deploy/backup.sh >> /var/log/papervault-backup.log 2>&1
# Copy the resulting files off the server (rclone, restic, provider snapshots).
set -eu
cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$DEST"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_dump -U papervault -d papervault --format=custom --no-owner > "$DEST/papervault-$STAMP.dump"
find "$DEST" -name 'papervault-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $DEST/papervault-$STAMP.dump"
# Restore: docker compose ... exec -T db pg_restore -U papervault -d papervault --clean < FILE
