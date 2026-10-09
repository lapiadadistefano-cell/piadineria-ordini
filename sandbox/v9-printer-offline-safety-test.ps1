# V9: ensure offline preflight refuses unsafe modes and destinations.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$scriptPath=Join-Path $PSScriptRoot 'v9-printer-offline-preflight.ps1'
function Expect-Rejection([string]$CaseName,[hashtable]$Arguments) {
 $rejected=$false
 try { & $scriptPath @Arguments | Out-Null }
 catch { $rejected=$true }
 if (-not $rejected) { throw "UNSAFE: $CaseName accepted" }
 Write-Output "PASS: rejected $CaseName"
}
Expect-Rejection 'missing explicit lab switch' @{PrinterHost='192.0.2.10'}
Expect-Rejection 'localhost printer address' @{PrinterHost='127.0.0.1';LabOnly=$true}
Expect-Rejection 'private LAN printer address' @{PrinterHost='192.168.1.10';LabOnly=$true}
Expect-Rejection 'invalid port' @{PrinterHost='192.0.2.10';PrinterPort=0;LabOnly=$true}
Expect-Rejection 'host name instead of IPv4' @{PrinterHost='printer.local';LabOnly=$true}
& $scriptPath -LabOnly | Out-Null
Write-Output 'V9 OFFLINE PRINTER SAFETY TESTS PASSED - NO NETWORK OR PRINTING'
