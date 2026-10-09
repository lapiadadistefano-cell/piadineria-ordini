# Offline fake server test for fixed synthetic fixture observer.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$global:V9FixtureMockCalls=0
function Invoke-RestMethod {
 param($Method,$Uri,$Headers,$TimeoutSec)
 $global:V9FixtureMockCalls++
 if($Method -ne 'Get' -or $Uri -ne 'https://la-piada-mypos-sandbox-test.onrender.com/api/v9-lab/fixture-order'){throw 'Unexpected method/URL'}
 if($Headers['x-v9-lab-key'] -ne ('x'*40)){throw 'Wrong lab auth'}
 return [pscustomobject]@{
 labOnly=$true;readOnly=$true;printerConnected=$false
 order=[pscustomobject]@{payment_reference='LAB-001';lab_only=$true;simulated_payment=$true;no_real_transaction=$true;
 payment_verified=$true;payment_status='paid';status='printed';items=@([pscustomobject]@{name='Piadina di prova';qty=1;price=8})}
 }
}
& "$PSScriptRoot/v9-sandbox-fixture-observer.ps1" -Key ('x'*40)
if($global:V9FixtureMockCalls -ne 1){throw 'Expected one read-only call'}
Write-Output 'V9 SYNTHETIC FIXTURE OBSERVER OFFLINE PASSED'
