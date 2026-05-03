const {
  RankCardBuilder,
  Font,
  Builder,
  loadImage,
  LeaderboardBuilder,
} = require("canvacord");
const { createCanvas } = require("@napi-rs/canvas"); // atau 'canvas' jika pakai node-canvas
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const axios = require("axios");
const { PassThrough } = require("stream");
const path = require("path");
const fs = require("fs");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegPath);
Font.loadDefault();

// ---------- Custom Greetings Card (JSX, tetap seperti semula) ----------
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

// ---------- Profile Card (Canvas manual, kompatibel dengan Canvacord) ----------
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
      accent: "#6366f1",
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

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // --- 1. Background (gambar atau gradien) ---
    if (background && background.trim() !== "") {
      try {
        const bgImg = await loadImage(background);
        ctx.drawImage(bgImg, 0, 0, this.width, this.height);
      } catch (e) {
        console.warn("Gagal load background, pakai gradien fallback", e);
        this._drawGradientBackground(ctx);
      }
    } else {
      this._drawGradientBackground(ctx);
    }

    // --- 2. Overlay gelap di bagian bawah (glass panel area) ---
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, this.height - 240, this.width, 240);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 240);
    ctx.lineTo(this.width, this.height - 240);
    ctx.stroke();

    // --- 3. Accent stripe kiri ---
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 5, this.height);

    // --- 4. Avatar dengan ring gradient ---
    const avatarUrl = avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
    let avatarImg;
    try {
      avatarImg = await loadImage(avatarUrl);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    const avatarSize = 132;
    const avatarX = 52;
    const avatarY = this.height - 240 + (240 - avatarSize) / 2; // (540-240)=300, + (240-132)/2 = 300+54=354? Lebih mudah: bottom 168px dari bawah? Hitung manual: posisi Y = height - 168 - avatarSize = 540-168-132=240
    const avatarYPos = this.height - 168 - avatarSize; // 540-168-132=240
    // Ring gradient
    const ringSize = avatarSize + 8;
    const ringGrad = ctx.createLinearGradient(avatarX-4, avatarYPos-4, avatarX+ringSize, avatarYPos+ringSize);
    ringGrad.addColorStop(0, accent);
    ringGrad.addColorStop(0.5, "rgba(255,255,255,0.12)");
    ringGrad.addColorStop(1, accent);
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarYPos + avatarSize/2, ringSize/2, 0, Math.PI*2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
    // Clip avatar lingkaran
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarYPos + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarYPos, avatarSize, avatarSize);
    ctx.restore();

    // --- 5. Badge (jika ada) ---
    if (badge && badge.trim() !== "") {
      ctx.font = "bold 10px 'Whitney', 'Roboto', sans-serif";
      const badgeText = badge.slice(0, 20);
      const badgeWidth = ctx.measureText(badgeText).width + 20;
      const badgeX = avatarX;
      const badgeY = avatarYPos + avatarSize - 12;
      ctx.fillStyle = accent;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, 18, 9);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badgeText, badgeX + 10, badgeY + 13);
    }

    // --- 6. Nama ---
    ctx.font = "800 28px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    const nameText = name || "Nama Pengguna";
    ctx.fillText(nameText, 214, avatarYPos + 32);

    // --- 7. Username ---
    ctx.font = "600 14px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = accent;
    const usernameText = username ? `@${username}` : "";
    ctx.fillText(usernameText, 214, avatarYPos + 52);

    // --- 8. Bio ---
    if (bio && bio.trim() !== "") {
      ctx.font = "12px 'Whitney', 'Roboto', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      const bioText = bio.length > 60 ? bio.slice(0, 57) + "..." : bio;
      ctx.fillText(bioText, 214, avatarYPos + 78);
    }

    // --- 9. Statistik (3 kolom) ---
    const statsY = this.height - 48;
    const statItems = [
      { label: statLabel1, value: statValue1 },
      { label: statLabel2, value: statValue2 },
      { label: statLabel3, value: statValue3 },
    ];
    const totalWidth = this.width - 104; // 52 kiri + 52 kanan
    const colWidth = totalWidth / 3;

    ctx.font = "800 22px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    for (let i = 0; i < statItems.length; i++) {
      const x = 52 + colWidth * i + colWidth/2;
      ctx.fillText(String(statItems[i].value || "0"), x, statsY - 10);
    }
    ctx.font = "600 11px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < statItems.length; i++) {
      const x = 52 + colWidth * i + colWidth/2;
      ctx.fillText(String(statItems[i].label || ""), x, statsY + 8);
    }
    ctx.textAlign = "left";

    // --- separator garis antar stat (opsional) ---
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const sepX = 52 + colWidth * i;
      ctx.beginPath();
      ctx.moveTo(sepX, statsY - 28);
      ctx.lineTo(sepX, statsY + 16);
      ctx.stroke();
    }

    // Kembalikan buffer PNG
    return canvas.toBuffer("image/png");
  }

  _drawGradientBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#16213e");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}

// Helper untuk roundRect (jika belum ada di ctx)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x+r, y);
    this.lineTo(x+w-r, y);
    this.quadraticCurveTo(x+w, y, x+w, y+r);
    this.lineTo(x+w, y+h-r);
    this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    this.lineTo(x+r, y+h);
    this.quadraticCurveTo(x, y+h, x, y+h-r);
    this.lineTo(x, y+r);
    this.quadraticCurveTo(x, y, x+r, y);
    return this;
  };
}

// ---------- Fungsi convert & compress (tetap sama seperti semula) ----------
function setCorsHeaders(res) { /* ... */ }
function _runConvertToWebP(inputBuffer, { quality, fps = 0, width = 0 }) { /* ... */ }
async function convertToWebP(url, quality = 80, maxSize = 1 * 1024 * 1024) { /* ... */ }
async function compressImage(url, maxSize = 100 * 1024) { /* ... */ }
function _runCompress(inputStream, quality, scale = null) { /* ... */ }

// ---------- Handler Utama ----------
module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { type } = req.query;

  // --- CONVERT ---
  if (type === "convert") { /* ... tetap sama */ }
  // --- COMPRESS ---
  if (type === "compress") { /* ... tetap sama */ }
  // --- LEADERBOARD ---
  if (type === "leaderboard") { /* ... tetap sama */ }

  // --- RANK / WELCOME / GOODBYE / PROFILE ---
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed." });

  if (!type)
    return res.status(400).json({ error: "Missing 'type' parameter." });

  try {
    let imageBuffer;

    if (type === "rank") {
      // ... sama seperti kode awal
    } else if (type === "welcome" || type === "goodbye") {
      // ... sama
    } else if (type === "profile") {
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
        .setAccent(accent || "#6366f1")
        .setBadge(badge || "");

      imageBuffer = await card.build({ format: "png" });
    } else {
      return res.status(400).json({ error: "Invalid type." });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(imageBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate image", detail: err.message });
  }
};