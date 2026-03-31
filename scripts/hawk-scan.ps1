<#
.SYNOPSIS
  Run an authenticated StackHawk scan against localhost:3000.

.DESCRIPTION
  1. Verifies the dev server is running on localhost:3000
  2. Hits /api/auth/dev-login to mint a session cookie (requires ALLOW_DEV_LOGIN=1)
  3. Loads HAWK_API_KEY and APP_ID from .env.hawk
  4. Runs stackhawk/hawkscan via Docker

.PREREQUISITES
  - Docker Desktop running
  - pnpm dev running in another terminal (with ALLOW_DEV_LOGIN=1 in .env.local)
  - .env.hawk in repo root with HAWK_API_KEY and APP_ID filled in
#>

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

Write-Host "`n=== StackHawk Authenticated Scan ===" -ForegroundColor Cyan

# --- Step 1: Check dev server ---
Write-Host "`n[1/4] Checking dev server on localhost:3000..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' `
        -TimeoutSec 5 -SkipHttpErrorCheck -MaximumRedirection 0
    Write-Host "  Dev server is up." -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Dev server not responding on localhost:3000." -ForegroundColor Red
    Write-Host "  Start it first: pnpm dev" -ForegroundColor Red
    exit 1
}

# --- Step 2: Mint session cookie via dev-login ---
Write-Host "`n[2/4] Minting session cookie via /api/auth/dev-login..." -ForegroundColor Yellow
$loginResponse = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/dev-login' `
    -MaximumRedirection 0 -SkipHttpErrorCheck

$setCookieHeader = $loginResponse.Headers['Set-Cookie']
if (-not $setCookieHeader) {
    Write-Host "  ERROR: No Set-Cookie header returned." -ForegroundColor Red
    Write-Host "  Verify ALLOW_DEV_LOGIN=1 is in .env.local and pnpm dev was restarted." -ForegroundColor Red
    exit 1
}

# Extract the cna_session value from the Set-Cookie header
$cookieMatch = [regex]::Match($setCookieHeader, 'cna_session=([^;]+)')
if (-not $cookieMatch.Success) {
    Write-Host "  ERROR: cna_session cookie not found in Set-Cookie header." -ForegroundColor Red
    Write-Host "  Header was: $setCookieHeader" -ForegroundColor Red
    exit 1
}
$sessionCookie = $cookieMatch.Groups[1].Value
Write-Host "  Session cookie obtained (${($sessionCookie.Length)} chars)." -ForegroundColor Green

# --- Step 3: Load .env.hawk ---
Write-Host "`n[3/4] Loading .env.hawk..." -ForegroundColor Yellow
$envHawkPath = Join-Path $repoRoot '.env.hawk'
if (-not (Test-Path $envHawkPath)) {
    Write-Host "  ERROR: .env.hawk not found at $envHawkPath" -ForegroundColor Red
    Write-Host "  Create it with HAWK_API_KEY and APP_ID from app.stackhawk.com" -ForegroundColor Red
    exit 1
}

$hawkApiKey = $null
$appId = $null
Get-Content $envHawkPath | ForEach-Object {
    if ($_ -match '^\s*HAWK_API_KEY\s*=\s*(.+)\s*$') { $hawkApiKey = $Matches[1].Trim() }
    if ($_ -match '^\s*APP_ID\s*=\s*(.+)\s*$') { $appId = $Matches[1].Trim() }
}

if (-not $hawkApiKey -or $hawkApiKey -match '^hawk\.x+$') {
    Write-Host "  ERROR: HAWK_API_KEY not set (still placeholder)." -ForegroundColor Red
    exit 1
}
if (-not $appId -or $appId -match '^x+-') {
    Write-Host "  ERROR: APP_ID not set (still placeholder)." -ForegroundColor Red
    exit 1
}
Write-Host "  Loaded API key and App ID." -ForegroundColor Green

# --- Step 4: Run hawkscan via Docker ---
Write-Host "`n[4/4] Running StackHawk scan via Docker..." -ForegroundColor Yellow
Write-Host "  Target: http://host.docker.internal:3000" -ForegroundColor Gray
Write-Host "  Config: stackhawk.yml" -ForegroundColor Gray
Write-Host ""

$stackhawkYml = Join-Path $repoRoot 'stackhawk.yml'

docker run --rm `
    -e "HAWK_API_KEY=$hawkApiKey" `
    -e "APP_ID=$appId" `
    -e "APP_ENV=local" `
    -e "APP_BASE_URL=http://host.docker.internal:3000" `
    -e "SESSION_COOKIE=$sessionCookie" `
    -v "${stackhawkYml}:/hawk/stackhawk.yml" `
    stackhawk/hawkscan

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== Scan complete. Check results at https://app.stackhawk.com ===" -ForegroundColor Green
} else {
    Write-Host "=== Scan exited with code $exitCode ===" -ForegroundColor Red
    Write-Host "  If auth failed, look for 'loggedOutIndicator' matches in the output." -ForegroundColor Yellow
    Write-Host "  If Docker failed, verify Docker Desktop is running." -ForegroundColor Yellow
}

exit $exitCode
