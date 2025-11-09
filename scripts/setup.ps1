param(
    [string]$PythonVersion = "3.11",
    [switch]$ForceVenv
)

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$venvPath = Join-Path $root ".venv"
$venvPython = Join-Path $venvPath "Scripts/python.exe"

Write-Host "==> Repository root: $root"

if (Test-Path $venvPath) {
    if ($ForceVenv.IsPresent) {
        Write-Host "==> Removing existing virtual environment (force requested)"
        Remove-Item $venvPath -Recurse -Force
    } else {
        Write-Host "==> Virtual environment already exists at $venvPath"
    }
}

if (-not (Test-Path $venvPath)) {
    Write-Host "==> Creating Python $PythonVersion virtual environment"
    & py -$PythonVersion -m venv $venvPath
}

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment python executable not found at $venvPython"
}

Write-Host "==> Upgrading pip"
& $venvPython -m pip install --upgrade pip

Write-Host "==> Installing backend dependencies"
& $venvPython -m pip install -r (Join-Path $root "backend/requirements.txt")

Write-Host "==> Installing frontend dependencies"
Push-Location $root
try {
    & npm install
} finally {
    Pop-Location
}

Write-Host "==> Setup complete. Activate the venv with `.\\.venv\\Scripts\\Activate.ps1` and run `npm run dev:full`."
