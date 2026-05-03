const {
  RankCardBuilder,
  Font,
  Builder,
  JSX,
  loadImage,
  LeaderboardBuilder,
} = require("canvacord");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const axios = require("axios");
const { PassThrough } = require("stream");
const path = require("path");
const fs = require("fs");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegPath);
Font.loadDefault();

// ---------- Custom Greetings Card ----------
class GreetingsCard extends Builder {
  constructor() {
    super(930, 280);
    this.bootstrap({
      displayName: "",
      type: "welcome",
      avatar: "",
      message: "",
    });
  }
  setDisplayName(value) { this.options.set("displayName", value); return this; }
  setType(value)        { this.options.set("type", value);        return this; }
  setAvatar(value)      { this.options.set("avatar", value);      return this; }
  setMessage(value)     { this.options.set("message", value);     return this; }

  async render() {
    const { type, displayName, avatar, message } = this.options.getOptions();
    const image = await loadImage(avatar || "https://cdn.discordapp.com/embed/avatars/0.png");
    return JSX.createElement(
      "div",
      { className: "h-full w-full flex flex-col items-center justify-center bg-[#23272A] rounded-xl" },
      JSX.createElement(
        "div",
        { className: "px-6 bg-[#2B2F35AA] w-[96%] h-[84%] rounded-lg flex items-center" },
        JSX.createElement("img", { src: image.toDataURL(), className: "flex h-24 w-24 rounded-full mr-6" }),
        JSX.createElement(
          "div",
          { className: "flex flex-col" },
          JSX.createElement(
            "h1",
            { className: "text-5xl text-white font-bold m-0" },
            type === "welcome" ? "Welcome" : "Goodbye", ", ",
            JSX.createElement("span", { className: "text-blue-500" }, displayName || "User", "!")
          ),
          JSX.createElement(
            "p",
            { className: "text-gray-300 text-3xl m-0 mt-2" },
            message || (type === "welcome" ? "Thanks for joining!" : "See you later!")
          )
        )
      )
    );
  }
}

// ---------- Profile Card ----------
class ProfileCard extends Builder {
  constructor() {
    super(960, 540);
    this.bootstrap({
      name: "",
      username: "",
      bio: "",
      avatar: "",
      background: "",
      statLabel1: "Pesan",
      statValue1: "0",
      statLabel2: "Level",
      statValue2: "1",
      statLabel3: "Poin",
      statValue3: "0",
      accent: "6366f1",
      badge: "",
    });
  }

  setName(v)        { this.options.set("name", v);        return this; }
  setUsername(v)    { this.options.set("username", v);    return this; }
  setBio(v)         { this.options.set("bio", v);         return this; }
  setAvatar(v)      { this.options.set("avatar", v);      return this; }
  setBackground(v)  { this.options.set("background", v);  return this; }
  setStatLabel1(v)  { this.options.set("statLabel1", v);  return this; }
  setStatValue1(v)  { this.options.set("statValue1", v);  return this; }
  setStatLabel2(v)  { this.options.set("statLabel2", v);  return this; }
  setStatValue2(v)  { this.options.set("statValue2", v);  return this; }
  setStatLabel3(v)  { this.options.set("statLabel3", v);  return this; }
  setStatValue3(v)  { this.options.set("statValue3", v);  return this; }
  setAccent(v)      { this.options.set("accent", v);      return this; }
  setBadge(v)       { this.options.set("badge", v);       return this; }

  async render() {
    const {
      name, username, bio, avatar, background,
      statLabel1, statValue1,
      statLabel2, statValue2,
      statLabel3, statValue3,
      accent, badge,
    } = this.options.getOptions();

    const avatarImg = await loadImage(
      avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
    );

    const accentColor = `#${accent || "6366f1"}`;

    return JSX.createElement(
      "div",
      { className: "relative w-full h-full overflow-hidden" },

      // Background image or gradient fallback
      background
        ? JSX.createElement("img", {
            src: background,
            className: "absolute inset-0 w-full h-full",
            style: { objectFit: "cover", objectPosition: "center" },
          })
        : JSX.createElement("div", {
            className: "absolute inset-0 w-full h-full",
            style: {
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            },
          }),

      // Gradient overlay (darken bottom for readability)
      JSX.createElement("div", {
        className: "absolute inset-0 w-full h-full",
        style: {
          background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.70) 100%)",
        },
      }),

      // Accent left stripe
      JSX.createElement("div", {
        className: "absolute left-0 top-0 h-full",
        style: {
          width: "5px",
          background: `linear-gradient(to bottom, ${accentColor}, transparent)`,
        },
      }),

      // Glass panel bottom
      JSX.createElement("div", {
        className: "absolute bottom-0 left-0 w-full",
        style: {
          height: "240px",
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "2px solid rgba(255,255,255,0.18)",
          borderRadius: "28px 28px 0 0",
        },
      }),

      // Avatar ring + image
      JSX.createElement(
        "div",
        {
          className: "absolute",
          style: { left: "52px", bottom: "172px", width: "140px", height: "140px" },
        },
        JSX.createElement("div", {
          style: {
            position: "absolute",
            inset: "-4px",
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.1), ${accentColor})`,
          },
        }),
        JSX.createElement("img", {
          src: avatarImg.toDataURL(),
          style: {
            position: "absolute",
            inset: "4px",
            borderRadius: "50%",
            width: "calc(100% - 8px)",
            height: "calc(100% - 8px)",
            objectFit: "cover",
            objectPosition: "center",
          },
        })
      ),

      // Badge
      badge
        ? JSX.createElement(
            "div",
            {
              className: "absolute",
              style: {
                left: "52px",
                bottom: "158px",
                background: accentColor,
                color: "#fff",
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 10px",
                borderRadius: "99px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              },
            },
            badge
          )
        : null,

      // Name, username, bio
      JSX.createElement(
        "div",
        {
          className: "absolute",
          style: { left: "212px", bottom: "105px", right: "36px" },
        },
        JSX.createElement(
          "div",
          {
            style: {
              fontSize: "30px",
              fontWeight: "800",
              color: "#ffffff",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              lineHeight: "1.1",
              letterSpacing: "-0.5px",
            },
          },
          name || "Nama Pengguna"
        ),
        JSX.createElement(
          "div",
          {
            style: {
              fontSize: "15px",
              color: accentColor,
              fontWeight: "600",
              marginTop: "4px",
              letterSpacing: "0.02em",
            },
          },
          username ? `@${username}` : ""
        ),
        bio
          ? JSX.createElement(
              "div",
              {
                style: {
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.70)",
                  marginTop: "6px",
                  lineHeight: "1.45",
                },
              },
              bio
            )
          : null
      ),

      // Stats row
      JSX.createElement(
        "div",
        {
          className: "absolute",
          style: {
            left: "52px",
            right: "52px",
            bottom: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: "14px",
          },
        },
        _statBlock(statValue1, statLabel1),
        _divider(),
        _statBlock(statValue2, statLabel2),
        _divider(),
        _statBlock(statValue3, statLabel3)
      )
    );
  }
}

function _statBlock(value, label) {
  return JSX.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        flex: "1",
      },
    },
    JSX.createElement(
      "span",
      {
        style: {
          fontSize: "22px",
          fontWeight: "800",
          color: "#ffffff",
          letterSpacing: "-0.5px",
        },
      },
      value || "0"
    ),
    JSX.createElement(
      "span",
      {
        style: {
          fontSize: "11px",
          color: "rgba(255,255,255,0.55)",
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        },
      },
      label || ""
    )
  );
}

function _divider() {
  return JSX.createElement("div", {
    style: {
      width: "1px",
      height: "40px",
      background: "rgba(255,255,255,0.15)",
    },
  });
}

// ---------- Helpers ----------
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Jalankan satu kali konversi WebP animated dengan opsi tertentu.
 * @param {Stream} inputStream
 * @param {object} opts
 * @param {number} opts.quality - 0–100
 * @param {number} opts.fps     - frame per second (0 = ikuti asli)
 * @param {number} opts.width   - lebar output px (0 = gunakan 512x512 default)
 * @returns {Promise<Buffer>}
 */
function _runConvertToWebP(inputBuffer, { quality, fps = 0, width = 0 }) {
  // Tulis buffer ke tmp file agar FFmpeg bisa baca WebP animated dengan benar
  const tmpIn  = path.join(os.tmpdir(), `conv_in_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
  const tmpOut = path.join(os.tmpdir(), `conv_out_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`);
  fs.writeFileSync(tmpIn, inputBuffer);

  const filters = [];
  if (fps > 0)   filters.push(`fps=${fps}`);
  if (width > 0) filters.push(`scale=${width}:-2:flags=lanczos`);
  else           filters.push("scale=512:512");

  return new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .inputOptions(["-analyzeduration 10M", "-probesize 10M"])
      .videoFilter(filters.join(","))
      .outputOptions([
        "-c:v libwebp_anim",
        `-quality ${quality}`,
        "-loop 0",
        "-vsync 0",
        "-g 1",
        "-pix_fmt yuv420p",
        "-an",
      ])
      .format("webp")
      .on("error", (err) => {
        fs.rmSync(tmpIn,  { force: true });
        fs.rmSync(tmpOut, { force: true });
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .on("end", () => {
        try {
          const buf = fs.readFileSync(tmpOut);
          resolve(buf);
        } catch (e) {
          reject(new Error(`Gagal baca output tmp: ${e.message}`));
        } finally {
          fs.rmSync(tmpIn,  { force: true });
          fs.rmSync(tmpOut, { force: true });
        }
      })
      .save(tmpOut);
  });
}

/**
 * Konversi URL → animated WebP, auto-kecilkan jika hasil > maxSize (default 1MB).
 *
 * Urutan strategi (ringan → agresif):
 *   Tahap 1 – turunkan FPS saja : 0 (asli) → 24 → 20 → 15 → 12 → 10 → 8 → 6 → 5 → 3 → 2 → 1
 *
 * Loop berhenti segera saat buffer ≤ maxSize.
 * Jika FFmpeg gagal atau semua opsi habis → kembalikan buffer ASLI (tidak dikonversi).
 *
 * @param {string} url
 * @param {number} quality  - kualitas awal (0–100), default 80
 * @param {number} maxSize  - batas bytes, default 1 MB
 * @returns {Promise<{ buffer: Buffer, contentType: string, isOriginal: boolean }>}
 */
async function convertToWebP(url, quality = 80, maxSize = 1 * 1024 * 1024) {
  // Download buffer asli SEKALI sebagai sumber + fallback
  const originalResponse = await axios({ method: "GET", url, responseType: "arraybuffer" });
  const originalBuffer   = Buffer.from(originalResponse.data);
  const originalType     = originalResponse.headers["content-type"] || "application/octet-stream";

  console.log(`[convert] Original: ${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB type=${originalType}`);

  // Coba dari fps asli (0), lalu turunkan bertahap sampai muat
  for (const fps of [0, 24, 20, 15, 12, 10, 8, 6, 5, 3, 2, 1]) {
    try {
      const buf = await _runConvertToWebP(originalBuffer, { quality, fps, width: 0 });
      const mb  = (buf.length / 1024 / 1024).toFixed(2);
      console.log(`[convert] q=${quality} fps=${fps} → ${mb}MB`);
      if (buf.length > 0 && buf.length <= maxSize)
        return { buffer: buf, contentType: "image/webp", isOriginal: false };
      if (buf.length === 0) {
        console.warn(`[convert] FFmpeg output kosong fps=${fps} → fallback ke buffer asli`);
        return { buffer: originalBuffer, contentType: originalType, isOriginal: true };
      }
    } catch (err) {
      console.warn(`[convert] FFmpeg gagal fps=${fps}: ${err.message} → fallback ke buffer asli`);
      return { buffer: originalBuffer, contentType: originalType, isOriginal: true };
    }
  }

  // Semua opsi habis → kembalikan buffer asli tanpa konversi
  console.warn(
    `[convert] ⚠️ Semua opsi fps habis, mengembalikan buffer asli.` +
    ` Ukuran asli: ${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB` +
    ` (limit: ${(maxSize / 1024 / 1024).toFixed(2)}MB)`
  );
  return { buffer: originalBuffer, contentType: originalType, isOriginal: true };
}

/**
 * Kompres gambar ke JPEG/WebP max 100KB tanpa stretch.
 * Aspect ratio dipertahankan, resolusi diturunkan jika perlu.
 * @param {string} url     - URL gambar
 * @param {number} maxSize - Batas ukuran dalam bytes (default: 100KB)
 * @returns {Promise<Buffer>}
 */
async function compressImage(url, maxSize = 100 * 1024) {
  const response = await axios({ method: "GET", url, responseType: "stream" });

  // Tahap 1: coba quality tinggi dulu, turunkan bertahap sampai muat
  const qualities = [80, 65, 50, 35, 20];

  for (const quality of qualities) {
    const result = await _runCompress(response.data.pipe(new PassThrough()), quality);
    if (result.length <= maxSize) return result;

    // response.data sudah dipakai, harus fetch ulang untuk iterasi berikutnya
    if (quality !== qualities[qualities.length - 1]) {
      const retry = await axios({ method: "GET", url, responseType: "stream" });
      response.data = retry.data;
    }
  }

  // Tahap 2: jika masih > maxSize setelah quality terkecil,
  // turunkan resolusi (scale down) sambil tetap jaga aspect ratio
  const scales = [0.75, 0.5, 0.35, 0.25];
  for (const scale of scales) {
    const retry = await axios({ method: "GET", url, responseType: "stream" });
    const result = await _runCompress(retry.data, 20, scale);
    if (result.length <= maxSize) return result;
  }

  // Kembalikan hasil terkecil yang bisa dihasilkan (scale 0.25 + quality 20)
  const last = await axios({ method: "GET", url, responseType: "stream" });
  return _runCompress(last.data, 20, 0.25);
}

/**
 * Internal: jalankan satu kali ffmpeg compress
 * @param {Stream} inputStream
 * @param {number} quality   - 0-100
 * @param {number|null} scale - misal 0.5 = setengah resolusi asli, null = tidak resize
 */
function _runCompress(inputStream, quality, scale = null) {
  const outputStream = new PassThrough();
  const chunks = [];

  // scale=iw*{scale}:ih*{scale} → proportional, tidak stretch
  const scaleFilter = scale
    ? `scale=iw*${scale}:ih*${scale}:flags=lanczos`
    : "scale=iw:ih:flags=lanczos"; // no-op tapi tetap jaga pixel format

  return new Promise((resolve, reject) => {
    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .inputOptions(["-analyzeduration 10M", "-probesize 10M"])
      .videoFilter(scaleFilter)
      .outputOptions([
        "-c:v libwebp",   // WebP lebih efisien dari JPEG untuk ukuran kecil
        `-quality ${quality}`,
        "-loop 0",
        "-preset picture",
        "-an",
        "-vframes 1",     // ambil 1 frame saja (untuk GIF/video → ambil frame pertama)
      ])
      .format("webp")
      .on("error", (err) => reject(new Error(`FFmpeg compress error: ${err.message}`)))
      .pipe(outputStream, { end: true });
  });
}

// ---------- Handler Utama ----------
module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const { type } = req.query;

  // --- CONVERT ---
  if (type === "convert") {
    if (req.method !== "GET")
      return res.status(405).json({ error: "Convert hanya mendukung metode GET." });

    const { url, quality, maxsize } = req.query;
    if (!url) return res.status(400).json({ error: "Parameter 'url' wajib diisi." });

    try { new URL(url); } catch {
      return res.status(400).json({ error: "URL tidak valid." });
    }

    const q = parseInt(quality) || 80;
    if (q < 0 || q > 100)
      return res.status(400).json({ error: "Quality harus antara 0-100." });

    // maxsize opsional (bytes), default 1MB
    const maxBytes = parseInt(maxsize) || 1 * 1024 * 1024;
    if (maxBytes < 1024 || maxBytes > 50 * 1024 * 1024)
      return res.status(400).json({ error: "maxsize harus antara 1024 (1KB) hingga 52428800 (50MB)." });

    try {
      const { buffer: webpBuffer, contentType, isOriginal } = await convertToWebP(url, q, maxBytes);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", webpBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Output-Size", `${(webpBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      if (isOriginal) res.setHeader("X-Fallback", "original");
      return res.send(webpBuffer);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal konversi ke WebP", detail: err.message });
    }
  }

  // --- COMPRESS ---
  if (type === "compress") {
    if (req.method !== "GET")
      return res.status(405).json({ error: "Compress hanya mendukung metode GET." });

    const { url, maxsize } = req.query;
    if (!url) return res.status(400).json({ error: "Parameter 'url' wajib diisi." });

    try { new URL(url); } catch {
      return res.status(400).json({ error: "URL tidak valid." });
    }

    // maxsize opsional (bytes), default 100KB
    const maxBytes = parseInt(maxsize) || 100 * 1024;
    if (maxBytes < 1024 || maxBytes > 10 * 1024 * 1024)
      return res.status(400).json({ error: "maxsize harus antara 1024 (1KB) hingga 10485760 (10MB)." });

    try {
      const compressed = await compressImage(url, maxBytes);
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Content-Length", compressed.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Compressed-Size", `${(compressed.length / 1024).toFixed(2)}KB`);
      return res.send(compressed);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal kompres gambar", detail: err.message });
    }
  }

  // --- LEADERBOARD ---
  if (type === "leaderboard") {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Leaderboard requires POST method." });

    try {
      const { header, players, background, variant } = req.body;
      if (!players || !Array.isArray(players))
        return res.status(400).json({ error: "Missing players array." });

      const safeHeader = {
        title:    header?.title    || "Leaderboard",
        image:    header?.image    || "https://github.com/neplextech.png",
        subtitle: header?.subtitle || "0 members",
      };

      const lb = new LeaderboardBuilder()
        .setHeader(safeHeader)
        .setPlayers(players.slice(0, 10));

      if (background) lb.setBackground(background);
      lb.setVariant(variant === "horizontal" ? "horizontal" : "default");

      const imageBuffer = await lb.build({ format: "png" });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(imageBuffer);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to generate leaderboard", detail: err.message });
    }
  }

  // --- RANK / WELCOME / GOODBYE ---
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed." });

  if (!type)
    return res.status(400).json({ error: "Missing 'type' parameter." });

  try {
    let imageBuffer;

    if (type === "rank") {
      const { username, displayName, avatar, currentXP, requiredXP, level, rank, status, background } = req.query;
      const card = new RankCardBuilder()
        .setDisplayName(displayName || username || "User")
        .setUsername(username ? `@${username}` : undefined)
        .setAvatar(avatar || "https://cdn.discordapp.com/embed/avatars/0.png")
        .setCurrentXP(parseInt(currentXP) || 0)
        .setRequiredXP(parseInt(requiredXP) || 100)
        .setLevel(parseInt(level) || 1)
        .setRank(parseInt(rank) || 1)
        .setOverlay(90);
      if (status && ["online", "idle", "dnd", "offline"].includes(status)) card.setStatus(status);
      card.setBackground(background || "#2C2F33");
      imageBuffer = await card.build({ format: "png" });
    }
    else if (type === "welcome" || type === "goodbye") {
      const { displayName, avatar, message } = req.query;
      const card = new GreetingsCard()
        .setType(type)
        .setDisplayName(displayName || "User")
        .setAvatar(avatar || "https://cdn.discordapp.com/embed/avatars/0.png")
        .setMessage(message || (type === "welcome" ? "Welcome to the server!" : "We'll miss you!"));
      imageBuffer = await card.build({ format: "png" });
    }
    else if (type === "profile") {
      const {
        name, username, bio, avatar, background,
        stat1label, stat1value,
        stat2label, stat2value,
        stat3label, stat3value,
        accent, badge,
      } = req.query;

      const card = new ProfileCard()
        .setName(name || "")
        .setUsername(username || "")
        .setBio(bio || "")
        .setAvatar(avatar || "")
        .setBackground(background || "")
        .setStatLabel1(stat1label || "Pesan")
        .setStatValue1(stat1value || "0")
        .setStatLabel2(stat2label || "Level")
        .setStatValue2(stat2value || "1")
        .setStatLabel3(stat3label || "Poin")
        .setStatValue3(stat3value || "0")
        .setAccent(accent || "6366f1")
        .setBadge(badge || "");

      imageBuffer = await card.build({ format: "png" });
    }
    else {
      return res.status(400).json({ error: "Invalid type. Use 'welcome', 'goodbye', 'rank', 'leaderboard', 'profile', 'convert', atau 'compress'." });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(imageBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate image", detail: err.message });
  }
};
