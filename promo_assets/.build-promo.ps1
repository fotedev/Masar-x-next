$ErrorActionPreference = 'Stop'
$root = 'C:\programming\WEB_Development\projects\masarx_next'
$videos = Join-Path $root 'videos'
$vo = Join-Path $videos 'vo'
$tmp = Join-Path $root '.tmp\h3'
$bgm = Join-Path $root 'masarx-video-ad\audio\bgm.wav'
$out = Join-Path $videos 'masarx-promo-h23-arabic-vo.mp4'
$silent = Join-Path $videos 'masarx-promo-h23-silent.mp4'

$scenes = @(
  @{ id = 's1'; vid = Join-Path $videos 'masarx-s1-logo-reveal-h23.mp4' },
  @{ id = 's2'; vid = Join-Path $videos 'masarx-s2-h23.mp4' },
  @{ id = 's3'; vid = Join-Path $videos 'masarx-s3-h23.mp4' },
  @{ id = 's4'; vid = Join-Path $videos 'masarx-s4-h23.mp4' },
  @{ id = 's5'; vid = Join-Path $videos 'masarx-s5-h23.mp4' },
  @{ id = 's6'; vid = Join-Path $videos 'masarx-s6-h23.mp4' }
)

New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# ---- 1. scene durations ----
$durations = @{}
$total = 0.0
foreach ($s in $scenes) {
  $d = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $s.vid)
  $durations[$s.id] = $d
  $total += $d
}
"scene durations:"
foreach ($s in $scenes) { "  $($s.id) = $([math]::Round($durations[$s.id],3))s" }
"total video = $([math]::Round($total,3))s"

# ---- 2. concat the six scene clips (stream copy) ----
$vlist = Join-Path $tmp 'concat-scenes.txt'
$lines = $scenes | ForEach-Object { "file '$($_.vid -replace '\\', '/')'" }
Set-Content -LiteralPath $vlist -Value $lines -Encoding UTF8
& ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $vlist -c copy $silent
if (-not (Test-Path $silent)) { throw "silent concat failed" }
"silent concat -> $silent ($((Get-Item $silent).Length) bytes)"

# ---- 3. one VO slot per scene, fitted to the scene length ----
foreach ($s in $scenes) {
  $dur = $durations[$s.id]
  $audio = Join-Path $vo ("masarx-vo-{0}.mp3" -f $s.id)
  $slot = Join-Path $tmp ("vo-slot-{0}.wav" -f $s.id)
  $ad = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $audio)
  $target = [math]::Round($dur - 0.08, 3)
  $atempo = 1.0
  if ($ad -gt $target) { $atempo = [math]::Round($ad / $target, 4) }
  if ($atempo -gt 2.0) { throw "atempo out of range for $($s.id): $atempo" }
  $af = "atempo=$atempo"
  & ffmpeg -hide_banner -loglevel error -y -i $audio -af "$af,apad" -t $dur -ar 44100 -ac 2 -c:a pcm_s16le $slot
  "  VO slot $($s.id): raw=$([math]::Round($ad,2))s atempo=$atempo slot=$([math]::Round($dur,2))s"
}

# ---- 4. concat the VO slots into one narration track ----
$alist = Join-Path $tmp 'concat-vo.txt'
$alines = $scenes | ForEach-Object { "file '$((Join-Path $tmp ("vo-slot-{0}.wav" -f $_.id)) -replace '\\', '/')'" }
Set-Content -LiteralPath $alist -Value $alines -Encoding UTF8
$voTrack = Join-Path $tmp 'vo-track.wav'
& ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $alist -c:a pcm_s16le $voTrack
$voDur = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $voTrack)
"vo track = $([math]::Round($voDur,3))s"

# ---- 5. mix narration over the existing BGM bed, then loudness-normalise ----
# VO track measures -26.3 LUFS and the BGM bed -15.3 LUFS: lift the voice to -18 LUFS
# and drop the bed 18 dB under it, then normalise the sum to -14 LUFS / -1.5 dBTP.
$mixed = Join-Path $tmp 'audio-mix.wav'
& ffmpeg -hide_banner -loglevel error -y -i $voTrack -i $bgm -filter_complex "[0:a]volume=8dB[vo];[1:a]volume=-18dB,apad,atrim=0:$voDur[bg];[vo][bg]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[out]" -map "[out]" -c:a pcm_s16le $mixed
if (-not (Test-Path $mixed)) { throw "audio mix failed" }

# ---- 6. mux onto the concatenated promo ----
& ffmpeg -hide_banner -loglevel error -y -i $silent -i $mixed -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest $out
if (-not (Test-Path $out)) { throw "mux failed" }
"FINAL -> $out ($((Get-Item $out).Length) bytes)"
& ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height -of json $out
