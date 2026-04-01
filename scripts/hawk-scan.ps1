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

.NOTES
  Compatible with Windows PowerShell 5.1 and PowerShell 7+.
#>

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

Write-Host "`n=== StackHawk Authenticated Scan ===" -ForegroundColor Cyan

# --- Step 1: Check dev server ---
Write-Host "`n[1/4] Checking dev server on localhost:3000..." -ForegroundColor Yellow
try {
    # Use .NET WebRequest for 5.1 compat — just need to confirm the server responds
    $req = [System.Net.WebRequest]::Create('http://localhost:3000/login')
    $req.Timeout = 5000
    $req.AllowAutoRedirect = $false
    $resp = $req.GetResponse()
    $resp.Close()
    Write-Host "  Dev server is up." -ForegroundColor Green
} catch [System.Net.WebException] {
    # A non-2xx status (302, 401, etc.) still means the server is alive
    if ($_.Exception.Response) {
        Write-Host "  Dev server is up." -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Dev server not responding on localhost:3000." -ForegroundColor Red
        Write-Host "  Start it first:  cd C:\Users\brian\clinic-notes-ai && pnpm dev" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERROR: Dev server not responding on localhost:3000." -ForegroundColor Red
    Write-Host "  Start it first:  cd C:\Users\brian\clinic-notes-ai && pnpm dev" -ForegroundColor Red
    exit 1
}

# --- Step 2: Mint session cookie via dev-login ---
Write-Host "`n[2/4] Minting session cookie via /api/auth/dev-login..." -ForegroundColor Yellow
$setCookieHeader = $null
try {
    # dev-login returns 303 redirect — in PS 5.1 this throws with -MaximumRedirection 0
    $req = [System.Net.HttpWebRequest]::Create('http://localhost:3000/api/auth/dev-login')
    $req.AllowAutoRedirect = $false
    $req.Timeout = 10000
    $resp = $req.GetResponse()
    $setCookieHeader = $resp.Headers['Set-Cookie']
    $resp.Close()
} catch [System.Net.WebException] {
    # 303 redirect throws — extract Set-Cookie from the error response
    $errResp = $_.Exception.Response
    if ($errResp) {
        $setCookieHeader = $errResp.Headers['Set-Cookie']
    }
}

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
$cookieLen = $sessionCookie.Length
Write-Host "  Session cookie obtained ($cookieLen chars)." -ForegroundColor Green

# --- Step 3: Load .env.hawk ---
Write-Host "`n[3/4] Loading .env.hawk..." -ForegroundColor Yellow
$envHawkPath = Join-Path $repoRoot '.env.hawk'
if (-not (Test-Path $envHawkPath)) {
    Write-Host "  ERROR: .env.hawk not found at $envHawkPath" -ForegroundColor Red
    Write-Host "  Copy .env.hawk.example to .env.hawk and fill in your values." -ForegroundColor Red
    exit 1
}

$hawkApiKey = $null
$appId = $null
foreach ($line in (Get-Content $envHawkPath)) {
    if ($line -match '^\s*HAWK_API_KEY\s*=\s*(.+)\s*$') { $hawkApiKey = $Matches[1].Trim() }
    if ($line -match '^\s*APP_ID\s*=\s*(.+)\s*$') { $appId = $Matches[1].Trim() }
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

# Write a temp Docker env file to bypass all PS 5.1 variable-passing issues.
# Docker --env-file reads KEY=VALUE directly from disk — no shell interpolation.
$dockerEnvFile = Join-Path $repoRoot '.hawk-docker.env'
try {
    @(
        "API_KEY=$hawkApiKey",
        "APP_ID=$appId",
        "APP_ENV=local",
        "APP_BASE_URL=http://host.docker.internal:3000",
        "SESSION_COOKIE=$sessionCookie"
    ) | Set-Content -Path $dockerEnvFile -Encoding ASCII

    $dockerArgs = @(
        'run', '--rm',
        '--env-file', $dockerEnvFile,
        '-v', "${stackhawkYml}:/hawk/stackhawk.yml",
        'stackhawk/hawkscan'
    )
    & docker @dockerArgs
} finally {
    # Always clean up the temp env file (contains secrets)
    Remove-Item $dockerEnvFile -Force -ErrorAction SilentlyContinue
}

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
