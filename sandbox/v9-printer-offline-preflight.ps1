# V9 PRINTER PREFLIGHT: OFFLINE VALIDATION ONLY.
# Does not connect to a printer, send ESC/POS bytes, access V8, or read secrets.
param(
 [string]$PrinterHost = '192.0.2.10',
 [int]$PrinterPort = 9100,
 [switch]$LabOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if (-not $LabOnly) { throw 'Refused: explicit -LabOnly required' }
$parsed=$null
if (-not [System.Net.IPAddress]::TryParse($PrinterHost,[ref]$parsed) -or
    $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
 throw 'Refused: IPv4 printer address required'
}
if ($PrinterPort -lt 1 -or $PrinterPort -gt 65535) { throw 'Refused: invalid printer port' }
if ($PrinterHost -ne '192.0.2.10') {
 throw 'Refused: this offline preflight accepts only the documentation-only test address'
}
Write-Output 'V9 PRINTER PREFLIGHT PASSED: configuration shape valid.'
Write-Output 'OFFLINE ONLY: no network connection, no ESC/POS commands, no printer access.'
