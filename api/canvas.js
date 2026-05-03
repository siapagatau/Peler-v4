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
// PENTING: canvacord JSX mengharuskan setiap <div> yang memiliki lebih dari
// 1 child node harus punya explicit style display: flex/contents/none.
// Kita pakai display:flex + position:absolute pada children untuk efek layering.

function _statBlock(value, label) {
  return JSX.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
      String(value || "0")
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
          marginTop: "3px",
        },
      },
      String(label || "")
    )
  );
}

function _divider() {
  return JSX.createElement("div", {
    style: {
      width: "1px",
      height: "38px",
      background: "rgba(255,255,255,0.18)",
    },
  });
}

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

    const accentColor = `#${(accent || "6366f1").replace("#", "")}`;

    // ── Avatar: display flex agar ring + foto valid sebagai 2 children ──
    const avatarEl = JSX.createElement(
      "div",
      {
        style: {
          display: "flex",
          position: "absolute",
          left: "52px",
          bottom: "168px",
          width: "140px",
          height: "140px",
        },
      },
      JSX.createElement("div", {
        style: {
          position: "absolute",
          top: "-4px",
          left: "-4px",
          width: "148px",
          height: "148px",
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.12), ${accentColor})`,
        },
      }),
      JSX.createElement("img", {
        src: avatarImg.toDataURL(),
        style: {
          position: "absolute",
          top: "4px",
          left: "4px",
          width: "132px",
          height: "132px",
          borderRadius: "50%",
          objectFit: "cover",
          objectPosition: "center top",
        },
      })
    );

    // ── Info panel: nama + username (selalu 2 child) ──
    const infoDivChildren = [
      JSX.createElement(
        "div",
        {
          style: {
            fontSize: "28px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: "1.1",
            letterSpacing: "-0.5px",
          },
        },
        String(name || "Nama Pengguna")
      ),
      JSX.createElement(
        "div",
        {
          style: {
            fontSize: "14px",
            color: accentColor,
            fontWeight: "600",
            marginTop: "4px",
            letterSpacing: "0.02em",
          },
        },
        username ? `@${username}` : "\u00a0"
      ),
    ];

    if (bio) {
      infoDivChildren.push(
        JSX.createElement(
          "div",
          {
            style: {
              fontSize: "12px",
              color: "rgba(255,255,255,0.68)",
              marginTop: "6px",
              lineHeight: "1.5",
            },
          },
          String(bio)
        )
      );
    }

    const infoEl = JSX.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: "214px",
          bottom: "100px",
          right: "36px",
        },
      },
      ...infoDivChildren
    );

    // ── Stats row: 5 children (3 blok + 2 divider) ──
    const statsEl = JSX.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          position: "absolute",
          left: "52px",
          right: "52px",
          bottom: "20px",
          borderTop: "1px solid rgba(255,255,255,0.14)",
          paddingTop: "12px",
        },
      },
      _statBlock(statValue1, statLabel1),
      _divider(),
      _statBlock(statValue2, statLabel2),
      _divider(),
      _statBlock(statValue3, statLabel3)
    );

    // ── Background layer ──
    const bgEl = background
      ? JSX.createElement("img", {
          src: background,
          style: {
            position: "absolute",
            top: "0px",
            left: "0px",
            width: "960px",
            height: "540px",
            objectFit: "cover",
            objectPosition: "center",
          },
        })
      : JSX.createElement("div", {
          style: {
            position: "absolute",
            top: "0px",
            left: "0px",
            width: "960px",
            height: "540px",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          },
        });

    const overlayEl = JSX.createElement("div", {
      style: {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "960px",
        height: "540px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)",
      },
    });

    const stripeEl = JSX.createElement("div", {
      style: {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "5px",
        height: "540px",
        background: `linear-gradient(to bottom, ${accentColor}, rgba(0,0,0,0))`,
      },
    });

    const panelEl = JSX.createElement("div", {
      style: {
        position: "absolute",
        bottom: "0px",
        left: "0px",
        width: "960px",
        height: "240px",
        background: "rgba(0,0,0,0.38)",
        borderTop: "1.5px solid rgba(255,255,255,0.14)",
        borderRadius: "24px 24px 0 0",
      },
    });

    // Kumpulkan semua children, badge hanya ditambah jika ada
    const rootChildren = [bgEl, overlayEl, stripeEl, panelEl, avatarEl, infoEl, statsEl];

    if (badge) {
      rootChildren.push(
        JSX.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              left: "52px",
              bottom: "152px",
              background: accentColor,
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "700",
              padding: "2px 10px",
              borderRadius: "99px",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            },
          },
          String(badge)
        )
      );
    }

    // Root harus display: flex karena punya banyak children
    return JSX.createElement(
      "div",
      {
        style: {
          display: "flex",
          position: "relative",
          width: "960px",
          height: "540px",
          overflow: "hidden",
          borderRadius: "16px",
        },
      },
      ...rootChildren
    );
  }
}

// ---------- Helpers ----------
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Jalankan satu kali konversi WebP animated dengan opsi tertentu.
 */
function _runConvertToWebP(inputBuffer, { quality, fps = 0, width = 0 }) {
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

async function convertToWebP(url, quality = 80, maxSize = 1 * 1024 * 1024) {
  const originalResponse = await axios({ method: "GET", url, responseType: "arraybuffer" });
  const originalBuffer   = Buffer.from(originalResponse.data);
  const originalType     = originalResponse.headers["content-type"] || "application/octet-stream";

  console.log(`[convert] Original: ${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB type=${originalType}`);

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

  console.warn(`[convert] ⚠️ Semua opsi fps habis, mengembalikan buffer asli.`);
  return { buffer: originalBuffer, contentType: originalType, isOriginal: true };
}

async function compressImage(url, maxSize = 100 * 1024) {
  const response = await axios({ method: "GET", url, responseType: "stream" });
  const qualities = [80, 65, 50, 35, 20];

  for (const quality of qualities) {
    const result = await _runCompress(response.data.pipe(new PassThrough()), quality);
    if (result.length <= maxSize) return result;
    if (quality !== qualities[qualities.length - 1]) {
      const retry = await axios({ method: "GET", url, responseType: "stream" });
      response.data = retry.data;
    }
  }

  const scales = [0.75, 0.5, 0.35, 0.25];
  for (const scale of scales) {
    const retry = await axios({ method: "GET", url, responseType: "stream" });
    const result = await _runCompress(retry.data, 20, scale);
    if (result.length <= maxSize) return result;
  }

  const last = await axios({ method: "GET", url, responseType: "stream" });
  return _runCompress(last.data, 20, 0.25);
}

function _runCompress(inputStream, quality, scale = null) {
  const outputStream = new PassThrough();
  const chunks = [];

  const scaleFilter = scale
    ? `scale=iw*${scale}:ih*${scale}:flags=lanczos`
    : "scale=iw:ih:flags=lanczos";

  return new Promise((resolve, reject) => {
    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .inputOptions(["-analyzeduration 10M", "-probesize 10M"])
      .videoFilter(scaleFilter)
      .outputOptions([
        "-c:v libwebp",
        `-quality ${quality}`,
        "-loop 0",
        "-preset picture",
        "-an",
        "-vframes 1",
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

  // --- RANK / WELCOME / GOODBYE / PROFILE ---
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
