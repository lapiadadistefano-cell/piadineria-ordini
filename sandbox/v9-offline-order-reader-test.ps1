# V9 synthetic order reader offline checks. No network, no printer.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. "$PSScriptRoot/v9-offline-order-reader.ps1"
function Assert-Decision($o,$expected) {
 $actual=Get-V9LabOrderDecision -Order $o
 if($actual -ne $expected){throw "Unexpected decision: $actual"}
}
$o=[pscustomobject]@{
 payment_reference='LAB-OFFLINE-002';lab_only=$true;simulated_payment=$true
 no_real_transaction=$true;payment_verified=$true;payment_status='paid'
 status='pending';customer_name='Cliente fittizio'
 items=@([pscustomobject]@{name='Piadina di prova';qty=1;price=8})
}
Assert-Decision $o 'READY FOR LAB REVIEW ONLY: no printing'
$o.status='printing'
Assert-Decision $o 'MANUAL REVIEW: uncertain interrupted print'
$o.status='print_review_required'
Assert-Decision $o 'MANUAL REVIEW: automatic retry prohibited'
$o.status='printed'
Assert-Decision $o 'BLOCKED: already printed'
$o.status='pending';$o.payment_verified=$false
Assert-Decision $o 'BLOCKED: payment not verified'
$o.payment_verified=$true;$o.lab_only=$false
Assert-Decision $o 'BLOCKED: not a synthetic lab fixture'
$o.lab_only=$true;$o.payment_reference='REAL-123'
Assert-Decision $o 'BLOCKED: invalid lab reference'
Write-Output 'V9 OFFLINE SYNTHETIC ORDER READER PASSED - NO PRINTING'
