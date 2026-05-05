const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// =========================
// LOAD FONT (DENGAN EMOJI SUPPORT)
// =========================
let hasEmojiFont = false;
try {
  const regular = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf"));
  const bold = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf"));
  GlobalFonts.register(regular, "Inter");
  GlobalFonts.register(bold, "InterBold");

  try {
    const emoji = fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf"));
    GlobalFonts.register(emoji, "NotoColorEmoji");
    hasEmojiFont = true;
    console.log("✅ Emoji font loaded: NotoColorEmoji");
  } catch (err) {
    console.warn("⚠️ Emoji font not found, emoji will not render (place NotoColorEmoji.ttf in /fonts)");
  }
} catch (e) {
  console.log("FONT ERROR:", e.message);
}

const getFont = (weight, size, useEmoji = true) => {
  const base = `${weight} ${size}px ${useEmoji && hasEmojiFont ? "'InterBold', 'NotoColorEmoji'" : "InterBold"}`;
  return base;
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (req.query.type !== "profile") {
    return res.status(400).json({ error: 'Gunakan type="profile"' });
  }

  try {
    let {
      name = "User",
      uang = "0",
      limit = "0",
      rank = "Member",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent = "#7c3aed",
      level = "1",
      xp = "0",
      maxXp = "100"
    } = req.query;

    const money = parseInt(uang) || 0;
    const lim = parseInt(limit) || 0;
    const currentXp = Math.min(parseInt(xp) || 0, parseInt(maxXp) || 100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPercent = (currentXp / maxXpVal) * 100;

    if (!accent || !/^#([0-9A-F]{3}){1,2}$/i.test(accent)) {
      accent = "#7c3aed";
    }

    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // =========================
    // BACKGROUND (gambar atau gradasi)
    // =========================
    try {
      if (background) {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, width, height);
      } else throw "no-bg";
    } catch {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#1a1a2e");
      grad.addColorStop(1, "#16213e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // OVERLAY GELAP RINGAN (opsional, biar teks lebih terbaca)
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, width, height);

    // =========================
    // CARD UTAMA - LEBIH TRANSPARAN
    // =========================
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15;
    // Ubah opacity dari 0.75 menjadi 0.5 agar background lebih terlihat
    ctx.fillStyle = "rgba(30, 30, 46, 0.5)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 24, true, false);
    ctx.shadowBlur = 0;

    // Stroke tipis biar tetap ada batas card
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24, false, true);

    // =========================
    // AVATAR
    // =========================
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }

    const avatarSize = 110;
    const avatarX = cardX + 35;
    const avatarY = cardY + 35;

    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = accent;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 4, 0, Math.PI*2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // =========================
    // NAMA & RANK BADGE
    // =========================
    const textX = avatarX + avatarSize + 35;
    let currentY = avatarY + 35;

    ctx.font = getFont("bold", 28, true);
    ctx.fillStyle = "#ffffff";
    let displayName = name.length > 20 ? name.slice(0, 18) + "..." : name;
    ctx.fillText(displayName, textX, currentY);

    ctx.font = getFont("bold", 14, true);
    const rankText = rank.toUpperCase();
    const rankWidth = ctx.measureText(rankText).width + 20;
    ctx.fillStyle = "rgba(124, 58, 237, 0.3)"; // sedikit lebih transparan
    roundRect(ctx, textX, currentY + 8, rankWidth, 24, 12, true, false);
    ctx.fillStyle = accent;
    ctx.fillText(rankText, textX + 10, currentY + 25);
    currentY += 45;

    // =========================
    // INFO CARDS (Uang, Limit, Level)
    // =========================
    const infoCards = [
      { label: "💰 UANG", value: formatNumber(money), color: "#10b981" },
      { label: "🎫 LIMIT", value: formatNumber(lim), color: "#f59e0b" },
      { label: "⭐ LEVEL", value: level, color: "#ef4444" }
    ];

    const cardStartY = currentY;
    const cardWidth = 150;
    const cardHeight = 70;
    let cardXPos = textX;
    for (let i = 0; i < infoCards.length; i++) {
      const card = infoCards[i];
      // Card info juga dibuat lebih transparan
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      roundRect(ctx, cardXPos, cardStartY, cardWidth, cardHeight, 12, true, false);
      ctx.fillStyle = card.color;
      ctx.font = getFont("bold", 14, true);
      ctx.fillText(card.label, cardXPos + 12, cardStartY + 25);
      ctx.fillStyle = "#ffffff";
      ctx.font = getFont("bold", 22, true);
      ctx.fillText(card.value, cardXPos + 12, cardStartY + 55);
      cardXPos += cardWidth + 15;
    }

    currentY = cardStartY + cardHeight + 25;

    // =========================
    // PROGRESS BAR XP
    // =========================
    ctx.fillStyle = "#e5e7eb";
    ctx.font = getFont("normal", 12, true);
    ctx.fillText("⚡ PROGRESS XP", textX, currentY - 5);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(ctx, textX, currentY, 420, 10, 10, true, false);
    ctx.fillStyle = accent;
    roundRect(ctx, textX, currentY, (xpPercent / 100) * 420, 10, 10, true, false);
    ctx.fillStyle = "#d1d5db";
    ctx.font = getFont("bold", 10, true);
    ctx.fillText(`${currentXp}/${maxXpVal} XP`, textX + 430, currentY + 8);

    // =========================
    // ACCENT LINE BAWAH
    // =========================
    const gradAccent = ctx.createLinearGradient(cardX, cardY+cardH-8, cardX+cardW, cardY+cardH-8);
    gradAccent.addColorStop(0, accent);
    gradAccent.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradAccent;
    roundRect(ctx, cardX, cardY + cardH - 8, cardW, 6, 6, true, false);

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
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
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}