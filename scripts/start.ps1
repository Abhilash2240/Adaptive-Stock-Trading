param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$root = Split-Path $PSScriptRoot -Parent
$venvActivate = Join-Path $root ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
    Write-Error "Python virtual environment not found at $venvActivate"
    exit 1
}

if (-not $FrontendOnly) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$venvActivate'; cd '$root'; python -m backend.main" -WindowStyle Normal
}

if (-not $BackendOnly) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; npm run dev:frontend" -WindowStyle Normal
}
