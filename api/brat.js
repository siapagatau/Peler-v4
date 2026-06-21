const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ────────────────────────────────────────────────────
let hasEmojiFont = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")), "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

const F = (size, bold = true) =>
  `${bold ? "bold" : "normal"} ${size}px ${hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold"}`;

// ── HELPERS ─────────────────────────────────────────────────
// Pecah teks jadi beberapa baris sesuai lebar maksimal canvas
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const { width } = ctx.measureText(testLine);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Auto-size font berdasarkan panjang teks
function getFontSize(text, min = 40, max = 160) {
  return Math.max(min, Math.min(max, Math.floor(2200 / Math.sqrt(text.length || 1))));
}

// Render canvas brat: background putih, teks hitam, rata kiri
function renderBratCanvas(text, width) {
  const PADDING    = Math.round(width * 0.06);
  const maxWidth   = width - PADDING * 2;
  const fontSize   = getFontSize(text);
  const lineHeight = Math.floor(fontSize * 1.2);

  // Canvas sementara cuma buat ngukur teks (tentuin jumlah baris & tinggi)
  const measure    = createCanvas(width, 10);
  const measureCtx = measure.getContext("2d");
  measureCtx.font  = F(fontSize);

  const lines  = wrapText(measureCtx, text, maxWidth);
  const height = Math.max(Math.round(width * 0.2), lines.length * lineHeight + PADDING * 2);

  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = F(fontSize);
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, PADDING, PADDING + i * lineHeight);
  });

  return canvas;
}

// ── HANDLER: brat ───────────────────────────────────────────
/**
 * Query params:
 *  text   - teks yang mau dirender (wajib)
 *  width  - lebar canvas px (default 1000, max 2000)
 *
 * Contoh:
 *  /api/brat?text=lol%20banget&width=1000
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let { text = "", width = "1000" } = req.query;
    text = String(text).trim();
    if (!text) return res.status(400).json({ error: "Parameter 'text' wajib diisi" });

    const W = Math.max(200, Math.min(2000, parseInt(width) || 1000));
    const canvas = renderBratCanvas(text, W);

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
