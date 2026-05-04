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
      uang = "Rp 0",
      limit = "100",
      rank = "#1",
      badge = "Member"
    } = req.query;

    const width = 900;
    const height = 340;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ─── BACKGROUND GRADIENT PASTEL ───────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0,   "#fce4f3");
    bgGrad.addColorStop(0.4, "#e8d5f5");
    bgGrad.addColorStop(0.7, "#d0e8ff");
    bgGrad.addColorStop(1,   "#c8f0e8");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Background image overlay (sangat transparan)
    if (background) {
      try {
        const bg = await loadImage(background);
        const scale = Math.max(width / bg.width, height / bg.height);
        const bw = bg.width * scale;
        const bh = bg.height * scale;
        ctx.globalAlpha = 0.15;
        ctx.drawImage(bg, (width - bw) / 2, (height - bh) / 2, bw, bh);
        ctx.globalAlpha = 1;
      } catch {}
    }

    // ─── BUBBLE DEKORASI ──────────────────────────────────────────
    const bubbles = [
      { x: 820, y: 40,  r: 65, color: "rgba(255,182,193,0.38)" },
      { x: 760, y: 290, r: 50, color: "rgba(180,210,255,0.38)" },
      { x: 55,  y: 295, r: 38, color: "rgba(200,240,220,0.42)" },
      { x: 875, y: 185, r: 32, color: "rgba(220,200,255,0.38)" },
      { x: 410, y: 8,   r: 28, color: "rgba(255,220,180,0.32)" },
      { x: 160, y: 18,  r: 20, color: "rgba(255,182,230,0.32)" },
    ];
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }

    // ─── SPARKLE / BINTANG ────────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const sparkles = [
      { x: 700, y: 55,  s: 6 },
      { x: 840, y: 130, s: 4 },
      { x: 520, y: 22,  s: 5 },
      { x: 295, y: 315, s: 4 },
      { x: 660, y: 305, s: 5 },
      { x: 78,  y: 78,  s: 3 },
    ];
    for (const sp of sparkles) drawStar(ctx, sp.x, sp.y, sp.s);

    // ─── PANEL FROSTED GLASS ──────────────────────────────────────
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    roundRect(ctx, 24, 24, width - 48, height - 48, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, width - 48, height - 48, 28);
    ctx.stroke();

    // ─── AVATAR ───────────────────────────────────────────────────
    const avatarSize = 110;
    const avatarX = 58;
    const avatarY = height / 2 - avatarSize / 2;
    const acx = avatarX + avatarSize / 2;
    const acy = avatarY + avatarSize / 2;
    const rad = avatarSize / 2;

    // Shadow lembut
    ctx.shadowColor = "rgba(167,139,250,0.45)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(acx, acy, rad + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ring warna-warni (3 segmen)
    const ringColors = ["#FF8FAB", "#A78BFA", "#60CDFF"];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(acx, acy, rad + 8,
        (i * 2 * Math.PI) / 3 - Math.PI / 2,
        ((i + 1) * 2 * Math.PI) / 3 - Math.PI / 2
      );
      ctx.strokeStyle = ringColors[i];
      ctx.lineWidth = 4.5;
      ctx.stroke();
    }

    // Avatar gambar
    let avatarImg;
    try { avatarImg = await loadImage(avatar); }
    catch { avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath();
    ctx.arc(acx, acy, rad, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // ─── KONTEN TEKS ──────────────────────────────────────────────
    const textX = avatarX + avatarSize + 38;
    const badgeText = (badge || "Member").toUpperCase();

    // Badge pill
    ctx.font = "bold 11px sans-serif";
    const bPad = 11;
    const bW = ctx.measureText(badgeText).width + bPad * 2;
    const bH = 23;
    const bY = 50;

    const badgeGrad = ctx.createLinearGradient(textX, bY, textX + bW, bY + bH);
    badgeGrad.addColorStop(0, "#FFB3C8");
    badgeGrad.addColorStop(1, "#C4B5FD");
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, textX, bY, bW, bH, 12);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 2;
    ctx.fillText(badgeText, textX + bPad, bY + 16);
    ctx.shadowBlur = 0;

    // Nama
    ctx.font = "bold 38px sans-serif";
    ctx.fillStyle = "#3d2260";
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillText(name, textX, bY + 56);
    ctx.shadowBlur = 0;

    // Dot dekorasi di bawah nama
    const dotCols = ["#FF8FAB", "#A78BFA", "#60CDFF", "#FFD580"];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(textX + i * 13, bY + 70, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = dotCols[i];
      ctx.fill();
    }

    // ─── STAT CARDS ───────────────────────────────────────────────
    const stats = [
      { label: "💰  Uang",  value: uang,  c1: "#FFB3C8", c2: "#FF8FAB" },
      { label: "⚡  Limit", value: limit, c1: "#C4B5FD", c2: "#A78BFA" },
      { label: "🏆  Rank",  value: rank,  c1: "#93E0FF", c2: "#60CDFF" }
    ];

    const cardY = bY + 84;
    const totalW = width - textX - 50;
    const gap = 14;
    const cardW = (totalW - gap * (stats.length - 1)) / stats.length;
    const cardH = 80;

    for (let i = 0; i < stats.length; i++) {
      const cx2 = textX + i * (cardW + gap);

      // Shadow kartu
      ctx.shadowColor = "rgba(180,160,220,0.28)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;

      // Background kartu
      const cGrad = ctx.createLinearGradient(cx2, cardY, cx2, cardY + cardH);
      cGrad.addColorStop(0, "rgba(255,255,255,0.82)");
      cGrad.addColorStop(1, "rgba(255,255,255,0.50)");
      ctx.fillStyle = cGrad;
      roundRect(ctx, cx2, cardY, cardW, cardH, 18);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Border warna kartu
      const bGrad = ctx.createLinearGradient(cx2, cardY, cx2 + cardW, cardY + cardH);
      bGrad.addColorStop(0, stats[i].c1);
      bGrad.addColorStop(1, stats[i].c2);
      ctx.strokeStyle = bGrad;
      ctx.lineWidth = 2.5;
      roundRect(ctx, cx2, cardY, cardW, cardH, 18);
      ctx.stroke();

      // Nilai
      ctx.font = "bold 22px sans-serif";
      ctx.fillStyle = "#3d2260";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(255,255,255,0.95)";
      ctx.shadowBlur = 6;
      ctx.fillText(stats[i].value, cx2 + cardW / 2, cardY + 35);
      ctx.shadowBlur = 0;

      // Label
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#8B6BAE";
      ctx.fillText(stats[i].label, cx2 + cardW / 2, cardY + 60);
    }

    ctx.textAlign = "left";

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

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

function drawStar(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
    ctx.lineTo(
      Math.cos(angle + Math.PI / 4) * (size * 0.35),
      Math.sin(angle + Math.PI / 4) * (size * 0.35)
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
