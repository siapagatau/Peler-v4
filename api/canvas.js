const { loadImage, Font } = require("canvacord");
const { createCanvas } = require("@napi-rs/canvas");
const axios = require("axios");

Font.loadDefault();

// ---------- Profile Card (simple, tanpa bug roundedRect) ----------
class ProfileCard {
  constructor(width = 960, height = 540) {
    this.width = width;
    this.height = height;
    this.data = {
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
    };
  }

  setName(v) { this.data.name = v; return this; }
  setUsername(v) { this.data.username = v; return this; }
  setBio(v) { this.data.bio = v; return this; }
  setAvatar(v) { this.data.avatar = v; return this; }
  setBackground(v) { this.data.background = v; return this; }
  setStatLabel1(v) { this.data.statLabel1 = v; return this; }
  setStatValue1(v) { this.data.statValue1 = v; return this; }
  setStatLabel2(v) { this.data.statLabel2 = v; return this; }
  setStatValue2(v) { this.data.statValue2 = v; return this; }
  setStatLabel3(v) { this.data.statLabel3 = v; return this; }
  setStatValue3(v) { this.data.statValue3 = v; return this; }
  setAccent(v) { this.data.accent = v; return this; }
  setBadge(v) { this.data.badge = v; return this; }

  _normalizeColor(color) {
    if (!color) return "#6366f1";
    const str = String(color).trim();
    return str.startsWith("#") ? str : `#${str}`;
  }

  _roundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    return this;
  }

  _drawGradientBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.5, "#16213e");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  async render() {
    const {
      name, username, bio, avatar, background,
      statLabel1, statValue1,
      statLabel2, statValue2,
      statLabel3, statValue3,
      accent, badge,
    } = this.data;

    const accentColor = this._normalizeColor(accent);
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // --- Background (gambar atau gradien) ---
    if (background && background.trim() !== "") {
      try {
        const bgImg = await loadImage(background);
        ctx.drawImage(bgImg, 0, 0, this.width, this.height);
      } catch (e) {
        this._drawGradientBackground(ctx);
      }
    } else {
      this._drawGradientBackground(ctx);
    }

    // --- Overlay gelap bawah ---
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, this.height - 240, this.width, 240);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 240);
    ctx.lineTo(this.width, this.height - 240);
    ctx.stroke();

    // --- Accent stripe kiri ---
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 5, this.height);

    // --- Avatar dengan ring ---
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar || "https://cdn.discordapp.com/embed/avatars/0.png");
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    const avatarSize = 132;
    const avatarX = 52;
    const avatarY = this.height - 168 - avatarSize;
    const ringSize = avatarSize + 8;

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, ringSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // --- Badge (opsional) ---
    if (badge && badge.trim() !== "") {
      ctx.font = "bold 10px 'Whitney', 'Roboto', sans-serif";
      const badgeText = badge.slice(0, 20);
      const badgeWidth = ctx.measureText(badgeText).width + 20;
      const badgeX = avatarX;
      const badgeY = avatarY + avatarSize - 12;
      this._roundedRect(ctx, badgeX, badgeY, badgeWidth, 18, 9);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badgeText, badgeX + 10, badgeY + 13);
    }

    // --- Nama ---
    ctx.font = "800 28px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name || "Nama Pengguna", 214, avatarY + 32);

    // --- Username ---
    ctx.font = "600 14px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = accentColor;
    ctx.fillText(username ? `@${username}` : "", 214, avatarY + 52);

    // --- Bio ---
    if (bio && bio.trim() !== "") {
      ctx.font = "12px 'Whitney', 'Roboto', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      const bioText = bio.length > 60 ? bio.slice(0, 57) + "..." : bio;
      ctx.fillText(bioText, 214, avatarY + 78);
    }

    // --- Statistik ---
    const statsY = this.height - 48;
    const statItems = [
      { label: statLabel1, value: statValue1 },
      { label: statLabel2, value: statValue2 },
      { label: statLabel3, value: statValue3 },
    ];
    const totalWidth = this.width - 104;
    const colWidth = totalWidth / 3;

    ctx.font = "800 22px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    for (let i = 0; i < statItems.length; i++) {
      const x = 52 + colWidth * i + colWidth / 2;
      ctx.fillText(String(statItems[i].value || "0"), x, statsY - 10);
    }
    ctx.font = "600 11px 'Whitney', 'Roboto', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < statItems.length; i++) {
      const x = 52 + colWidth * i + colWidth / 2;
      ctx.fillText(String(statItems[i].label || ""), x, statsY + 8);
    }
    ctx.textAlign = "left";

    // Separator garis
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const sepX = 52 + colWidth * i;
      ctx.beginPath();
      ctx.moveTo(sepX, statsY - 28);
      ctx.lineTo(sepX, statsY + 16);
      ctx.stroke();
    }

    return canvas.toBuffer("image/png");
  }

  async build() {
    return this.render();
  }
}

// ---------- Helper CORS ----------
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ---------- Handler Utama (hanya type=profile) ----------
module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: "Invalid or missing type. Only 'profile' is supported." });
  }

  try {
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

    const imageBuffer = await card.build();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(imageBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate profile image", detail: err.message });
  }
};