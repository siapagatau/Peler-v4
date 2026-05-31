const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
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
} catch (e) { console.log("[subtitle] FONT ERROR:", e.message); }

const F = (size, bold = true) =>
  `${bold ? "bold" : "normal"} ${size}px ${hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold"}`;

// ── TEXT WRAP ────────────────────────────────────────────────
function wrapTextPixel(ctx, text, maxWidth) {
  const hardLines = String(text).split("\n");
  const result = [];

  for (const hard of hardLines) {
    if (hard.trim() === "") {
      result.push("");
      continue;
    }

    const words = hard.split(" ");
    let cur = "";

    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (cur) { result.push(cur); cur = ""; }
        let charLine = "";
        for (const char of word) {
          const testChar = charLine + char;
          if (ctx.measureText(testChar).width > maxWidth && charLine) {
            result.push(charLine);
            charLine = char;
          } else {
            charLine = testChar;
          }
        }
        if (charLine) cur = charLine;
        continue;
      }

      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && cur) {
        result.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }

    if (cur) result.push(cur);
  }

  return result;
}

// ── MAIN HANDLER ─────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      text     = "Masukkan teks subtitle di sini.",
      image: imageUrl = "",
    } = req.query;

    if (!imageUrl) {
      return res.status(400).json({ error: "Parameter 'image' (URL) wajib diisi." });
    }

    let baseImg;
    try {
      baseImg = await loadImage(imageUrl);
    } catch (e) {
      return res.status(400).json({ error: "Gagal load gambar: " + e.message });
    }

    const w = baseImg.width;
    const h = baseImg.height;

    const canvas = createCanvas(w, h);
    const ctx    = canvas.getContext("2d");

    ctx.drawImage(baseImg, 0, 0, w, h);

    // ── RESPONSIVE SIZE SYSTEM ────────────────────────────────
    const fontSize     = Math.max(24, Math.floor(w * 0.045));
    const padding      = Math.max(6, Math.floor(fontSize * 0.25));
    const bottomMargin = Math.floor(h * 0.035);
    const lineHeight   = Math.floor(fontSize * 1.2);

    ctx.font = F(fontSize, true);

    const maxWidth = Math.floor(w * 0.85) - padding * 2;

    const cleanText = text.replace(/\\n/g, "\n").trim();
    const lines = wrapTextPixel(ctx, cleanText, maxWidth);

    const textBlockH = lines.length * lineHeight;

    // ---- Box dimensions ----
    const boxHeight = textBlockH + padding * 2;
    let boxY = h - boxHeight - bottomMargin;
    if (boxY < 0) boxY = 0;

    // Semi-transparent box
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, boxY, w, boxHeight);

    // Subtitle text
    ctx.font         = F(fontSize, true);
    ctx.fillStyle    = "#ffffff";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor   = "rgba(0,0,0,0.85)";
    ctx.shadowBlur    = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const textStartY = boxY + padding + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, textStartY + i * lineHeight);
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur  = 0;

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[subtitle handler]", err);
    res.status(500).json({ error: err.message });
  }
};