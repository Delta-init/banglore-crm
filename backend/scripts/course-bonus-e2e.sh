#!/usr/bin/env bash
#
# End-to-end test of a course's bonus — set when a course is created or
# edited on the Courses page, kept, listed, and sent with the courses a lead
# names, so a new close starts from it.
#
# Stands up a throwaway mongod and this backend. Nothing here touches a
# configured database: backend/.env names the LIVE Banglore CRM database, and
# src/index.ts loads dotenv itself, so `bun --no-env-file` alone would not keep
# it out — DOTENV_CONFIG_PATH points at a file that does not exist as well, and
# the driver refuses anything but a scratch database on 127.0.0.1.
#
#   ./scripts/course-bonus-e2e.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_PORT="${E2E_MONGO_PORT:-27095}"
API_PORT="${E2E_API_PORT:-5097}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/banglore-course-bonus-e2e.XXXXXX")"

release_port() {
  local port="$1" pids
  for _ in $(seq 1 20); do
    pids="$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$pids" ] && return 0
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.25
  done
}

cleanup() {
  local code=$?
  release_port "$API_PORT"
  mongod --dbpath "$WORK/db" --port "$MONGO_PORT" --shutdown >/dev/null 2>&1 || true
  release_port "$MONGO_PORT"
  rm -rf "$WORK"
  exit $code
}

for port in "$MONGO_PORT" "$API_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use." >&2
    rm -rf "$WORK"
    exit 1
  fi
done
# Only now: a port somebody else holds must make this stop, not get killed by the cleanup.
trap cleanup EXIT INT TERM

mkdir -p "$WORK/db"
echo "Starting a throwaway mongod on :$MONGO_PORT"
mongod --dbpath "$WORK/db" --port "$MONGO_PORT" --bind_ip 127.0.0.1 --fork --logpath "$WORK/mongo.log" >/dev/null

# Everything the backend and the driver read, and nothing from any .env.
export DOTENV_CONFIG_PATH="$WORK/no-such-dotenv"
export MONGODB_URI="mongodb://127.0.0.1:$MONGO_PORT/banglore_course_bonus_e2e"
export PORT="$API_PORT"
export NODE_ENV=test
export JWT_SECRET="banglore-course-bonus-e2e-access-secret-0123456789"
export JWT_REFRESH_SECRET="banglore-course-bonus-e2e-refresh-secret-0123456789"
export FINANCE_API_URL="" FINANCE_CLIENT_ID="" FINANCE_INTEGRATION_SECRET="" FINANCE_ORG_ID=""
export LMS_API_URL="" ROOT_ERP_SECRET="" RUN_SCHEDULERS=false
export TELEGRAM_BOT_TOKEN="" TELEGRAM_CHAT_ID="" GEMINI_API_KEY=""
# web-push refuses to load without VAPID keys: a throwaway pair, made here.
VAPID="$(cd "$HERE" && bun --no-env-file -e 'const k = require("web-push").generateVAPIDKeys(); console.log(k.publicKey + " " + k.privateKey)')"
export VAPID_PUBLIC_KEY="${VAPID%% *}" VAPID_PRIVATE_KEY="${VAPID##* }"
export E2E_API_PORT="$API_PORT"

echo "Starting the Banglore CRM backend on :$API_PORT"
cd "$HERE"
bun --no-env-file src/index.ts > "$WORK/api.log" 2>&1 &

for _ in $(seq 1 80); do
  curl -s -o /dev/null "http://127.0.0.1:$API_PORT/api/v1/courses" && break
  sleep 0.25
done
curl -s -o /dev/null "http://127.0.0.1:$API_PORT/api/v1/courses" || {
  echo "The backend did not start:" >&2
  tail -30 "$WORK/api.log" >&2
  exit 1
}
if ! grep -q "127.0.0.1" "$WORK/api.log"; then
  echo "The backend did not report connecting to the scratch database:" >&2
  tail -30 "$WORK/api.log" >&2
  exit 1
fi

echo "Giving courses a bonus"
if ! bun --no-env-file src/scripts/courseBonusE2e.ts; then
  echo
  echo "--- last 30 lines of the backend log ---" >&2
  tail -30 "$WORK/api.log" | sed -E 's#mongodb://[^ ]*#<uri>#g' >&2
  exit 1
fi
