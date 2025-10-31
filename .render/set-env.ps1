<#
Usage: .\set-env.ps1 -ServiceId <id> -Key <KEY> -Value <Value>
Example:
  $env:RENDER_API_KEY = 'rnd_Q4JdMWMttE0Cm2Wp4hO9WaBILxeX'
  .\set-env.ps1 -ServiceId 'srv-abc123' -Key 'AGENT_URL' -Value 'http://stocktraderl-agent:9001/'
#>
param(
  [Parameter(Mandatory=$true)] [string] $ServiceId,
  [Parameter(Mandatory=$true)] [string] $Key,
  [Parameter(Mandatory=$true)] [string] $Value
)

if (-not $env:RENDER_API_KEY) {
  Write-Error "Please set the RENDER_API_KEY environment variable locally before running this script."
  exit 1
}

$body = @{ key = $Key; value = $Value; scope = 'RUN_TIME' } | ConvertTo-Json

$headers = @{ Authorization = "Bearer $($env:RENDER_API_KEY)"; 'Content-Type' = 'application/json' }

Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$ServiceId/env-vars" -Headers $headers -Body $body
