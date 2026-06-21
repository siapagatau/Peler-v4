const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const GIFEncoder = require("gifencoder");
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
function getFontSize(text, min = 30, max = 110) {
  return Math.max(min, Math.min(max, Math.floor(2200 / Math.sqrt(text.length || 1))));
}

// Render satu frame: canvas putih bujur sangkar, teks hitam rata tengah
function renderFrameCanvas(text, size) {
  const PADDING  = Math.round(size * 0.12);
  const maxWidth = size - PADDING * 2;

  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  if (text) {
    const fontSize   = getFontSize(text);
    const lineHeight = Math.floor(fontSize * 1.2);

    ctx.font = F(fontSize);
    const lines = wrapText(ctx, text, maxWidth);
    const totalHeight = lines.length * lineHeight;
    const startY = (size - totalHeight) / 2;

    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, PADDING, startY + i * lineHeight);
    });
  }

  return canvas;
}

// Susun frame-frame (kata muncul satu-satu) jadi buffer GIF
async function renderBratGif(text, size) {
  const words = text.trim().split(/\s+/);

  const encoder = new GIFEncoder(size, size);
  encoder.start();
  encoder.setRepeat(0);   // 0 = loop selamanya
  encoder.setQuality(10);

  // FRAME 0 — kosong
  encoder.setDelay(100);
  encoder.addFrame(renderFrameCanvas("", size).getContext("2d"));

  // FRAME PER KATA
  let combine = "";
  for (let i = 0; i < words.length; i++) {
    combine += (i > 0 ? " " : "") + words[i];
    const isLast = i === words.length - 1;

    encoder.setDelay(isLast ? 2500 : 500); // tahan lebih lama di frame terakhir
    encoder.addFrame(renderFrameCanvas(combine, size).getContext("2d"));
  }

  encoder.finish();
  return encoder.out.getData();
}

// ── HANDLER: bratvid ────────────────────────────────────────
/**
 * Query params:
 *  text - teks yang mau dianimasikan (wajib)
 *  size - ukuran canvas px, persegi (default 500, max 1000)
 *
 * Contoh:
 *  /api/bratvid?text=lol%20banget&size=500
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let { text = "", size = "500" } = req.query;
    text = String(text).trim();
    if (!text) return res.status(400).json({ error: "Parameter 'text' wajib diisi" });

    const S = Math.max(200, Math.min(1000, parseInt(size) || 500));
    const buffer = await renderBratGif(text, S);

    res.setHeader("Content-Type", "image/gif");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
