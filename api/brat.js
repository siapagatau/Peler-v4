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
    // Kata sendirian aja udah lebih lebar dari maxWidth (mis. URL/teks
    // tanpa spasi) -> pecah per-karakter biar gak meluber ke samping
    if (ctx.measureText(word).width > maxWidth) {
      if (currentLine) { lines.push(currentLine); currentLine = ""; }
      let chunk = "";
      for (const ch of word) {
        const testChunk = chunk + ch;
        if (ctx.measureText(testChunk).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = testChunk;
        }
      }
      currentLine = chunk;
      continue;
    }

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

// Gambar 1 baris dengan justify: spasi antar kata di-stretch biar
// baris penuh sampe maxWidth (kecuali baris terakhir / baris 1 kata,
// itu dibiarin rata kiri biasa). Ini yang bikin tampilan brat asli
// punya jarak antar kata yang gak rata (ganteng  buah, apa  yg  paling, dst).
function drawJustifiedLine(ctx, line, x, y, maxWidth, justify) {
  const words = line.split(" ");

  if (!justify || words.length === 1) {
    ctx.fillText(line, x, y);
    return;
  }

  const totalWordsWidth = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
  const gapCount  = words.length - 1;
  const totalGap  = maxWidth - totalWordsWidth;
  const gapWidth  = totalGap / gapCount;

  let cx = x;
  for (const word of words) {
    ctx.fillText(word, cx, y);
    cx += ctx.measureText(word).width + gapWidth;
  }
}

// Cari font size terbesar yang bikin teks (setelah di-wrap) tetep muat
// di dalam kotak (maxWidth x maxHeight) yang tersedia. Ini yang bikin
// teks pendek ("tes") dapet font gede dan nyisa banyak ruang kosong,
// sementara teks panjang otomatis ngecil biar semua baris tetep muat —
// PAS kayak referensi brat asli, bukan canvas yang tingginya ngikutin teks.
function fitBratText(ctx, text, maxWidth, maxHeight, maxFont, minFont, step = 2) {
  let fontSize = maxFont;
  let lines = [text];
  let lineHeight = Math.floor(fontSize * 1.2);

  while (fontSize > minFont) {
    ctx.font = F(fontSize);
    lines = wrapText(ctx, text, maxWidth);
    lineHeight = Math.floor(fontSize * 1.2);

    if (lines.length * lineHeight <= maxHeight) break;
    fontSize -= step;
  }

  fontSize = Math.max(fontSize, minFont);
  ctx.font = F(fontSize);
  lines = wrapText(ctx, text, maxWidth);
  lineHeight = Math.floor(fontSize * 1.2);

  return { fontSize, lines, lineHeight };
}

// Render canvas brat: canvas PERSEGI TETAP (gak ngikutin panjang teks),
// background putih, teks hitam rata kiri-atas, font auto-shrink biar muat.
function renderBratCanvas(text, size) {
  const PADDING   = Math.round(size * 0.06);
  const maxWidth  = size - PADDING * 2;
  const maxHeight = size - PADDING * 2;
  const maxFont   = Math.round(size * 0.30); // cap atas, kecocokan sama contoh teks pendek ("tes")
  const minFont   = Math.round(size * 0.025);

  // Canvas sementara cuma buat ngukur teks
  const measure    = createCanvas(size, 10);
  const measureCtx = measure.getContext("2d");

  let { fontSize, lines, lineHeight } = fitBratText(measureCtx, text, maxWidth, maxHeight, maxFont, minFont);

  // Safety net: kalau teks tetep gak muat walau udah di font minimum
  // (teks super panjang), tinggi canvas ditambah dikit biar gak kepotong.
  const neededHeight = lines.length * lineHeight + PADDING * 2;
  const height = Math.max(size, neededHeight);

  const canvas = createCanvas(size, height);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, height);

  ctx.fillStyle = "#000000";
  ctx.font = F(fontSize);
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    const isLastLine = i === lines.length - 1;
    drawJustifiedLine(ctx, line, PADDING, PADDING + i * lineHeight, maxWidth, !isLastLine);
  });

  return canvas;
}

// ── HANDLER: brat ───────────────────────────────────────────
/**
 * Query params:
 *  text  - teks yang mau dirender (wajib)
 *  size  - ukuran canvas px, persegi (default 1000, max 2000)
 *          (param 'width' lama tetap diterima sebagai alias)
 *
 * Contoh:
 *  /api/brat?text=lol%20banget&size=1000
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let { text = "", size, width = "1000" } = req.query;
    text = String(text).trim();
    if (!text) return res.status(400).json({ error: "Parameter 'text' wajib diisi" });

    const S = Math.max(200, Math.min(2000, parseInt(size ?? width) || 1000));
    const canvas = renderBratCanvas(text, S);

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
