[CmdletBinding()]
param([string]$BaseUrl = "http://localhost:8080/sams/")

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$env:SAMS_BASE_URL = $BaseUrl
if (-not $env:SAMS_E2E_PASSWORD) { $env:SAMS_E2E_PASSWORD = "SAMS-Demo-Admin-2026!" }
if (-not $env:SAMS_E2E_TEACHER_PASSWORD) { $env:SAMS_E2E_TEACHER_PASSWORD = "SAMS-Demo-Teacher-2026!" }
$env:SAMS_DB_CHECK_RESULT = "required"
$env:SAMS_CONCURRENCY_SUITE = "enabled"

Write-Host "=== SAMS Final A-Z Verification ===" -ForegroundColor Cyan
$health = Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl.TrimEnd("/") + "/api/v1/health")
if ($health.StatusCode -ne 200) { throw "SAMS health endpoint did not return 200." }
Write-Host "[PASS] API health" -ForegroundColor Green

$temp = Join-Path $env:TEMP ("sams_issue_demo_codes_" + [Guid]::NewGuid().ToString("N") + ".php")
@'
<?php
declare(strict_types=1);
require_once 'C:\xampp\htdocs\sams\backend\src\bootstrap.php';
use SAMS\Helpers\Database;
use SAMS\Services\LoginCodeService;

$pdo = Database::connection();

function codeFor(PDO $pdo, string $username, LoginCodeService $service): string {
    $stmt = $pdo->prepare("SELECT id, school_id FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) throw new RuntimeException("User not found: {$username}");

    $admin = $pdo->query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND account_status = 'active' ORDER BY id LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    if (!$admin) throw new RuntimeException("Active admin not found.");

    return $service->issueForUser((int)$admin['id'], (int)$user['id'], (int)$user['school_id'])['sams_code'];
}

$service = new LoginCodeService();
echo "ADMIN_CODE=" . codeFor($pdo, 'admin.demo', $service) . PHP_EOL;
echo "TEACHER_CODE=" . codeFor($pdo, 'teacher.demo', $service) . PHP_EOL;
'@ | Set-Content -Encoding ASCII $temp

try {
  $issued = php $temp
  if ($LASTEXITCODE -ne 0) { throw "Unable to issue demo SAMS Codes." }
  foreach ($line in $issued) {
    if ($line -match '^ADMIN_CODE=(.+)$') { $env:SAMS_E2E_ADMIN_SAMS_CODE = $Matches[1] }
    if ($line -match '^TEACHER_CODE=(.+)$') { $env:SAMS_E2E_TEACHER_SAMS_CODE = $Matches[1] }
  }
  if (-not $env:SAMS_E2E_ADMIN_SAMS_CODE -or -not $env:SAMS_E2E_TEACHER_SAMS_CODE) { throw "Demo SAMS Codes were not returned." }
  Write-Host "[PASS] Demo SAMS Codes issued" -ForegroundColor Green

  php tests/final_verification_db.php
  if ($LASTEXITCODE -ne 0) { throw "Database consistency verification failed." }

  npx playwright test tests/e2e/final_verification_a_to_z.spec.js tests/e2e/frontend_phase18_accessibility.spec.js tests/e2e/frontend_phase19_security.spec.js tests/e2e/frontend_phase20_performance.spec.js tests/e2e/frontend_phase22_real_backend_smoke.spec.js tests/e2e/frontend_phase23_production_integration.spec.js tests/e2e/frontend_phase24_final_audit.spec.js tests/e2e/frontend_phase37_teacher_attendance_responsive.spec.js tests/e2e/frontend_phase38_attendance_concurrency.spec.js --project=chromium --reporter=list
  if ($LASTEXITCODE -ne 0) { throw "Playwright final verification failed." }

  Write-Host "=== FINAL A-Z VERIFICATION: PASS ===" -ForegroundColor Green
}
finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $temp
}

