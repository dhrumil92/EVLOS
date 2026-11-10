#!/usr/bin/env bash
# Nightly backup of the evlos database on the VM, see docs/DEPLOY.md section 12.
# Saves the whole database (every table and row) as one checked file, then keeps only the newest
# KEEP files. The live database is never changed.
#
# Run by cron at 19:00 UTC (00:30 IST):
#   0 19 * * * bash /home/doshiname/EVLOS/deploy/backup.sh >> /home/doshiname/evlos-backups/backup.log 2>&1
#
# The settings can be changed for one run, as the checks in docs/DEPLOY.md do:
#   EVLOS_BACKUP_CONTAINER=wrong-name EVLOS_BACKUP_DIR=~/backup-test bash backup.sh
#
# Optional copy to Google Drive: set EVLOS_BACKUP_DRIVE to an rclone remote and folder, for example
#   EVLOS_BACKUP_DRIVE=evlos-drive:evlos-backups
# The file is uploaded only after it is saved and checked. A failed upload keeps the local backup,
# removes nothing and ends the run with an error. Nothing is ever deleted on Drive.
set -euo pipefail

CONTAINER="${EVLOS_BACKUP_CONTAINER:-evlos-postgres-1}"
BACKUP_DIR="${EVLOS_BACKUP_DIR:-$HOME/evlos-backups}"
KEEP="${EVLOS_BACKUP_KEEP:-90}"
DRIVE="${EVLOS_BACKUP_DRIVE:-}"

now_ist() { TZ=Asia/Kolkata date '+%Y-%m-%d %H:%M:%S IST'; }
fail() {
  echo "$(now_ist) backup FAILED: $1" >&2
  exit 1
}
# Any command that fails stops the script here, with a line in the log, before old files are removed.
trap 'echo "$(now_ist) backup FAILED at line $LINENO" >&2' ERR

[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || fail "EVLOS_BACKUP_KEEP must be a whole number above 0, not '$KEEP'."

# Only this user can read the folder and the files: a backup holds every Student's data.
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# The VM runs in UTC; the file is named by the IST date, as a Day is.
stamp="$(TZ=Asia/Kolkata date '+%Y-%m-%d_%H%M%S')"
final="$BACKUP_DIR/evlos-$stamp.dump"
partial="$final.partial"
# A half-written file is removed on any exit, so it can never be taken for a good backup.
trap 'rm -f "$partial"' EXIT

# pg_dump runs inside the container, as the evlos user over its local socket: no password needed.
docker exec "$CONTAINER" pg_dump -U evlos -d evlos --format=custom > "$partial"

[[ -s "$partial" ]] || fail "the dump is empty."
# PostgreSQL must be able to read the file back, or it is not a backup.
docker exec -i "$CONTAINER" pg_restore --list < "$partial" > /dev/null \
  || fail "pg_restore cannot read the dump."

mv "$partial" "$final"

# Names sort by date, so the oldest come first. Reached only when this run's file is good.
shopt -s nullglob
dumps=("$BACKUP_DIR"/evlos-*.dump)
removed=0
if (( ${#dumps[@]} > KEEP )); then
  removed=$(( ${#dumps[@]} - KEEP ))
  rm -f -- "${dumps[@]:0:removed}"
fi

size="$(du -h "$final" | cut -f1)"
echo "$(now_ist) saved $(basename "$final") ($size), removed $removed old, keeping up to $KEEP."

# The local backup is complete here, so whatever happens to the upload cannot lose it.
if [[ -n "$DRIVE" ]]; then
  command -v rclone > /dev/null || fail "EVLOS_BACKUP_DRIVE is set but rclone is not installed (the local backup is kept)."
  rclone copyto "$final" "$DRIVE/$(basename "$final")" --retries 3 \
    || fail "the upload to $DRIVE failed (the local backup is kept)."
  echo "$(now_ist) uploaded $(basename "$final") to $DRIVE."
fi
