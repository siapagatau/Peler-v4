// api/ytmp3.js

const { Innertube } = require("youtubei.js");

// ── Helper: seconds → m:ss ────────────────────────────────────────────
function toTimestamp(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const s = parseInt(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// ── Singleton Innertube instance ──────────────────────────────────────
let _yt = null;

async function getYT() {
  if (_yt) return _yt;

  _yt = await Innertube.create({
    lang: "en",
    location: "US",
    retrieve_player: true,
  });

  return _yt;
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

  // ── Extract video ID dari URL ─────────────────────────────────────
  let videoId;
  try {
    const parsed = new URL(url);
    videoId =
      parsed.searchParams.get("v") ||
      parsed.pathname.split("/").pop();
  } catch (_) {
    return res.status(400).json({ status: false, message: "URL tidak valid" });
  }

  if (!videoId)
    return res.status(400).json({ status: false, message: "Video ID tidak ditemukan" });

  try {
    const yt   = await getYT();
    const info = await yt.getInfo(videoId);

    // ── Metadata ────────────────────────────────────────────────────
    const det = info.basic_info;

    const metadata = {
      videoId:   videoId,
      title:     det.title     || "Unknown Title",
      author:    det.author    || "Unknown",
      duration:  det.duration  || 0,
      timestamp: toTimestamp(det.duration),
      thumbnail: det.thumbnail?.at(-1)?.url
                 || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      url:       `https://www.youtube.com/watch?v=${videoId}`,
    };

    // ── Pilih format audio terbaik ───────────────────────────────────
    const streamingData = info.streaming_data;

    if (!streamingData)
      return res.status(500).json({
        status: false,
        message: "Tidak ada streaming data",
      });

    const audioFormats = [
      ...(streamingData.adaptive_formats || []),
      ...(streamingData.formats          || []),
    ].filter((f) => f.has_audio && !f.has_video);

    if (audioFormats.length === 0)
      return res.status(500).json({
        status: false,
        message: "Tidak ada format audio tersedia",
      });

    // Prioritas: mp4a bitrate tinggi → webm
    const mp4a = audioFormats
      .filter((f) => f.mime_type?.includes("audio/mp4"))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    const webm = audioFormats
      .filter((f) => f.mime_type?.includes("audio/webm"))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    const chosen = mp4a || webm || audioFormats[0];

    if (!chosen?.decipher)
      return res.status(500).json({
        status: false,
        message: "Format audio tidak bisa di-decipher",
      });

    // Dapatkan URL yang sudah di-decipher
    const audioUrl = chosen.decipher(yt.session.player);

    if (!audioUrl)
      return res.status(500).json({
        status: false,
        message: "Gagal mendapatkan audio URL",
      });

    const mime = chosen.mime_type?.includes("mp4")  ? "audio/mp4"
               : chosen.mime_type?.includes("webm") ? "audio/webm"
               : "audio/mp4";

    const ext = mime === "audio/webm" ? "webm" : "mp4";

    return res.status(200).json({
      status: true,
      result: {
        metadata,
        download: {
          url:      audioUrl,
          filename: `${metadata.title}.${ext}`,
          mimetype: mime,
          bitrate:  chosen.bitrate         || null,
          size:     chosen.content_length  ? parseInt(chosen.content_length) : null,
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
      : "Gagal memproses video";

    return res.status(500).json({ status: false, message });
  }
};