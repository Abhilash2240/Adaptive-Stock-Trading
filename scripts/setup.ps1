$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[setup] Repository root: $repoRoot"

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "[setup] Creating virtual environment..."
    py -3.11 -m venv .venv
}

Write-Host "[setup] Installing backend dependencies..."
& .\.venv\Scripts\python -m pip install --upgrade pip
& .\.venv\Scripts\python -m pip install -r backend\requirements.txt

Write-Host "[setup] Installing frontend dependencies..."
npm install

Write-Host "[setup] Done."
Write-Host "[setup] Next: powershell -ExecutionPolicy Bypass -File scripts/start.ps1"
