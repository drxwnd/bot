# Saves Tradebench's private keys on Fly.io. Run it yourself: the keys go from your keyboard
# straight to Fly (typed hidden, not saved on this PC, not shown to anyone).
# Press Enter on a key to skip it and keep what's already there.

$fly = "$HOME\.fly\bin\flyctl.exe"
$keys = [ordered]@{
  STRIPE_SECRET_KEY     = 'Stripe secret key (Developers > API keys, starts sk_test_)'
  STRIPE_WEBHOOK_SECRET = 'Stripe webhook signing secret (starts whsec_)'
  RESEND_API_KEY        = 'Resend API key (starts re_)'
}

$lines = @()
foreach ($name in $keys.Keys) {
  $secure = Read-Host -AsSecureString $keys[$name]
  $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
  if ($value) { $lines += "$name=$value" }
}

if (-not $lines.Count) { Write-Host 'Nothing entered, nothing changed.'; exit }
# fly secrets import reads NAME=VALUE lines from its input, so the keys never appear on a command line.
$count = $lines.Count
$lines -join "`n" | & $fly secrets import --app trade-bench --stage
$lines = $null
Write-Host "`nSaved $count key(s). Tell Claude it's done." -ForegroundColor Green
Read-Host 'Press Enter to close'
