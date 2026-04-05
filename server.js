"use strict";
const express  = require("express");
const { spawn } = require("child_process");
const cors     = require("cors");
const path     = require("path");
const crypto   = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Storage ──────────────────────────────────────────────────────
/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {Object} Session
 * @property {import("child_process").ChildProcess} ff
 * @property {string[]} logs
 * @property {number}   startTime
 * @property {string}   iptvUrl
 * @property {string}   rtmp
 * @property {string}   name
 * @property {string}   fps
 * @property {string}   bitrate
 * @property {string}   speed
 * @property {string}   status   - "starting" | "live" | "error"
 * @property {string}   error
 */

// ── Helpers ──────────────────────────────────────────────────────
function parseProgress(line) {
  const m = line.match(/fps=\s*(\S+).*?bitrate=\s*(\S+).*?speed=\s*(\S+)/);
  if (m) return { fps: m[1], bitrate: m[2], speed: m[3] };
  return null;
}

function buildFFmpegArgs(iptvUrl, rtmp, quality) {
  const presets = {
    low:    { vb: "800k",  ab: "96k",  preset: "ultrafast" },
    medium: { vb: "1500k", ab: "128k", preset: "veryfast"  },
    high:   { vb: "2500k", ab: "128k", preset: "veryfast"  },
    ultra:  { vb: "4000k", ab: "192k", preset: "fast"      },
  };
  const q = presets[quality] || presets.medium;

  return [
    "-re",
    "-loglevel", "warning",
    "-stats",
    "-i", iptvUrl,
    // Video
    "-c:v", "libx264",
    "-preset", q.preset,
    "-tune", "zerolatency",
    "-b:v", q.vb,
    "-maxrate", q.vb,
    "-bufsize", parseInt(q.vb) * 2 + "k",
    "-g", "50",
    "-pix_fmt", "yuv420p",
    // Audio
    "-c:a", "aac",
    "-b:a", q.ab,
    "-ar", "44100",
    "-ac", "2",
    // Output
    "-f", "flv",
    "-flvflags", "no_duration_filesize",
    rtmp,
  ];
}

// ── API — Start stream ────────────────────────────────────────────
app.post("/api/stream/start", (req, res) => {
  const {
    iptvUrl,
    rtmpServer = "rtmp://dc4-1.rtmp.t.me/s",
    streamKey,
    sessionId = crypto.randomUUID(),
    name      = "بث جديد",
    quality   = "medium",
  } = req.body;

  if (!iptvUrl)   return res.status(400).json({ error: "iptvUrl مطلوب" });
  if (!streamKey) return res.status(400).json({ error: "streamKey مطلوب" });
  if (sessions.has(sessionId))
    return res.status(400).json({ error: "الجلسة نشطة بالفعل", sessionId });

  const rtmp = `${rtmpServer.replace(/\/$/, "")}/${streamKey}`;
  const args  = buildFFmpegArgs(iptvUrl, rtmp, quality);

  console.log(`▶  [${sessionId}] ${iptvUrl} → ${rtmp}`);

  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });

  /** @type {Session} */
  const session = {
    ff,
    logs:      [],
    startTime: Date.now(),
    iptvUrl,
    rtmp,
    name,
    fps:       "--",
    bitrate:   "--",
    speed:     "--",
    status:    "starting",
    error:     "",
  };

  // FFmpeg writes progress to stderr
  ff.stderr.on("data", chunk => {
    const line = chunk.toString().trim();
    if (!line) return;

    const prog = parseProgress(line);
    if (prog) {
      Object.assign(session, prog);
      session.status = "live";
    }

    if (/error|failed|invalid|Connection refused/i.test(line)) {
      session.status = "error";
      session.error  = line.slice(0, 200);
    }

    session.logs.push(`[${new Date().toLocaleTimeString("ar-SA")}] ${line.slice(0, 140)}`);
    if (session.logs.length > 60) session.logs.shift();
  });

  ff.on("close", code => {
    console.log(`■  [${sessionId}] ffmpeg exited (${code})`);
    if (session.status !== "error") session.status = "stopped";
    // Keep session 30 s so client can read final status
    setTimeout(() => sessions.delete(sessionId), 30_000);
  });

  ff.on("error", err => {
    session.status = "error";
    session.error  = err.message;
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, session);
  res.json({ success: true, sessionId });
});

// ── API — Stop stream ─────────────────────────────────────────────
app.post("/api/stream/stop", (req, res) => {
  const { sessionId } = req.body;
  const s = sessions.get(sessionId);
  if (!s) return res.status(404).json({ error: "جلسة غير موجودة" });

  try { s.ff.kill("SIGTERM"); } catch (_) {}
  setTimeout(() => { try { s.ff.kill("SIGKILL"); } catch (_) {} }, 3000);

  sessions.delete(sessionId);
  console.log(`■  [${sessionId}] stopped by user`);
  res.json({ success: true });
});

// ── API — Status ──────────────────────────────────────────────────
app.get("/api/stream/status/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.json({ active: false });

  const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  res.json({
    active:   true,
    status:   s.status,
    name:     s.name,
    iptvUrl:  s.iptvUrl,
    rtmp:     s.rtmp,
    elapsed:  `${hh}:${mm}:${ss}`,
    fps:      s.fps,
    bitrate:  s.bitrate,
    speed:    s.speed,
    error:    s.error,
    logs:     s.logs.slice(-10),
  });
});

// ── API — List all sessions ───────────────────────────────────────
app.get("/api/streams", (_req, res) => {
  const list = [];
  for (const [id, s] of sessions) {
    list.push({
      sessionId: id,
      name:      s.name,
      status:    s.status,
      iptvUrl:   s.iptvUrl,
      rtmp:      s.rtmp,
      elapsed:   Math.floor((Date.now() - s.startTime) / 1000),
      fps:       s.fps,
      bitrate:   s.bitrate,
    });
  }
  res.json({ count: list.length, streams: list });
});

// ── API — Health ──────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, sessions: sessions.size, uptime: process.uptime() | 0 })
);

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  TelStream يعمل على http://localhost:${PORT}`));
