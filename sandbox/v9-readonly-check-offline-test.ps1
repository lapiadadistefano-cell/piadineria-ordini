$ErrorActionPreference='Stop'
$script:called=$false
function Invoke-RestMethod {
 param($Method,$Uri,$Headers,$TimeoutSec)
 $script:called=$true
 if($Method -ne 'Get' -or $Uri -ne 'https://example.invalid/api/v9-lab/status') {throw 'Wrong endpoint'}
 if($Headers['x-v9-lab-key'] -ne ('x'*40)) {throw 'Wrong auth header'}
 return [pscustomobject]@{labOnly=$true;readOnly=$true;printerConnected=$false;totalSandboxRows=2;verifiedPaidSandboxRows=1}
}
& "$PSScriptRoot/v9-readonly-check.ps1" -BaseUrl 'https://example.invalid' -Key ('x'*40)
if(-not $script:called){throw 'No mock request made'}
Write-Output 'OFFLINE V9 READ-ONLY CHECK PASSED'
