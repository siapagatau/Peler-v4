const { createCanvas, loadImage } = require("@napi-rs/canvas");
const path = require("path");

// ── UTILS ──────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

async function loadSafe(url) {
  if (!url) return null;
  try { return await loadImage(url); } catch { return null; }
}

// Crop & fill area tanpa gepeng (mirip object-fit: cover)
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, tr = w / h;
  let sx, sy, sw, sh;
  if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
  else         { sw = img.width;  sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    const { avatar = "" } = req.query || {};

    if (!avatar) {
      return res.status(400).json({ error: "Parameter 'avatar' wajib diisi" });
    }

    // Template tombstone, asset lokal di root project (../leave.jpg)
    // Teks "GOODBYE MEMBER:x" dkk sudah menyatu di gambar ini, jadi
    // di sini kita cuma tempel foto avatar-nya aja.
    const bgPath = path.join(process.cwd(), "leave.jpg");
    const background = await loadImage(bgPath);

    const canvas = createCanvas(background.width, background.height);
    const ctx    = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // ⚠️ Sesuaikan koordinat frame ini dengan posisi kotak foto
    // di template leave.jpg kamu (ukur pakai editor gambar)
    const FRAME = { x: 100, y: 60, w: 165, h: 165, r: 6 };

    const avatarImg = await loadSafe(avatar);
    if (avatarImg) {
      ctx.save();
      rr(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, FRAME.r);
      ctx.clip();
      drawCover(ctx, avatarImg, FRAME.x, FRAME.y, FRAME.w, FRAME.h);
      ctx.restore();
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
