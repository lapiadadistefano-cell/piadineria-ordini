# V9 fixed synthetic fixture observer. Read-only; no printer, V8 or filesystem.
param([Parameter(Mandatory=$true)][string]$Key)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($Key) -or $Key.Length -lt 32){throw 'Invalid lab-only key'}
$uri='https://la-piada-mypos-sandbox-test.onrender.com/api/v9-lab/fixture-order'
$r=Invoke-RestMethod -Method Get -Uri $uri -Headers @{'x-v9-lab-key'=$Key} -TimeoutSec 20
if($r.labOnly -ne $true -or $r.readOnly -ne $true -or $r.printerConnected -ne $false){throw 'Unsafe lab response'}
$o=$r.order
if($null -eq $o -or $o.payment_reference -ne 'LAB-001' -or $o.lab_only -ne $true -or
 $o.simulated_payment -ne $true -or $o.no_real_transaction -ne $true){throw 'Not an authorized synthetic fixture'}
if(@('pending','printing','print_review_required','printed') -notcontains [string]$o.status){throw 'Unexpected order state'}
if($o.status -eq 'printed'){Write-Output 'LAB-001 already printed: never reprint'}
elseif($o.status -eq 'printing' -or $o.status -eq 'print_review_required'){Write-Output 'LAB-001 needs manual review: no automatic retry'}
else{Write-Output 'LAB-001 fixture observed: no printing'}
Write-Output ('Synthetic item count: ' + @($o.items).Count)
