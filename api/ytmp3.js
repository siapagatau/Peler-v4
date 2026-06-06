// api/ytmp3.js

const ytdl = require("@distube/ytdl-core");
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
      console.warn("[ytmp3] cookies.json kosong atau bukan array");
      return [];
    }

    // @distube/ytdl-core expects: { name, value }[]
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

  if (formats.length === 0) return null;

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

// ── ytdl agent dengan cookies ─────────────────────────────────────────
function createAgent() {
  if (COOKIES.length === 0) return undefined;

  try {
    return ytdl.createAgent(COOKIES);
  } catch (err) {
    console.warn("[ytmp3] Gagal buat agent:", err.message);
    return undefined;
  }
}

const AGENT = createAgent();

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
    const infoOpts = AGENT ? { agent: AGENT } : {};
    const info = await ytdl.getInfo(url, infoOpts);

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
        err.message?.includes("age")          ? "Video dibatasi usia"
      : err.message?.includes("private")      ? "Video bersifat private"
      : err.message?.includes("unavailable")  ? "Video tidak tersedia"
      : err.message?.includes("bot")          ? "Bot detection — perbarui cookies.json"
      : err.message?.includes("playable")     ? "Tidak ada format — coba perbarui cookies.json"
      : "Gagal memproses video";

    return res.status(500).json({ status: false, message });
  }
};