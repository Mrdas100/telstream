const { spawn } = require('child_process');

// ── الحالة الداخلية ──
let ffmpegProc     = null;
let failoverTimer  = null;
let currentIdx     = 0;
let sessionPayload = null;
let switchCount    = 0;
let streamStarted  = null;
let currentLabel   = '—';

// ══════════════════════════════════════════
// ابدأ جلسة بث جديدة
// ══════════════════════════════════════════
async function startStream(payload) {
  const { iptv, encode, destinations } = payload;

  if (!iptv || !iptv.sources || iptv.sources.length === 0) {
    throw new Error('لا توجد روابط IPTV في الطلب');
  }
  if (!destinations || destinations.length === 0) {
    throw new Error('لا توجد منصات في الطلب');
  }

  sessionPayload = payload;
  switchCount    = 0;
  streamStarted  = Date.now();

  // حدد نقطة البداية
  const activeUrl = iptv.activeUrl;
  const idx = iptv.sources.findIndex(s => s.url === activeUrl);
  currentIdx = idx !== -1 ? idx : 0;

  const src = iptv.sources[currentIdx];
  console.log(`[StreamControl] بدء البث من: ${src.label} (${src.url})`);
  console.log(`[StreamControl] عدد المنصات: ${destinations.length}`);
  console.log(`[StreamControl] روابط احتياطية: ${iptv.sources.length - 1}`);

  launchFFmpeg(src.url, src.label, encode, destinations, iptv);
  return { started: true, source: src.label };
}

// ══════════════════════════════════════════
// تشغيل FFmpeg
// ══════════════════════════════════════════
function launchFFmpeg(inputUrl, inputLabel, encode, destinations, iptvConfig) {
  // أوقف أي عملية سابقة
  if (ffmpegProc) {
    ffmpegProc.removeAllListeners();
    ffmpegProc.kill('SIGKILL');
    ffmpegProc = null;
  }

  currentLabel = inputLabel;

  // بناء RTMP outputs لكل منصة
  const outputs = destinations.map(d => {
    const url = d.rtmpUrl.endsWith('/') ? d.rtmpUrl : d.rtmpUrl + '/';
    return `${url}${d.streamKey}`;
  });

  if (outputs.length === 0) {
    console.error('[FFmpeg] لا توجد منصات للبث');
    return;
  }

  // إذا منصة وحدة → بث مباشر، أكثر من واحدة → tee muxer
  let ffArgs;
  const bitrate  = encode.bitrate || 4500;
  const fps      = encode.fps || 30;
  const gop      = fps * 2;

  const commonEncode = [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', `${bitrate}k`,
    '-maxrate', `${bitrate}k`,
    '-bufsize', `${bitrate * 2}k`,
    '-r', String(fps),
    '-g', String(gop),
    '-keyint_min', String(fps),
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
  ];

  if (outputs.length === 1) {
    ffArgs = [
      '-re',
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '-i', inputUrl,
      ...commonEncode,
      '-f', 'flv',
      outputs[0]
    ];
  } else {
    // tee muxer لبث متعدد في نفس الوقت
    const teeStr = outputs.map(u => `[f=flv]${u}`).join('|');
    ffArgs = [
      '-re',
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '-i', inputUrl,
      ...commonEncode,
      '-f', 'tee',
      '-map', '0:v?',
      '-map', '0:a?',
      teeStr
    ];
  }

  console.log(`[FFmpeg] تشغيل البث → ${inputUrl}`);
  console.log(`[FFmpeg] المنصات (${outputs.length}):`, outputs.map(u => u.split('/').slice(0,-1).join('/')));

  ffmpegProc = spawn('ffmpeg', ffArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

  // مراقبة stderr
  let stderrBuf = '';
  ffmpegProc.stderr.on('data', (data) => {
    stderrBuf += data.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop(); // احتفظ بالسطر الناقص
    lines.forEach(line => {
      if (line.includes('fps=') || line.includes('bitrate=')) {
        process.stdout.write('\r' + line.trim());
      } else if (/error|Error|failed|Failed|refused|timeout/i.test(line)) {
        console.log('\n[FFmpeg ERR]', line.trim());
      }
    });
  });

  ffmpegProc.on('close', (code, signal) => {
    console.log(`\n[FFmpeg] انتهى — كود: ${code}, إشارة: ${signal}`);
    if (signal === 'SIGKILL') return; // إيقاف متعمد
    if (code !== 0 && sessionPayload && iptvConfig.failover) {
      console.log('[Failover] انقطع الاتصال — جاري التبديل...');
      triggerFailover(encode, destinations, iptvConfig);
    }
  });

  ffmpegProc.on('error', (err) => {
    console.error('[FFmpeg] خطأ في التشغيل:', err.message);
    if (err.code === 'ENOENT') {
      console.error('[FFmpeg] ffmpeg غير مثبّت! نفّذ: apt install ffmpeg');
      return;
    }
    if (sessionPayload && iptvConfig.failover) {
      triggerFailover(encode, destinations, iptvConfig);
    }
  });
}

// ══════════════════════════════════════════
// التبديل التلقائي عند الانقطاع
// ══════════════════════════════════════════
function triggerFailover(encode, destinations, iptvConfig) {
  const sources = iptvConfig.sources;
  const delay   = (iptvConfig.failoverDelaySec || 10) * 1000;

  // البحث عن رابط تالٍ
  let nextIdx = -1;
  for (let i = 1; i <= sources.length; i++) {
    const candidate = (currentIdx + i) % sources.length;
    if (sources[candidate]) { nextIdx = candidate; break; }
  }

  if (nextIdx === -1) {
    console.log('[Failover] كل الروابط جُرِّبت — إعادة من الأول بعد 15 ثانية');
    setTimeout(() => {
      if (!sessionPayload) return;
      currentIdx = 0;
      const src = sources[0];
      launchFFmpeg(src.url, src.label, encode, destinations, iptvConfig);
    }, 15000);
    return;
  }

  switchCount++;
  currentIdx = nextIdx;
  const next = sources[nextIdx];

  console.log(`[Failover #${switchCount}] التبديل إلى: "${next.label}" بعد ${delay/1000}ث`);

  clearTimeout(failoverTimer);
  failoverTimer = setTimeout(() => {
    if (!sessionPayload) return;
    launchFFmpeg(next.url, next.label, encode, destinations, iptvConfig);
  }, delay);
}

// ══════════════════════════════════════════
// إيقاف البث
// ══════════════════════════════════════════
function stopStream() {
  clearTimeout(failoverTimer);
  failoverTimer = null;

  if (ffmpegProc) {
    ffmpegProc.removeAllListeners();
    ffmpegProc.kill('SIGKILL');
    ffmpegProc = null;
  }

  sessionPayload = null;
  currentIdx     = 0;
  currentLabel   = '—';
  console.log('[StreamControl] تم إيقاف البث بنجاح');
}

// ══════════════════════════════════════════
// حالة البث الحالية
// ══════════════════════════════════════════
function getStatus() {
  const uptime = streamStarted ? Math.floor((Date.now() - streamStarted) / 1000) : 0;
  return {
    currentSource: currentLabel,
    switchCount,
    uptimeSeconds: uptime,
    ffmpegRunning: !!ffmpegProc,
  };
}

module.exports = { startStream, stopStream, getStatus };
