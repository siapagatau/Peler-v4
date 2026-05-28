const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// ========== FONT LOADING ==========
let fontLoaded = false;
try {
  GlobalFonts.register(
    fs.readFileSync(path.join(process.cwd(), "assets/fonts/Value.ttf")),
    "ValueFont"
  );
  fontLoaded = true;
} catch (e) {
  console.warn("[subtitle] Font Value.ttf not found, falling back to sans-serif:", e.message);
}

const FONT_FAMILY = fontLoaded ? "ValueFont" : "sans-serif";

// ========== TEXT WRAP ==========
/**
 * Wrap text into lines based on pixel width measured by canvas ctx.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth - max pixel width per line
 * @returns {string[]}
 */
function wrapTextPixel(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If a single word is too wide, push it anyway
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      text = "Masukkan teks subtitle di sini.",
      image: imageUrl = "",
    } = req.query;

    if (!imageUrl) {
      return res.status(400).json({ error: "Parameter 'image' (URL) wajib diisi." });
    }

    // ---- Load base image ----
    let baseImg;
    try {
      baseImg = await loadImage(imageUrl);
    } catch (e) {
      return res.status(400).json({ error: "Gagal load gambar: " + e.message });
    }

    const w = baseImg.width;
    const h = baseImg.height;

    // ---- Canvas setup ----
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    // 1. Draw base image
    ctx.drawImage(baseImg, 0, 0, w, h);

    // ===============================
    // RESPONSIVE SIZE SYSTEM
    // ===============================
    const fontSize   = Math.max(24, Math.floor(w * 0.045)); // 4.5% lebar
    const maxWidth   = Math.floor(w * 0.85);
    const padding    = Math.max(15, Math.floor(w * 0.03));
    const bottomMargin = Math.floor(h * 0.035);             // 3.5% dari bawah
    const lineHeight = Math.floor(fontSize * 1.35);

    // ---- Measure wrapped lines ----
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    const lines = wrapTextPixel(ctx, text.trim(), maxWidth);

    // Total height of the text block
    const textBlockH = lines.length * lineHeight;

    // ---- Box dimensions ----
    const boxHeight = textBlockH + padding * 2;
    let boxY = h - boxHeight - bottomMargin;
    if (boxY < 0) boxY = h - boxHeight; // safety

    // ===============================
    // 2. Draw semi-transparent box
    // ===============================
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, boxY, w, boxHeight);

    // ===============================
    // 3. Draw subtitle text
    // ===============================
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Optional: subtle text shadow for legibility
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const textStartY = boxY + padding;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, textStartY + i * lineHeight);
    }

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // ---- Output as PNG ----
    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[subtitle handler]", err);
    res.status(500).json({ error: err.message });
  }
};
