const express = require('express');
const cors = require('cors');
const path = require('path');
const { startStream, stopStream, getStatus } = require('./stream-manager');

const app = express();
app.use(cors());
app.use(express.json());

// ── تخديم الداشبورد من مجلد public ──
app.use(express.static(path.join(__dirname, 'public')));

let currentSession = null;

// ── ابدأ البث ──
app.post('/start', async (req, res) => {
  try {
    if (currentSession) {
      stopStream();
      currentSession = null;
    }
    currentSession = await startStream(req.body);
    res.json({ ok: true, message: 'البث بدأ بنجاح' });
  } catch (e) {
    console.error('[API] خطأ في /start:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── أوقف البث ──
app.post('/stop', (req, res) => {
  try {
    stopStream();
    currentSession = null;
    res.json({ ok: true, message: 'تم إيقاف البث' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── حالة البث ──
app.get('/status', (req, res) => {
  res.json({
    streaming: !!currentSession,
    ...getStatus()
  });
});

// ── تحقق أن السيرفر شغّال ──
app.get('/ping', (req, res) => {
  res.json({ ok: true, service: 'StreamControl API', version: '2.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[StreamControl] يعمل على: http://49.12.200.121:${PORT}`);
  console.log(`[StreamControl] الداشبورد: http://49.12.200.121:${PORT}`);
});
