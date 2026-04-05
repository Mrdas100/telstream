const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();

app.post("/api/stream/start", (req, res) => {
  const { iptvUrl, rtmpServer, streamKey, sessionId } = req.body;
  if (!iptvUrl || !streamKey) return res.status(400).json({ error: "iptvUrl و streamKey مطلوبان" });
  if (sessions.has(sessionId)) return res.status(400).json({ error: "جلسة نشطة" });

  const rtmp = `${rtmpServer || "rtmp://dc4-1.rtmp.t.me/s"}/${streamKey}`;
  console.log(`🚀 ${iptvUrl} → ${rtmp}`);

  const ff = spawn("ffmpeg", [
    "-re", "-i", iptvUrl,
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
    "-b:v", "2500k", "-maxrate", "2500k", "-bufsize", "5000k", "-g", "50",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-f", "flv", rtmp
  ]);

  const session = { ff, logs: [], startTime: Date.now(), iptvUrl, rtmp, fps: "--", bitrate: "--" };

  ff.stderr.on("data", d => {
    const line = d.toString().trim();
    const m = line.match(/fps=\s*(\S+).*bitrate=\s*(\S+)/);
    if (m) { session.fps = m[1]; session.bitrate = m[2]; }
    session.logs.push(line.slice(0, 120));
    if (session.logs.length > 30) session.logs.shift();
  });

  ff.on("close", () => sessions.delete(sessionId));
  ff.on("error", () => sessions.delete(sessionId));

  sessions.set(sessionId, session);
  res.json({ success: true });
});

app.post("/api/stream/stop", (req, res) => {
  const s = sessions.get(req.body.sessionId);
  if (!s) return res.status(404).json({ error: "غير موجود" });
  s.ff.kill("SIGTERM");
  sessions.delete(req.body.sessionId);
  res.json({ success: true });
});

app.get("/api/stream/status/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.json({ active: false });
  res.json({ active: true, elapsed: Math.floor((Date.now() - s.startTime) / 1000), fps: s.fps, bitrate: s.bitrate, logs: s.logs.slice(-5) });
});

app.listen(process.env.PORT || 3000, () => console.log(`✅ TelStream يعمل`));
