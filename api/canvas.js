const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// =========================
// LOAD FONT
// =========================
try {
  const regular = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf"));
  const bold = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf"));
  GlobalFonts.register(regular, "Inter");
  GlobalFonts.register(bold, "InterBold");
  console.log("✅ Font loaded:", GlobalFonts.families);
} catch (e) {
  console.log("⚠️ Font error, using fallback:", e.message);
}

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

    // Validasi & parsing
    const money = parseInt(uang) || 0;
    const lim = parseInt(limit) || 0;
    const currentXp = Math.min(parseInt(xp) || 0, parseInt(maxXp) || 100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPercent = (currentXp / maxXpVal) * 100;

    if (!accent || !/^#([0-9A-F]{3}){1,2}$/i.test(accent)) {
      accent = "#7c3aed";
    }

    const width = 800;
    const height = 450; // Sedikit lebih tinggi untuk progress bar
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // =========================
    // BACKGROUND (Gambar atau gradien)
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

    // Overlay gelap + blur effect (simulasi glass)
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, width, height);

    // =========================
    // CARD UTAMA (Glassmorphism)
    // =========================
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(30, 30, 46, 0.75)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 24, true, false);
    ctx.shadowBlur = 0;

    // Border tipis
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24, false, true);

    // =========================
    // AVATAR (dengan border gradien)
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

    // Lingkaran luar gradien
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = accent;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 4, 0, Math.PI*2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    // Clip avatar
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

    ctx.font = "bold 28px InterBold";
    ctx.fillStyle = "#ffffff";
    let displayName = name.length > 18 ? name.slice(0, 16) + "..." : name;
    ctx.fillText(displayName, textX, currentY);

    // Badge rank
    ctx.font = "bold 14px InterBold";
    ctx.fillStyle = accent;
    const rankText = rank.toUpperCase();
    const rankWidth = ctx.measureText(rankText).width + 20;
    ctx.fillStyle = "rgba(124, 58, 237, 0.2)";
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
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, cardXPos, cardStartY, cardWidth, cardHeight, 12, true, false);
      ctx.fillStyle = card.color;
      ctx.font = "bold 14px Inter";
      ctx.fillText(card.label, cardXPos + 12, cardStartY + 25);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px InterBold";
      ctx.fillText(card.value, cardXPos + 12, cardStartY + 55);
      cardXPos += cardWidth + 15;
    }

    currentY = cardStartY + cardHeight + 25;

    // =========================
    // PROGRESS BAR XP
    // =========================
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px Inter";
    ctx.fillText("⚡ PROGRESS XP", textX, currentY - 5);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    roundRect(ctx, textX, currentY, 420, 10, 10, true, false);
    ctx.fillStyle = accent;
    roundRect(ctx, textX, currentY, (xpPercent / 100) * 420, 10, 10, true, false);
    ctx.fillStyle = "#d1d5db";
    ctx.font = "bold 10px Inter";
    ctx.fillText(`${currentXp}/${maxXpVal} XP`, textX + 430, currentY + 8);

    // =========================
    // ACCENT LINE BAWAH (gradien)
    // =========================
    const gradAccent = ctx.createLinearGradient(cardX, cardY+cardH-8, cardX+cardW, cardY+cardH-8);
    gradAccent.addColorStop(0, accent);
    gradAccent.addColorStop(1, "#ffffff");
    ctx.fillStyle = gradAccent;
    roundRect(ctx, cardX, cardY + cardH - 8, cardW, 6, 6, true, false);

    // =========================
    // OUTPUT
    // =========================
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// =========================
// HELPER FUNCTIONS
// =========================
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