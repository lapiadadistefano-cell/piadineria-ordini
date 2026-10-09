# V9 OFFLINE WINDOWS RECOVERY LAB. No network, files, printer, or V8 access.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Start-LabClaim($order, $token) {
 if ($order.Status -ne 'pending' -or -not $order.PaymentVerified -or [string]::IsNullOrWhiteSpace($token)) {
  return $false
 }
 $order.Status='printing'
 $order.Token=$token
 return $true
}
function Restart-Lab($order) {
 if ($order.Status -eq 'printing') { $order.Status='print_review_required' }
}
function Review-Lab($order,$decision) {
 if ($order.Status -ne 'print_review_required') { return $false }
 switch ($decision) {
  'confirm_printed' { $order.Status='printed'; return $true }
  'retry_after_check' { $order.Status='pending'; $order.Token=$null; return $true }
  default { return $false }
 }
}
function Assert-Lab($condition,$message) { if (-not $condition) { throw $message } }
$one=[pscustomobject]@{Status='pending';PaymentVerified=$true;Token=$null}
Assert-Lab (Start-LabClaim $one 'worker-1') 'Initial claim failed'
Assert-Lab (-not (Start-LabClaim $one 'worker-2')) 'Duplicate claim allowed'
Restart-Lab $one
Assert-Lab ($one.Status -eq 'print_review_required') 'Interrupted print auto-retried'
Assert-Lab (-not (Start-LabClaim $one 'worker-3')) 'Unreviewed order claimed'
Assert-Lab (Review-Lab $one 'confirm_printed') 'Manual confirmation failed'
Assert-Lab ($one.Status -eq 'printed') 'Printed status lost'
Assert-Lab (-not (Review-Lab $one 'retry_after_check')) 'Second review allowed'
$two=[pscustomobject]@{Status='pending';PaymentVerified=$true;Token=$null}
Assert-Lab (Start-LabClaim $two 'worker-a') 'Second initial claim failed'
Restart-Lab $two
Assert-Lab (Review-Lab $two 'retry_after_check') 'Checked retry denied'
Assert-Lab ($two.Status -eq 'pending' -and $null -eq $two.Token) 'Retry did not reset claim'
Assert-Lab (Start-LabClaim $two 'worker-b') 'Checked retry could not claim'
Assert-Lab (-not (Start-LabClaim $two 'worker-c')) 'Duplicate retry claimed'
$unpaid=[pscustomobject]@{Status='pending';PaymentVerified=$false;Token=$null}
Assert-Lab (-not (Start-LabClaim $unpaid 'worker-z')) 'Unpaid order claimed'
Write-Output 'V9 WINDOWS OFFLINE RECOVERY PASSED - NO PRINTER, NETWORK OR FILE ACCESS'
