// api/ytmp3.js
// Compatible dengan playget: response shape sama dengan api.romzz.biz.id
// ─────────────────────────────────────────────────────────────────────

const ytdl = require("@distube/ytdl-core");

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

  // Urutan preferensi: mp4a (AAC) → webm (Opus) → apapun yang ada
  const mp4a = formats
    .filter((f) => f.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (mp4a) return mp4a;

  const webm = formats
    .filter((f) => f.mimeType?.includes("audio/webm"))
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

  if (webm) return webm;

  // Last resort
  return formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
}

// ── Derive clean mimetype string ──────────────────────────────────────
function cleanMime(mimeType) {
  if (!mimeType) return "audio/mp4";
  if (mimeType.includes("mp4")) return "audio/mp4";
  if (mimeType.includes("webm")) return "audio/webm";
  return "audio/mp4";
}

// ── Main handler ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { url, format = "mp3" } = req.query;

  // Validasi param
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Missing url param",
    });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({
      status: false,
      message: "URL YouTube tidak valid",
    });
  }

  try {
    // ── Ambil info video ─────────────────────────────────────
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    const det = info.videoDetails;

    // ── Metadata — shape identik dengan api.romzz ────────────
    const metadata = {
      videoId: det.videoId,
      title: det.title || "Unknown Title",
      author: det.author?.name || "Unknown",
      duration: parseInt(det.lengthSeconds) || 0,
      timestamp: toTimestamp(det.lengthSeconds), // ← dipakai playget
      thumbnail: det.thumbnails?.at(-1)?.url || null,
      url: `https://www.youtube.com/watch?v=${det.videoId}`,
    };

    // ── Pilih format audio terbaik ───────────────────────────
    const chosen = pickAudioFormat(info);

    if (!chosen || !chosen.url) {
      return res.status(500).json({
        status: false,
        message: "Tidak ada format audio tersedia",
      });
    }

    const mime = cleanMime(chosen.mimeType);
    const ext  = mime === "audio/webm" ? "webm" : "mp4";

    // ── Response — shape identik dengan api.romzz ────────────
    // dl.url langsung dipakai oleh playget untuk sock.sendMessage audio
    return res.status(200).json({
      status: true,
      result: {
        metadata,
        download: {
          url: chosen.url,                          // ← dipakai playget: dl.url
          filename: `${metadata.title}.${ext}`,
          mimetype: mime,                           // audio/mp4 atau audio/webm
          bitrate: chosen.audioBitrate || null,
          size: chosen.contentLength
            ? parseInt(chosen.contentLength)
            : null,
        },
      },
    });
  } catch (err) {
    console.error("[ytmp3]", err.message);

    // Detect error spesifik
    const isAgeRestricted = err.message?.includes("age");
    const isPrivate       = err.message?.includes("private");
    const isNotFound      = err.message?.includes("unavailable");

    const message = isAgeRestricted
      ? "Video dibatasi usia"
      : isPrivate
      ? "Video bersifat private"
      : isNotFound
      ? "Video tidak tersedia"
      : "Gagal memproses video";

    return res.status(500).json({
      status: false,
      message,
    });
  }
};