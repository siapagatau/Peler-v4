const { createCanvas, loadImage } = require("@napi-rs/canvas");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: 'Gunakan type="profile"' });
  }

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
    // BACKGROUND
    // =========================
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, width, height);
      } catch {
        ctx.fillStyle = "#1e1e2e";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, 0, width, height);
    }

    // Overlay gradient soft
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(0,0,0,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // =========================
    // CARD (glass)
    // =========================
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;

    roundRect(ctx, cardX, cardY, cardW, cardH, 20, true, true);

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

    // glow
    ctx.shadowColor = accent;
    ctx.shadowBlur = 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, ax, ay, size, size);
    ctx.restore();

    ctx.shadowBlur = 0;

    // =========================
    // TEXT
    // =========================
    ctx.fillStyle = "#ffffff";

    // Nama
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(name, ax + size + 30, ay + 40);

    // =========================
    // INFO BOX
    // =========================
    const infoX = ax + size + 30;
    let infoY = ay + 80;

    const info = [
      ["Uang", uang],
      ["Limit", limit],
      ["Rank", rank],
    ];

    info.forEach(([label, value]) => {
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(label, infoX, infoY);

      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(value, infoX, infoY + 25);

      infoY += 60;
    });

    // =========================
    // ACCENT BAR (gradient)
    // =========================
    const acc = ctx.createLinearGradient(0, 0, 200, 0);
    acc.addColorStop(0, accent);
    acc.addColorStop(1, "#ffffff");

    ctx.fillStyle = acc;
    roundRect(ctx, cardX, cardY + cardH - 10, cardW, 10, 10, true, false);

    // =========================
    // OUTPUT
    // =========================
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// helper rounded rectangle
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