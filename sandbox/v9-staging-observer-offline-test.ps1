# Offline mock for V9 staging observer. No network or printer access.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script:calls=0
function Invoke-RestMethod {
 param($Method,$Uri,$Headers,$TimeoutSec)
 $script:calls++
 if ($Method -ne 'Get' -or $Uri -ne 'https://la-piada-mypos-sandbox-test.onrender.com/api/v9-lab/status') { throw 'Unexpected endpoint or method' }
 if ($Headers['x-v9-lab-key'] -ne ('x'*40)) { throw 'Unexpected authentication header' }
 return [pscustomobject]@{labOnly=$true;readOnly=$true;printerConnected=$false;totalSandboxRows=7;verifiedPaidSandboxRows=7}
}
& "$PSScriptRoot/v9-staging-observer.ps1" -Key ('x'*40)
if ($script:calls -ne 1) {throw 'Expected exactly one read-only request'}
Write-Output 'V9 STAGING OBSERVER OFFLINE MOCK PASSED'
