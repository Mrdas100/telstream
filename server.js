const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map();

const HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>TelStream IPTV</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap');
:root{--bg:#08090f;--s1:#0f1018;--s2:#161720;--bd:rgba(255,255,255,0.07);--acc:#2AABEE;--red:#e74c3c;--grn:#27ae60;--txt:#eef0f8;--dim:#7a7d9c;--font:'IBM Plex Sans Arabic',sans-serif}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--txt);font-family:var(--font);min-height:100svh;display:flex;flex-direction:column}
.hdr{padding:14px 18px;background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:600}
.brand-icon{width:34px;height:34px;background:var(--acc);border-radius:9px;display:flex;align-items:center;justify-content:center}
.brand-icon svg{width:19px;height:19px;fill:white}
.badge{display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:500;background:var(--s2);border:1px solid var(--bd);transition:.3s}
.dot{width:7px;height:7px;border-radius:50%;background:var(--dim);transition:.3s}
.badge.live{border-color:rgba(231,76,60,.35);background:rgba(231,76,60,.1);color:#ff6b6b}
.badge.live .dot{background:var(--red);animation:pulse 1.2s infinite}
.badge.reconnect{border-color:rgba(255,165,0,.35);background:rgba(255,165,0,.1);color:orange}
.badge.reconnect .dot{background:orange;animation:pulse 1.2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
.main{flex:1;padding:18px;display:flex;flex-direction:column;gap:15px;overflow-y:auto}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px}
.card-title{font-size:11px;font-weight:500;letter-spacing:.8px;color:var(--dim);text-transform:uppercase;margin-bottom:12px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.field:last-child{margin-bottom:0}
.field label{font-size:12px;color:var(--dim)}
.field input{background:var(--s2);border:1px solid var(--bd);border-radius:9px;padding:11px 13px;color:var(--txt);font-family:var(--font);font-size:14px;outline:none;transition:border-color .2s;direction:ltr;text-align:right;width:100%}
.field input:focus{border-color:var(--acc)}
.field input::placeholder{color:var(--dim);opacity:.5}
.tip{font-size:11.5px;color:var(--dim);background:rgba(42,171,238,.06);border:1px solid rgba(42,171,238,.15);border-radius:9px;padding:10px 12px;line-height:1.7}
.tip strong{color:var(--acc);font-weight:500}
.presets{display:flex;flex-direction:column;gap:6px}
.preset{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:10px;border:1px solid var(--bd);background:var(--s2);cursor:pointer;transition:.2s;text-align:right}
.preset:hover,.preset.sel{border-color:var(--acc);background:rgba(42,171,238,.07)}
.preset-icon{width:32px;height:32px;border-radius:8px;background:var(--acc);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.preset-icon svg{width:17px;height:17px;fill:white}
.preset-name{font-size:13px;font-weight:500}
.preset-url{font-size:10px;color:var(--dim);direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.qrow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.qbtn{padding:10px;border-radius:9px;border:1px solid var(--bd);background:var(--s2);color:var(--dim);font-family:var(--font);font-size:12px;font-weight:500;cursor:pointer;text-align:center;transition:.2s}
.qbtn.sel{border-color:var(--acc);background:rgba(42,171,238,.1);color:var(--acc)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.stat{background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:10px 8px;text-align:center}
.stat-v{font-size:17px;font-weight:600;color:var(--acc);font-variant-numeric:tabular-nums}
.stat-l{font-size:10px;color:var(--dim);margin-top:2px}
.log{background:var(--s2);border:1px solid var(--bd);border-radius:9px;padding:10px 12px;font-size:10.5px;color:var(--dim);max-height:100px;overflow-y:auto;direction:ltr;text-align:left;font-family:monospace;scrollbar-width:thin;margin-top:10px}
.log p{padding:1px 0}
.log .ok{color:var(--grn)}.log .err{color:var(--red)}.log .info{color:var(--acc)}.log .warn{color:orange}
.footer{padding:14px 18px;background:var(--s1);border-top:1px solid var(--bd)}
.btn-go{width:100%;padding:15px;border-radius:13px;border:none;background:var(--acc);color:white;font-family:var(--font);font-size:16px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s}
.btn-go:active{transform:scale(.98)}
.btn-go.stop{background:var(--red)}
.btn-go svg{width:18px;height:18px;fill:white}
.timer{font-size:13px;color:var(--dim);text-align:center;margin-top:8px;font-variant-numeric:tabular-nums;min-height:18px}
</style>
</head>
<body>
<div class="hdr">
  <div class="brand">
    <div class="brand-icon"><svg viewBox="0 0 24 24"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg></div>
    TelStream
  </div>
  <div class="badge" id="badge"><span class="dot"></span><span id="badgeTxt">غير نشط</span></div>
</div>
<div class="main">

  <div class="card">
    <div class="card-title">روابط تجريبية</div>
    <div class="presets">
      <div class="preset" onclick="setPreset(this,'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')">
        <div class="preset-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        <div><div class="preset-name">MUX Test Stream</div><div class="preset-url">test-streams.mux.dev</div></div>
      </div>
      <div class="preset" onclick="setPreset(this,'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8')">
        <div class="preset-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        <div><div class="preset-name">Akamai Test Live</div><div class="preset-url">akamaized.net</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">رابط البث</div>
    <div class="field">
      <label>رابط IPTV</label>
      <input type="url" id="iptvUrl" placeholder="http://... او https://... او rtsp://...">
    </div>
    <div class="tip">
      يدعم: <strong>Xtream Codes</strong> · <strong>m3u8</strong> · <strong>RTSP</strong> · <strong>TS</strong><br>
      روابط Xtream بدون امتداد تُضاف اليها .ts تلقائياً
    </div>
  </div>

  <div class="card">
    <div class="card-title">جودة البث</div>
    <div class="qrow">
      <button class="qbtn" onclick="setQ(this,'1280','720','2500k')">720p — 2.5 Mbps</button>
      <button class="qbtn sel" onclick="setQ(this,'854','480','1000k')">480p — 1 Mbps</button>
      <button class="qbtn" onclick="setQ(this,'1920','1080','4500k')">1080p — 4.5 Mbps</button>
      <button class="qbtn" onclick="setQ(this,'640','360','600k')">360p — 0.6 Mbps</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">اعدادات تيليجرام</div>
    <div class="field">
      <label>سيرفر RTMP</label>
      <input type="text" id="rtmpServer" value="rtmp://dc4-1.rtmp.t.me/s">
    </div>
    <div class="field">
      <label>مفتاح البث (Stream Key)</label>
      <input type="password" id="streamKey" placeholder="من تيليجرام - بث مباشر - تطبيق خارجي">
    </div>
    <div class="tip">في تيليجرام: القناة - <strong>بث مباشر</strong> - <strong>تطبيق خارجي</strong> - انسخ المفتاح</div>
  </div>

  <div class="card" id="statsCard" style="display:none">
    <div class="card-title">احصائيات البث</div>
    <div class="stats">
      <div class="stat"><div class="stat-v" id="sFps">--</div><div class="stat-l">FPS</div></div>
      <div class="stat"><div class="stat-v" id="sBitrate">--</div><div class="stat-l">Kbps</div></div>
      <div class="stat"><div class="stat-v" id="sTime">00:00</div><div class="stat-l">مدة البث</div></div>
    </div>
    <div class="log" id="logBox"><p class="info">في انتظار FFmpeg...</p></div>
  </div>

</div>
<div class="footer">
  <button class="btn-go" id="btnGo" onclick="toggle()">
    <svg viewBox="0 0 24 24"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
    ابدأ البث الى تيليجرام
  </button>
  <div class="timer" id="timerTxt"></div>
</div>
<script>
const SERVER=window.location.origin;
let active=false,sessionId=null,pollInterval=null;
let qW='854',qH='480',qB='1000k';
function setPreset(el,url){document.getElementById('iptvUrl').value=url;document.querySelectorAll('.preset').forEach(p=>p.classList.remove('sel'));el.classList.add('sel');}
function setQ(el,w,h,b){qW=w;qH=h;qB=b;document.querySelectorAll('.qbtn').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');}
function log(msg,cls){const box=document.getElementById('logBox');const p=document.createElement('p');p.className=cls||'';p.textContent='> '+msg;box.appendChild(p);box.scrollTop=box.scrollHeight;if(box.children.length>40)box.removeChild(box.children[0]);}
function fmtTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?[h,m,sec].map(x=>String(x).padStart(2,'0')).join(':'):[m,sec].map(x=>String(x).padStart(2,'0')).join(':');}
async function toggle(){active?await stopStream():await startStream();}
async function startStream(){
  const iptvUrl=document.getElementById('iptvUrl').value.trim();
  const rtmpServer=document.getElementById('rtmpServer').value.trim();
  const streamKey=document.getElementById('streamKey').value.trim();
  if(!iptvUrl)return alert('ادخل رابط IPTV');
  if(!streamKey)return alert('ادخل مفتاح البث');
  sessionId='sess_'+Date.now();
  try{
    const r=await fetch(SERVER+'/api/stream/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({iptvUrl,rtmpServer,streamKey,sessionId,width:qW,height:qH,bitrate:qB})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error);
    active=true;
    document.getElementById('statsCard').style.display='block';
    document.getElementById('logBox').innerHTML='';
    log('تم ارسال الامر للسيرفر...','info');
    document.getElementById('btnGo').className='btn-go stop';
    document.getElementById('btnGo').innerHTML='<svg viewBox="0 0 24 24" style="fill:white;width:18px;height:18px"><rect x="6" y="6" width="12" height="12"/></svg> ايقاف البث';
    document.getElementById('badge').className='badge live';
    document.getElementById('badgeTxt').textContent='بث مباشر';
    pollInterval=setInterval(pollStatus,3000);
  }catch(e){alert('خطأ: '+e.message);}
}
async function stopStream(){
  clearInterval(pollInterval);
  try{await fetch(SERVER+'/api/stream/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})});}catch(_){}
  active=false;
  document.getElementById('badge').className='badge';
  document.getElementById('badgeTxt').textContent='غير نشط';
  document.getElementById('timerTxt').textContent='';
  document.getElementById('btnGo').className='btn-go';
  document.getElementById('btnGo').innerHTML='<svg viewBox="0 0 24 24" style="fill:white;width:18px;height:18px"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg> ابدأ البث الى تيليجرام';
  log('تم ايقاف البث','err');
}
async function pollStatus(){
  if(!sessionId)return;
  try{
    const r=await fetch(SERVER+'/api/stream/status/'+sessionId);
    const d=await r.json();
    if(!d.active){
      if(active){document.getElementById('badge').className='badge reconnect';document.getElementById('badgeTxt').textContent='اعادة اتصال...';}
      return;
    }
    document.getElementById('badge').className='badge live';
    document.getElementById('badgeTxt').textContent='بث مباشر';
    document.getElementById('sFps').textContent=d.fps||'--';
    document.getElementById('sBitrate').textContent=d.bitrate?d.bitrate.replace('kbits/s','').trim():'--';
    document.getElementById('sTime').textContent=fmtTime(d.elapsed||0);
    document.getElementById('timerTxt').textContent='مدة البث: '+fmtTime(d.elapsed||0);
    if(d.hasVideo)log('الفيديو يعمل','ok');
  }catch(_){}
}
</script>
</body>
</html>`;

app.get("/", (req, res) => res.send(HTML));

// ===== كشف نوع الرابط وإصلاحه =====
function detectFormat(url) {
  // HLS
  if (url.includes(".m3u8")) return { fmt: "hls", finalUrl: url };
  // TS صريح
  if (url.includes(".ts"))   return { fmt: "mpegts", finalUrl: url };
  // RTSP
  if (url.startsWith("rtsp://")) return { fmt: "rtsp", finalUrl: url };
  // RTMP
  if (url.startsWith("rtmp://")) return { fmt: "rtmp", finalUrl: url };
  // MP4
  if (url.includes(".mp4"))  return { fmt: "mp4", finalUrl: url };

  // Xtream Codes — رقم/رقم/رقم بدون امتداد → أضف .ts
  if (/\/\d+\/\d+\/\d+$/.test(url)) {
    const finalUrl = url + ".ts";
    console.log("🔧 Xtream detected → " + finalUrl);
    return { fmt: "mpegts", finalUrl };
  }

  // أي رابط HTTP آخر مجهول → جرب mpegts
  return { fmt: "mpegts", finalUrl: url };
}

// ===== تشغيل FFmpeg =====
function startFFmpeg(session, iptvUrl, rtmp, width, height, bitrate) {
  const { fmt, finalUrl } = detectFormat(iptvUrl);
  const isRtsp = fmt === "rtsp";
  const isRtmp = fmt === "rtmp";

  console.log(`🔍 نوع: ${fmt} | ${finalUrl}`);

  const args = [
    // User-Agent لتجاوز الحماية
    ...((!isRtsp && !isRtmp) ? ["-user_agent", "VLC/3.0.18 LibVLC/3.0.18"] : []),

    // إعادة الاتصال
    ...(!isRtsp ? ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"] : []),

    // وقت تحليل كافٍ
    "-analyzeduration", "20000000",
    "-probesize",       "20000000",

    // إجبار نوع الإدخال لـ mpegts
    ...(fmt === "mpegts" ? ["-f", "mpegts"] : []),

    // الرابط النهائي (مع .ts إذا كان Xtream)
    "-i", finalUrl,

    // إصلاح التواريخ
    "-fflags",    "+genpts+igndts",
    "-err_detect","ignore_err",

    // أخذ أول تراك فيديو وصوت
    "-map", "0:v:0",
    "-map", "0:a:0",

    // فيديو
    "-c:v",      "libx264",
    "-preset",   "veryfast",
    "-tune",     "zerolatency",
    "-b:v",      bitrate || "2500k",
    "-maxrate",  bitrate || "2500k",
    "-bufsize",  "6000k",
    "-vf",       `scale=${width||1280}:${height||720}:force_original_aspect_ratio=decrease,pad=${width||1280}:${height||720}:(ow-iw)/2:(oh-ih)/2`,
    "-g",        "60",
    "-keyint_min","60",
    "-sc_threshold","0",
    "-pix_fmt",  "yuv420p",

    // صوت
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar",  "44100",
    "-ac",  "2",

    // إخراج
    "-f",        "flv",
    "-flvflags", "no_duration_filesize",
    rtmp
  ];

  console.log("🚀 FFmpeg:", args.join(" ").slice(0, 300));
  const ff = spawn("ffmpeg", args);
  session.ff = ff;

  ff.stderr.on("data", d => {
    const line = d.toString().trim();
    const m = line.match(/fps=\s*(\S+).*bitrate=\s*(\S+)/);
    if (m) { session.fps = m[1]; session.bitrate = m[2]; session.hasVideo = true; }
    session.logs.push(line.slice(0, 150));
    if (session.logs.length > 50) session.logs.shift();
  });

  ff.on("close", code => {
    console.log(`FFmpeg انتهى (كود ${code}) | محاولة ${session.retries}`);
    session.hasVideo = false;

    if (session.active && session.retries < 10) {
      session.retries++;
      const delay = Math.min(session.retries * 3, 15) * 1000;
      console.log(`🔄 إعادة المحاولة ${session.retries} بعد ${delay/1000}s`);
      session.logs.push(`--- اعادة محاولة ${session.retries} بعد ${delay/1000}s ---`);
      setTimeout(() => {
        if (session.active) startFFmpeg(session, iptvUrl, rtmp, width, height, bitrate);
      }, delay);
    } else if (session.retries >= 10) {
      session.active = false;
      session.logs.push("--- فشل البث بعد 10 محاولات ---");
    }
  });

  ff.on("error", err => {
    console.error("FFmpeg خطأ:", err.message);
    session.logs.push("[خطأ: " + err.message + "]");
  });
}

// ===== API =====
app.post("/api/stream/start", (req, res) => {
  const { iptvUrl, rtmpServer, streamKey, sessionId, width, height, bitrate } = req.body;
  if (!iptvUrl || !streamKey)
    return res.status(400).json({ error: "iptvUrl و streamKey مطلوبان" });
  if (sessions.has(sessionId))
    return res.status(400).json({ error: "جلسة نشطة بالفعل" });

  const rtmp = `${rtmpServer || "rtmp://dc4-1.rtmp.t.me/s"}/${streamKey}`;
  const session = {
    logs: [], startTime: Date.now(),
    fps: "--", bitrate: "--",
    hasVideo: false, active: true, retries: 0, ff: null
  };

  sessions.set(sessionId, session);
  startFFmpeg(session, iptvUrl, rtmp, width, height, bitrate);
  res.json({ success: true });
});

app.post("/api/stream/stop", (req, res) => {
  const s = sessions.get(req.body.sessionId);
  if (!s) return res.status(404).json({ error: "غير موجود" });
  s.active = false;
  if (s.ff) s.ff.kill("SIGTERM");
  sessions.delete(req.body.sessionId);
  console.log("⏹️ تم الإيقاف");
  res.json({ success: true });
});

app.get("/api/stream/status/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s || !s.active) return res.json({ active: false });
  res.json({
    active:   true,
    elapsed:  Math.floor((Date.now() - s.startTime) / 1000),
    fps:      s.fps,
    bitrate:  s.bitrate,
    hasVideo: s.hasVideo,
    retries:  s.retries,
    logs:     s.logs.slice(-5)
  });
});

app.listen(process.env.PORT || 3000, () => console.log("✅ TelStream يعمل"));
