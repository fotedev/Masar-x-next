param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [Parameter(Mandatory=$true)][string]$Model,
  [Parameter(Mandatory=$true)][long]$DeadlineEpoch,
  [Parameter(Mandatory=$true)][string]$WorkDir
)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$argsFile = Join-Path $WorkDir "$TaskId.query-args.json"
$out = Join-Path $WorkDir "$TaskId.query.json"
$errFile = Join-Path $WorkDir "$TaskId.query.err"
$errors = 0
$deadline = [DateTimeOffset]::FromUnixTimeSeconds($DeadlineEpoch)
Set-Content -LiteralPath $argsFile -Value (@{ task_id = $TaskId; model = $Model } | ConvertTo-Json -Compress) -Encoding Ascii
while ($true) {
  $raw = (& mcode-tools connector call connector__matrix__query_video_generation --args-file $argsFile 2> $errFile | Out-String)
  $status = $null
  if ($LASTEXITCODE -eq 0) { try { $status = ($raw | ConvertFrom-Json).status } catch { $status = $null } }
  if ($status) {
    $errors = 0; Set-Content -LiteralPath $out -Value $raw -Encoding UTF8
    Write-Output ('{0} status={1}' -f (Get-Date -Format 'HH:mm:ss'), $status)
    if ($status -eq 'succeeded') { Write-Output "VIDEO_TASK_RESULT status=succeeded result_file=$out"; Write-Output $raw; exit 0 }
    if ($status -eq 'failed' -or $status -eq 'cancelled') { Write-Output "VIDEO_TASK_RESULT status=$status result_file=$out"; Write-Output $raw; exit 1 }
  } else {
    $errors++
    $detail = ([string](Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue) + [string]$raw) -replace '\s+', ' '
    if ($detail.Length -gt 300) { $detail = $detail.Substring($detail.Length - 300) }
    Write-Output ('{0} query_error={1} {2}' -f (Get-Date -Format 'HH:mm:ss'), $errors, $detail.Trim())
    if ($errors -ge 20) { Write-Output 'VIDEO_TASK_RESULT status=query_error'; exit 3 }
  }
  if ([DateTimeOffset]::UtcNow -ge $deadline) { Write-Output "VIDEO_TASK_RESULT status=timed_out result_file=$out"; exit 2 }
  Start-Sleep -Seconds 30
}
