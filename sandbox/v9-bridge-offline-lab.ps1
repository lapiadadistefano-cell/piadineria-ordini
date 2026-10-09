# V9 LAB - SIMULAZIONE OFFLINE. NON STAMPA, NON SI COLLEGA A INTERNET.
# Non sostituisce e non avvia il bridge V8 del negozio.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$orders = @(
  [pscustomobject]@{ Id="LAB-001"; PaymentVerified=$false; Status="awaiting_payment" },
  [pscustomobject]@{ Id="LAB-002"; PaymentVerified=$true;  Status="pending" },
  [pscustomobject]@{ Id="LAB-003"; PaymentVerified=$true;  Status="printing" },
  [pscustomobject]@{ Id="LAB-004"; PaymentVerified=$true;  Status="printed" },
  [pscustomobject]@{ Id="LAB-005"; PaymentVerified=$true;  Status="print_review_required" }
)
function Get-LabDecision($order) {
  if (-not $order.PaymentVerified) { return "BLOCCATO: pagamento non verificato" }
  switch ($order.Status) {
    "pending" { return "PRONTO: solo simulazione, nessuna stampa" }
    "printing" { return "VERIFICA MANUALE: possibile interruzione" }
    "printed" { return "BLOCCATO: gia elaborato" }
    "print_review_required" { return "BLOCCATO: verifica manuale necessaria" }
    default { return "BLOCCATO: stato sconosciuto" }
  }
}
$results = @($orders | ForEach-Object {
  [pscustomobject]@{ OrderId=$_.Id; Decision=(Get-LabDecision $_) }
})
$results | Format-Table -AutoSize
if ($results.Count -ne 5 -or
    $results[0].Decision -notlike "BLOCCATO*" -or
    $results[1].Decision -notlike "PRONTO*" -or
    $results[2].Decision -notlike "VERIFICA*" -or
    $results[3].Decision -notlike "BLOCCATO*" -or
    $results[4].Decision -notlike "BLOCCATO*") {
  throw "TEST NON SUPERATO"
}
Write-Host "TEST V9 OFFLINE SUPERATO - NESSUNA STAMPA, NESSUNA RETE."
