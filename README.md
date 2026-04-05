# 📡 TelStream v2

بث IPTV مباشر إلى Telegram وأي منصة RTMP عبر FFmpeg

---

## المتطلبات

- **Node.js** 18+
- **FFmpeg** مثبّت في النظام
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - macOS:         `brew install ffmpeg`
  - Windows:       https://ffmpeg.org/download.html

---

## التشغيل

```bash
# 1. ثبّت المكتبات
npm install

# 2. شغّل الخادم
npm start

# أو في وضع التطوير (يعيد التشغيل تلقائياً)
npm run dev
```

افتح المتصفح على: **http://localhost:3000**

---

## API

| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api/stream/start`      | بدء بث جديد |
| POST | `/api/stream/stop`       | إيقاف بث |
| GET  | `/api/stream/status/:id` | حالة بث واحد |
| GET  | `/api/streams`           | كل البثوث النشطة |
| GET  | `/api/health`            | صحة الخادم |

### مثال — بدء بث

```json
POST /api/stream/start
{
  "iptvUrl":    "http://yourserver/stream.m3u8",
  "rtmpServer": "rtmp://dc4-1.rtmp.t.me/s",
  "streamKey":  "your-telegram-key",
  "name":       "قناة MBC",
  "quality":    "medium"
}
```

### جودة الترميز

| القيمة | البيترايت | الاستخدام |
|--------|-----------|-----------|
| `low`    | 800k  | إنترنت بطيء |
| `medium` | 1500k | مُوصَى (افتراضي) |
| `high`   | 2500k | جودة عالية |
| `ultra`  | 4000k | فائقة |

---

## مفتاح Telegram

1. افتح Telegram وابحث عن **@VideoMessageBot**
2. أو اذهب للقناة → الإعدادات → البث المباشر
3. انسخ مفتاح البث (Stream Key)

---

## متغيرات البيئة

```bash
PORT=3000   # المنفذ (افتراضي 3000)
```
