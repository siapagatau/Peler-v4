// api/ytmp3.js

const ytdl = require("@distube/ytdl-core");
const fs   = require("fs");
const path = require("path");

// ── Load cookies ──────────────────────────────────────────────────────
function loadCookies() {
  try {
    const raw = process.env.YT_COOKIES
      ? process.env.YT_COOKIES
      : fs.readFileSync(path.join(process.cwd(), "cookies.txt"), "utf-8");

    const cookies = [];

    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;

      const parts = t.split("\t");
      if (parts.length < 7) continue;

      const [domain, , cookiePath_, secure, , name, value] = parts;
      cookies.push({
        domain,
        path: cookiePath_,
        secure: secure === "TRUE",
        name,
        value,
      });
    }

    console.log(`[ytmp3] Loaded ${cookies.length} cookies`);
    return cookies;
  } catch (_) {
    console.warn("[ytmp3] No cookies — bot detection may trigger");
    return [];
  }
}

const COOKIES = loadCookies();

// ── Helpers ───────────────────────────────────────────────────────────
function toTimestamp(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const s = parseInt(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function pickAudioFormat(info) {
  const formats = ytdl.filterFormats(info.formats, "audioonly");

  const mp4a = formats
    .filter((f) => f.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (mp4a) return mp4a;

  const webm = formats
    .filter((f) => f.mimeType?.includes("audio/webm"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (webm) return webm;

  return formats
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
}

function cleanMime(mimeType) {
  if (!mimeType)                  return "audio/mp4";
  if (mimeType.includes("mp4"))  return "audio/mp4";
  if (mimeType.includes("webm")) return "audio/webm";
  return "audio/mp4";
}

function getRequestOptions() {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (COOKIES.length > 0) {
    headers["Cookie"] = COOKIES.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  return { headers };
}

// ── Main handler ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.query;

  if (!url)
    return res.status(400).json({ status: false, message: "Missing url param" });

  if (!ytdl.validateURL(url))
    return res.status(400).json({ status: false, message: "URL YouTube tidak valid" });

  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: getRequestOptions(),
    });

    const det = info.videoDetails;

    const metadata = {
      videoId:   det.videoId,
      title:     det.title || "Unknown Title",
      author:    det.author?.name || "Unknown",
      duration:  parseInt(det.lengthSeconds) || 0,
      timestamp: toTimestamp(det.lengthSeconds),
      thumbnail: det.thumbnails?.at(-1)?.url || null,
      url:       `https://www.youtube.com/watch?v=${det.videoId}`,
    };

    const chosen = pickAudioFormat(info);

    if (!chosen?.url)
      return res.status(500).json({
        status: false,
        message: "Tidak ada format audio tersedia",
      });

    const mime = cleanMime(chosen.mimeType);
    const ext  = mime === "audio/webm" ? "webm" : "mp4";

    return res.status(200).json({
      status: true,
      result: {
        metadata,
        download: {
          url:      chosen.url,
          filename: `${metadata.title}.${ext}`,
          mimetype: mime,
          bitrate:  chosen.audioBitrate  || null,
          size:     chosen.contentLength ? parseInt(chosen.contentLength) : null,
        },
      },
    });

  } catch (err) {
    console.error("[ytmp3]", err.message);

    const message =
      err.message?.includes("age")         ? "Video dibatasi usia"
      : err.message?.includes("private")   ? "Video bersifat private"
      : err.message?.includes("unavailable") ? "Video tidak tersedia"
      : err.message?.includes("bot")       ? "Bot detection — perbarui cookies.txt"
      : "Gagal memproses video";

    return res.status(500).json({ status: false, message });
  }
};