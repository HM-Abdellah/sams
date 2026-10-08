#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARTIFACTS="$ROOT/artifacts/deep-audit"
DB_CONTAINER="sams-deep-audit-db"
APP_CONTAINER="sams-final-verify-app"
APP_IMAGE="sams-deep-audit-app:latest"
SERVER_LOG="$ARTIFACTS/server.log"
mkdir -p "$ARTIFACTS"

export SAMS_BASE_URL="http://127.0.0.1:8080/sams/"
export SAMS_TEST_DB_HOST="127.0.0.1"
export SAMS_TEST_DB_PORT="3307"
export SAMS_TEST_DB_NAME="sams"
export SAMS_TEST_DB_USER="root"
export SAMS_TEST_DB_PASS="root"
export SAMS_ALLOW_EXAMPLE_CONFIG="1"

export SAMS_E2E_ADMIN_SAMS_CODE="A123456"
export SAMS_E2E_TEACHER_SAMS_CODE="T123456"
export SAMS_E2E_PASSWORD="DeepAudit-Admin-2026!"
export SAMS_E2E_TEACHER_PASSWORD="DeepAudit-Teacher-2026!"

cleanup() {
  status=$?
  trap - EXIT
  docker rm -f "$APP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  rm -f "$ROOT/backend/config/app.php" "$ROOT/backend/config/database.php"
  exit "$status"
}
trap cleanup EXIT

docker rm -f "$APP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true

if ! docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  cat > /tmp/sams-deep-audit.Dockerfile <<'DOCKERFILE'
FROM php:8.3-cli-bookworm
RUN apt-get update     && apt-get install -y --no-install-recommends        libxml2-dev libonig-dev libzip-dev libfreetype6-dev        libjpeg62-turbo-dev libpng-dev libwebp-dev unzip     && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp     && docker-php-ext-install -j"$(nproc)" dom gd mbstring pdo_mysql xml xmlwriter zip     && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
DOCKERFILE
  docker build -t "$APP_IMAGE" -f /tmp/sams-deep-audit.Dockerfile /tmp >/dev/null
fi

docker run -d   --name "$DB_CONTAINER"   --network host   -e MARIADB_ROOT_PASSWORD=root   -e MARIADB_DATABASE=sams   mariadb:11.4 --port=3307 >/dev/null

for _ in $(seq 1 60); do
  if python3 -c 'import socket; s=socket.create_connection(("127.0.0.1", 3307), 1); s.close()' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! python3 -c 'import socket; s=socket.create_connection(("127.0.0.1", 3307), 2); s.close()' >/dev/null 2>&1; then
  echo "Deep audit database did not become ready."
  docker logs "$DB_CONTAINER" | tail -n 80
  exit 1
fi

cat > backend/config/app.php <<'PHP'
<?php
return [
    'name' => 'SAMS Deep Audit',
    'environment' => 'development',
    'debug' => true,
    'base_path' => '/sams/public',
    'session_name' => 'SAMS_SESSION',
    'session_lifetime' => 3600,
    'session_idle_timeout' => 3600,
    'session_absolute_timeout' => 43200,
    'login_max_attempts' => 5,
    'login_lock_minutes' => 15,
];
PHP

cat > backend/config/database.php <<'PHP'
<?php
return [
    'host' => getenv('SAMS_TEST_DB_HOST') ?: '127.0.0.1',
    'port' => (int)(getenv('SAMS_TEST_DB_PORT') ?: 3307),
    'database' => getenv('SAMS_TEST_DB_NAME') ?: 'sams',
    'username' => getenv('SAMS_TEST_DB_USER') ?: 'root',
    'password' => getenv('SAMS_TEST_DB_PASS') ?: 'root',
    'charset' => 'utf8mb4',
];
PHP

docker run --rm   --network host   -v "$ROOT:/workspace"   -w /workspace   -e SAMS_TEST_DB_HOST=127.0.0.1   -e SAMS_TEST_DB_PORT=3307   -e SAMS_TEST_DB_NAME=sams   -e SAMS_TEST_DB_USER=root   -e SAMS_TEST_DB_PASS=root   -e SAMS_E2E_ADMIN_SAMS_CODE="$SAMS_E2E_ADMIN_SAMS_CODE"   -e SAMS_E2E_TEACHER_SAMS_CODE="$SAMS_E2E_TEACHER_SAMS_CODE"   -e SAMS_E2E_PASSWORD="$SAMS_E2E_PASSWORD"   -e SAMS_E2E_TEACHER_PASSWORD="$SAMS_E2E_TEACHER_PASSWORD"   "$APP_IMAGE"   php scripts/e2e_seed.php

npm --prefix frontend run build -- --base /sams/

docker run -d   --name "$APP_CONTAINER"   --network host   -v "$ROOT:/workspace"   -w /workspace   -e SAMS_ALLOW_EXAMPLE_CONFIG=1   -e SAMS_TEST_DB_HOST=127.0.0.1   -e SAMS_TEST_DB_PORT=3307   -e SAMS_TEST_DB_NAME=sams   -e SAMS_TEST_DB_USER=root   -e SAMS_TEST_DB_PASS=root   "$APP_IMAGE"   sh -lc 'mkdir -p /tmp/sams-sessions && php -d session.save_path=/tmp/sams-sessions -d session.name=SAMS_SESSION -S 0.0.0.0:8080 scripts/dev_router.php'   >"$SERVER_LOG" 2>&1

for _ in $(seq 1 30); do
  if curl -fsS "$SAMS_BASE_URL/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$SAMS_BASE_URL/api/v1/health" >/tmp/sams-deep-audit-health.json; then
  echo "SAMS runtime did not become healthy."
  docker logs "$APP_CONTAINER" | tail -n 120
  exit 1
fi

echo "=== DEEP AUTOMATED SAMS AUDIT ==="
echo "Runtime: $SAMS_BASE_URL"
echo "PHP runtime: $APP_IMAGE"
echo "Database port: 3307"
echo

echo "[1/3] Core final A-Z browser gate"
set +e
SAMS_BASE_URL="$SAMS_BASE_URL" SAMS_FINAL_DB_CHECK_IN_CONTAINER=1 npx playwright test   tests/e2e/final_verification_a_to_z.spec.js   --config=playwright.deep-audit.config.js   --project=chromium   --reporter=list
CORE_AZ_STATUS=$?
set -e
echo "[A-Z exit code: $CORE_AZ_STATUS]"

echo
echo "[2/3] Deep page/UX/accessibility/responsive/browser audit"
set +e
SAMS_BASE_URL="$SAMS_BASE_URL" npx playwright test   tests/e2e/deep_product_audit.spec.js   --config=playwright.deep-audit.config.js   --project=chromium   --reporter=list
DEEP_BROWSER_STATUS=$?
set -e
echo "[Deep browser exit code: $DEEP_BROWSER_STATUS]"

echo
echo "[3/3] Final database consistency audit"
docker run --rm   --network host   -v "$ROOT:/workspace"   -w /workspace   -e SAMS_ALLOW_EXAMPLE_CONFIG=1   -e SAMS_TEST_DB_HOST=127.0.0.1   -e SAMS_TEST_DB_PORT=3307   -e SAMS_TEST_DB_NAME=sams   -e SAMS_TEST_DB_USER=root   -e SAMS_TEST_DB_PASS=root   "$APP_IMAGE"   php tests/final_verification_db.php

echo
echo "=== DEEP AUDIT COMPLETE ==="
echo "Human report : $ARTIFACTS/report.html"
echo "Machine report: $ARTIFACTS/report.json"
echo "Playwright report: $ARTIFACTS/playwright-report/index.html"

