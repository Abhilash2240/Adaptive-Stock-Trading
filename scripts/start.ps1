$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[start] Launching backend and frontend in this terminal..."
& .\.venv\Scripts\python dev.py
