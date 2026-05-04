const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// =========================
// LOAD FONT (BUFFER MODE - PALING AMAN)
// =========================
try {
  const regular = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf"));
  const bold = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf"));

  GlobalFonts.register(regular, "Inter");
  GlobalFonts.register(bold, "InterBold");

  console.log("FONT LOADED:", GlobalFonts.families);
} catch (e) {
  console.log("FONT ERROR:", e.message);
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
      accent = "#7c3aed"
    } = req.query;

    // =========================
    // SAFE COLOR
    // =========================
    if (!accent || !/^#([0-9A-F]{3}){1,2}$/i.test(accent)) {
      accent = "#7c3aed";
    }

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

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

    const overlay = ctx.createLinearGradient(0, 0, width, height);
    overlay.addColorStop(0, "rgba(0,0,0,0.4)");
    overlay.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    // =========================
    // CARD
    // =========================
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.2;

    roundRect(ctx, cardX, cardY, cardW, cardH, 18, true, true);

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

    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, ax, ay, size, size);
    ctx.restore();

    ctx.shadowBlur = 0;

    // =========================
    // TEXT UTILS
    // =========================
    function limitText(text, maxWidth) {
      ctx.font = "bold 26px InterBold";
      while (ctx.measureText(text).width > maxWidth) {
        text = text.slice(0, -1);
      }
      return text;
    }

    const textX = ax + size + 30;

    // =========================
    // NAMA
    // =========================
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px InterBold";

    const safeName = limitText(name, 400);
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
      ctx.font = "14px Inter";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(label, textX, y);

      ctx.font = "bold 20px InterBold";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(value, textX, y + 22);

      y += 55;
    });

    // =========================
    // ACCENT
    // =========================
    const acc = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
    acc.addColorStop(0, accent);
    acc.addColorStop(1, "#ffffff");

    ctx.fillStyle = acc;
    roundRect(ctx, cardX, cardY + cardH - 8, cardW, 8, 8, true, false);

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

// =========================
// HELPER
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