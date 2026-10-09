# V9 SANDBOX OBSERVER - READ ONLY. Never connects to a printer or V8.
# One request, no polling, no order changes, no output of credentials.
param(
 [Parameter(Mandatory=$true)][string]$Key
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Key) -or $Key.Length -lt 32) {
 throw 'V9 lab-only key missing or too short'
}
# Fixed staging host: cannot be redirected to the production service.
$uri = 'https://la-piada-mypos-sandbox-test.onrender.com/api/v9-lab/status'
$response = Invoke-RestMethod -Method Get -Uri $uri -Headers @{'x-v9-lab-key'=$Key} -TimeoutSec 20
if ($response.labOnly -ne $true -or $response.readOnly -ne $true -or $response.printerConnected -ne $false) {
 throw 'Unexpected staging response; observer stopped'
}
if ($null -eq $response.totalSandboxRows -or $null -eq $response.verifiedPaidSandboxRows) {
 throw 'Incomplete staging status; observer stopped'
}
Write-Output 'V9 OBSERVER: staging authenticated, read-only, no printer connection.'
Write-Output ('Sandbox records: ' + $response.totalSandboxRows)
Write-Output ('Verified paid flags (includes simulated lab fixtures): ' + $response.verifiedPaidSandboxRows)
