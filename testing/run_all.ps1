# Run the complete test suite: back end (pytest), front end (Vitest) and the sample-program check.
# Usage (PowerShell, from anywhere):   .\testing\run_all.ps1            full run (about 3 minutes)
#                                       .\testing\run_all.ps1 -Quick     skips the slow sandbox/live-server tests
# Results are written to testing\results\ (junit.xml, vitest.json, summary.txt).
param([switch]$Quick)

$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
$out = Join-Path $PSScriptRoot "results"
New-Item -ItemType Directory -Force $out | Out-Null

if (-not (Test-Path $py)) { Write-Host "Back end is not set up. Follow HOW_TO_RUN.md section 2 first." -ForegroundColor Red; exit 2 }
$summary = @()
$failed = $false

Write-Host "`n=== 1/3 Back end (pytest) ===" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
$targets = if ($Quick) { @("tests/test_auth.py", "tests/test_execution.py", "tests/test_history_admin.py", "tests/test_security.py") } else { @("tests") }
& $py -m pytest @targets -q -p no:cacheprovider -W ignore --junitxml="$out\junit.xml"
if ($LASTEXITCODE -ne 0) { $failed = $true; $summary += "Back end:  FAILED" } else { $summary += "Back end:  passed" }
Pop-Location

Write-Host "`n=== 2/3 Front end (Vitest) ===" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { Write-Host "Front end is not set up (run npm install)." -ForegroundColor Red; $failed = $true; $summary += "Front end: NOT SET UP" }
else {
  npx vitest run --reporter=default --reporter=json --outputFile="$out\vitest.json"
  if ($LASTEXITCODE -ne 0) { $failed = $true; $summary += "Front end: FAILED" } else { $summary += "Front end: passed" }
}
Pop-Location

Write-Host "`n=== 3/3 Sample programs (expected statuses) ===" -ForegroundColor Cyan
& $py (Join-Path $PSScriptRoot "run_samples.py")
if ($LASTEXITCODE -ne 0) { $failed = $true; $summary += "Samples:   FAILED" } else { $summary += "Samples:   passed" }

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$summary | ForEach-Object { Write-Host $_ }
$summary | Set-Content (Join-Path $out "summary.txt")
if ($Quick) { Write-Host "(quick mode: sandbox attack suite and live-server tests were skipped)" -ForegroundColor Yellow }
if ($failed) { exit 1 } else { Write-Host "ALL TESTS PASSED" -ForegroundColor Green; exit 0 }
