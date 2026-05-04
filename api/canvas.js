const { createCanvas, loadImage } = require("canvas");

module.exports = async (req, res) => {
  try {
    const {
      name = "User",
      uang = "0",
      limit = "0",
      rank = "Member",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent = "#7c3aed"
    } = req.query;

    const width = 800;
    const height = 400;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // =========================
    // SAFE COLOR
    // =========================
    const safeAccent = /^#([0-9A-F]{3}){1,2}$/i.test(accent)
      ? accent
      : "#7c3aed";

    // =========================
    // BACKGROUND
    // =========================
    try {
      if (background) {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, width, height);
      } else throw "no-bg";
    } catch {
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, 0, width, height);
    }

    // overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(0,0,0,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // =========================
    // CARD
    // =========================
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;

    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // =========================
    // AVATAR
    // =========================
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }

    const size = 100;
    const ax = cardX + 30;
    const ay = cardY + 30;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(avatarImg, ax, ay, size, size);
    ctx.restore();

    // =========================
    // TEXT
    // =========================
    const textX = ax + size + 30;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";

    const safeName = limitText(ctx, name, 400);
    ctx.fillText(safeName, textX, ay + 40);

    // =========================
    // INFO
    // =========================
    const info = [
      ["Uang", uang],
      ["Limit", limit],
      ["Rank", rank],
    ];

    let y = ay + 85;

    info.forEach(([label, value]) => {
      ctx.font = "14px Arial";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(label, textX, y);

      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(value, textX, y + 22);

      y += 55;
    });

    // =========================
    // ACCENT LINE
    // =========================
    const acc = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
    acc.addColorStop(0, safeAccent);
    acc.addColorStop(1, "#ffffff");

    ctx.fillStyle = acc;
    roundRect(ctx, cardX, cardY + cardH - 8, cardW, 8, 8);
    ctx.fill();

    // =========================
    // OUTPUT
    // =========================
    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// HELPERS
// =========================
function roundRect(ctx, x, y, w, h, r = 10) {
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

function limitText(ctx, text, maxWidth) {
  while (ctx.measureText(text).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text;
}