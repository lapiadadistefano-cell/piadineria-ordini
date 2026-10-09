param(
 [Parameter(Mandatory=$true)][string]$BaseUrl,
 [Parameter(Mandatory=$true)][string]$Key
)
$ErrorActionPreference = "Stop"
if ($BaseUrl -notmatch '^https://[a-z0-9.-]+/?$') { throw "HTTPS base URL required" }
if ($Key.Length -lt 32) { throw "Missing or short V9-only key" }
$uri=$BaseUrl.TrimEnd('/') + '/api/v9-lab/status'
$response=Invoke-RestMethod -Method Get -Uri $uri -Headers @{'x-v9-lab-key'=$Key} -TimeoutSec 20
if ($response.labOnly -ne $true -or $response.readOnly -ne $true -or $response.printerConnected -ne $false) {
 throw "Unexpected V9 lab response: refusing to proceed"
}
Write-Output "V9 LAB OK: authorized read-only connection. Printer untouched."
Write-Output ("Sandbox records: " + $response.totalSandboxRows)
Write-Output ("Verified paid records: " + $response.verifiedPaidSandboxRows)
