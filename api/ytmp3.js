// api/ytmp3.js

const ytdl = require("ytdl-core");
const fs   = require("fs");
const path = require("path");

// ── Load cookies (JSON format) ────────────────────────────────────────
function loadCookies() {
  try {
    let raw;

    if (process.env.YT_COOKIES) {
      raw = process.env.YT_COOKIES;
    } else {
      raw = fs.readFileSync(path.join(process.cwd(), "cookies.json"), "utf-8");
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("[ytmp3] cookies kosong atau bukan array");
      return [];
    }

    const cookies = parsed
      .filter((c) => c.name && c.value !== undefined)
      .map((c) => ({ name: c.name, value: String(c.value) }));

    console.log(`[ytmp3] Loaded ${cookies.length} cookies`);
    return cookies;
  } catch (err) {
    console.warn("[ytmp3] Gagal load cookies:", err.message);
    return [];
  }
}

const COOKIES = loadCookies();

// Format cookies → Cookie header string
const COOKIE_HEADER = COOKIES.length > 0
  ? COOKIES.map((c) => `${c.name}=${c.value}`).join("; ")
  : null;

// ── Helper: seconds → m:ss ────────────────────────────────────────────
function toTimestamp(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const s = parseInt(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// ── Helper: pilih format audio terbaik ────────────────────────────────
function pickAudioFormat(info) {
  const formats = ytdl.filterFormats(info.formats, "audioonly");
  if (formats.length === 0) return null;

  const mp4a = formats
    .filter((f) => f.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (mp4a) return mp4a;

  const webm = formats
    .filter((f) => f.mimeType?.includes("audio/webm"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (webm) return webm;

  return formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
}

function cleanMime(mimeType) {
  if (!mimeType)                  return "audio/mp4";
  if (mimeType.includes("mp4"))  return "audio/mp4";
  if (mimeType.includes("webm")) return "audio/webm";
  return "audio/mp4";
}

// ── Extract video ID ──────────────────────────────────────────────────
function extractVideoId(url) {
  try {
    const parsed = new URL(decodeURIComponent(url));
    let id =
      parsed.searchParams.get("v") ||
      (parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : null);

    if (!id) return null;
    return id.split("?")[0].split("&")[0];
  } catch (_) {
    return null;
  }
}

// ── Request options ───────────────────────────────────────────────────
function getRequestOptions() {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (COOKIE_HEADER) headers["Cookie"] = COOKIE_HEADER;

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

  const videoId = extractVideoId(url);

  if (!videoId)
    return res.status(400).json({ status: false, message: "Video ID tidak ditemukan" });

  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (!ytdl.validateURL(cleanUrl))
    return res.status(400).json({ status: false, message: "URL YouTube tidak valid" });

  try {
    const info = await ytdl.getInfo(cleanUrl, {
      requestOptions: getRequestOptions(),
    });

    const det = info.videoDetails;

    const metadata = {
      videoId,
      title:     det.title                   || "Unknown Title",
      author:    det.author?.name            || "Unknown",
      duration:  parseInt(det.lengthSeconds) || 0,
      timestamp: toTimestamp(det.lengthSeconds),
      thumbnail: det.thumbnails?.at(-1)?.url
                 || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      url:       cleanUrl,
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
      : err.message?.includes("private")     ? "Video bersifat private"
      : err.message?.includes("unavailable") ? "Video tidak tersedia"
      : err.message?.includes("not found")   ? "Video tidak ditemukan"
      : err.message?.includes("bot")         ? "Bot detection — perbarui cookies"
      : err.message?.includes("playable")    ? "Tidak ada format — coba perbarui cookies"
      : "Gagal memproses video";

    return res.status(500).json({ status: false, message });
  }
};