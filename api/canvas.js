const { createCanvas, loadImage } = require("@napi-rs/canvas");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: 'Hanya mendukung type="profile"' });
  }

  try {
    const {
      name = "Pengguna",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent = "#f97316",
      uang = "Rp 0",
      limit = "100",
      rank = "#1",
      badge = "Member"
    } = req.query;

    const accentColor = accent.startsWith("#") ? accent : `#${accent}`;

    // Helper: hex to rgb
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const rgb = hexToRgb(accentColor);

    const width = 900;
    const height = 320;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ─── BACKGROUND ───────────────────────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        // Cover fit
        const scale = Math.max(width / bg.width, height / bg.height);
        const bw = bg.width * scale;
        const bh = bg.height * scale;
        ctx.drawImage(bg, (width - bw) / 2, (height - bh) / 2, bw, bh);
      } catch {
        drawFallbackBg(ctx, width, height, rgb);
      }
    } else {
      drawFallbackBg(ctx, width, height, rgb);
    }

    // Dark overlay gradient (kiri lebih gelap, kanan sedikit transparan)
    const overlayGrad = ctx.createLinearGradient(0, 0, width, 0);
    overlayGrad.addColorStop(0, "rgba(5,5,15,0.92)");
    overlayGrad.addColorStop(0.55, "rgba(5,5,15,0.80)");
    overlayGrad.addColorStop(1, "rgba(5,5,15,0.55)");
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, width, height);

    // ─── ACCENT LEFT BAR ──────────────────────────────────────────
    const barGrad = ctx.createLinearGradient(0, 0, 0, height);
    barGrad.addColorStop(0, accentColor);
    barGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 5, height);

    // ─── AVATAR ───────────────────────────────────────────────────
    const avatarSize = 110;
    const avatarX = 48;
    const avatarY = height / 2 - avatarSize / 2;
    const cx = avatarX + avatarSize / 2;
    const cy = avatarY + avatarSize / 2;
    const radius = avatarSize / 2;

    // Glow lingkaran avatar
    const glowGrad = ctx.createRadialGradient(cx, cy, radius - 5, cx, cy, radius + 18);
    glowGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
    ctx.fill();

    // Ring aksen
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Clip & draw avatar
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // ─── TEKS KANAN AVATAR ────────────────────────────────────────
    const textX = avatarX + avatarSize + 32;
    const nameY = 80;

    // Badge (Member, VIP, dll)
    const badgeText = badge || "Member";
    const badgePad = { x: 10, y: 4 };
    ctx.font = "bold 11px sans-serif";
    const badgeW = ctx.measureText(badgeText).width + badgePad.x * 2;
    const badgeH = 22;
    const badgeY = nameY - 46;

    // Badge background
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`;
    roundRect(ctx, textX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    roundRect(ctx, textX, badgeY, badgeW, badgeH, 6);
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.textAlign = "left";
    ctx.fillText(badgeText.toUpperCase(), textX + badgePad.x, badgeY + 15);

    // Nama
    ctx.font = "bold 34px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.8)`;
    ctx.shadowBlur = 14;
    ctx.fillText(name, textX, nameY);
    ctx.shadowBlur = 0;

    // Garis dekoratif tipis di bawah nama
    const nameWidth = ctx.measureText(name).width;
    const lineGrad = ctx.createLinearGradient(textX, 0, textX + nameWidth, 0);
    lineGrad.addColorStop(0, accentColor);
    lineGrad.addColorStop(1, "transparent");
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textX, nameY + 8);
    ctx.lineTo(textX + nameWidth, nameY + 8);
    ctx.stroke();

    // ─── STAT CARDS ───────────────────────────────────────────────
    const stats = [
      { label: "💰 Uang", value: uang },
      { label: "⚡ Limit", value: limit },
      { label: "🏆 Rank", value: rank }
    ];

    const cardStartX = textX;
    const cardY = nameY + 32;
    const cardGap = 16;
    const cardH = 68;
    const totalCardWidth = width - textX - 40;
    const cardW = (totalCardWidth - cardGap * (stats.length - 1)) / stats.length;

    for (let i = 0; i < stats.length; i++) {
      const cx2 = cardStartX + i * (cardW + cardGap);

      // Card background
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, cx2, cardY, cardW, cardH, 10);
      ctx.fill();

      // Border subtle
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      roundRect(ctx, cx2, cardY, cardW, cardH, 10);
      ctx.stroke();

      // Top accent line
      const accentLine = ctx.createLinearGradient(cx2, cardY, cx2 + cardW, cardY);
      accentLine.addColorStop(0, accentColor);
      accentLine.addColorStop(1, "transparent");
      ctx.strokeStyle = accentLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx2 + 10, cardY);
      ctx.lineTo(cx2 + cardW - 10, cardY);
      ctx.stroke();

      // Value
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(stats[i].value, cx2 + cardW / 2, cardY + 32);

      // Label
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(stats[i].label, cx2 + cardW / 2, cardY + 52);
    }

    ctx.textAlign = "left";

    // ─── WATERMARK ────────────────────────────────────────────────
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.textAlign = "right";
    ctx.fillText("WhatsApp Bot", width - 20, height - 14);
    ctx.textAlign = "left";

    // Output
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────

function drawFallbackBg(ctx, width, height, rgb) {
  // Dark gradient + subtle noise feel
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, `rgb(${Math.max(rgb.r - 100, 10)},${Math.max(rgb.g - 110, 8)},${Math.max(rgb.b - 80, 15)})`);
  bg.addColorStop(1, "#0a0a12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial glow di kiri atas
  const glow = ctx.createRadialGradient(120, 120, 0, 120, 120, 300);
  glow.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function roundRect(ctx, x, y, w, h, r) {
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
}
