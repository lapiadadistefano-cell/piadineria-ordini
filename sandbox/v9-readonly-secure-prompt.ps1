# V9 LAB: verifica HTTPS di sola lettura. Non invia stampe, non tocca V8.
# La chiave viene digitata localmente, senza mostrarla e senza salvarla su disco.
param(
 [string]$BaseUrl = 'https://la-piada-mypos-sandbox-test.onrender.com'
)
$ErrorActionPreference = 'Stop'
if ($BaseUrl -ne 'https://la-piada-mypos-sandbox-test.onrender.com') {
 throw 'Solo il server Sandbox autorizzato e consentito'
}
$secure = Read-Host 'Inserisci la chiave V9 del SOLO laboratorio (non appare sullo schermo)' -AsSecureString
$ptr = [IntPtr]::Zero
$key = $null
try {
 $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 & "$PSScriptRoot/v9-readonly-check.ps1" -BaseUrl $BaseUrl -Key $key
} finally {
 $key = $null
 if ($ptr -ne [IntPtr]::Zero) {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
 }
 $secure.Dispose()
}
