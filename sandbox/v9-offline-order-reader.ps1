# V9 OFFLINE ORDER READER: accepts only synthetic LAB fixtures.
# No network, printer, payment, filesystem or V8 access.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Get-V9LabOrderDecision {
 param([Parameter(Mandatory=$true)]$Order)
 if ($Order.lab_only -ne $true -or $Order.simulated_payment -ne $true -or $Order.no_real_transaction -ne $true) {
  return 'BLOCKED: not a synthetic lab fixture'
 }
 if ([string]$Order.payment_reference -notmatch '^LAB-[A-Za-z0-9-]{1,80}$') {
  return 'BLOCKED: invalid lab reference'
 }
 if ($Order.payment_verified -ne $true -or $Order.payment_status -ne 'paid') {
  return 'BLOCKED: payment not verified'
 }
 switch ([string]$Order.status) {
  'pending' { return 'READY FOR LAB REVIEW ONLY: no printing' }
  'printing' { return 'MANUAL REVIEW: uncertain interrupted print' }
  'print_review_required' { return 'MANUAL REVIEW: automatic retry prohibited' }
  'printed' { return 'BLOCKED: already printed' }
  default { return 'BLOCKED: unsupported state' }
 }
}
