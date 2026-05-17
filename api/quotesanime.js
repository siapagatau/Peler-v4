const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// ========== SETTINGS ==========
const settings = {
  canvasWidth: 1600,
  canvasHeight: 600,
  accentColor: "#f5c518",
  bgColor: "#0d0d0d",
  textColor: {
    character: "#f5c518",
    anime: "#ffffff",
    episode: "#aaaaaa",
    label: "#f5c518",
    quotes: "#eeeeee",
  },
  accentBar: {
    width: 6,
    height: 480,
    x: 560,
  },
  textX: 590,
  layout: {
    characterY: 100,
    animeY: 165,
    episodeY: 215,
    dividerY: 265,
    labelY: 285,
    quotesStartY: 320,
    quotesLineHeight: 40,
  },
  font: {
    character: 44,
    anime: 34,
    episode: 26,
    label: 22,
    quotes: 28,
  },
  quotesMaxChars: 55,
  quotesMaxLines: 3,
};

// ========== PATH ASET ==========
const ASSET_DIR = path.resolve(__dirname, "../assetba");
const p = (f) => path.join(ASSET_DIR, f);

// ========== FONT LOADING ==========
const FONT_FAMILY = "QuotesFont";
const FONT_FAMILY_FALLBACK = "sans-serif";

try {
  const fonts = [
    [p("RoGSanSrfStd-Bd.otf"), FONT_FAMILY],
    [p("GlowSansSC-Normal-Heavy.otf"), "GlowSansSC"],
  ];
  for (const [fullPath, alias] of fonts) {
    if (fs.existsSync(fullPath)) {
      GlobalFonts.register(fs.readFileSync(fullPath), alias);
      console.log(`[quotesanime] Font loaded: ${path.basename(fullPath)} as "${alias}"`);
    }
  }
} catch (e) {
  console.warn("[quotesanime] Font load warning:", e.message);
}

// SESUDAH: taruh Arial/DejaVu sebelum sans-serif, pastikan ada font system yang punya spasi
function fontStack(size) {
  return `${size}px ${FONT_FAMILY}, GlowSansSC, Arial, "Liberation Sans", DejaVu Sans, ${FONT_FAMILY_FALLBACK}`;
}

// ========== TEXT WRAP ==========
/**
 * Wrap text into lines with max character count.
 * Returns at most maxLines lines.
 */
function wrapText(text, maxChars, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If single word is longer than maxChars, still push it
      current = word.slice(0, maxChars);
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

// ========== GRADIENT OVERLAY ==========
/**
 * Draw a left-to-right gradient that transitions from transparent on the left
 * to solid bgColor on the right, starting at xStart and covering `width` pixels.
 */
function drawGradientOverlay(ctx, xStart, width, height, bgColor) {
  const grad = ctx.createLinearGradient(xStart, 0, xStart + width, 0);
  grad.addColorStop(0, bgColor + "00"); // transparent
  grad.addColorStop(1, bgColor + "ff"); // solid
  ctx.fillStyle = grad;
  ctx.fillRect(xStart, 0, width, height);
}

// ========== DROP SHADOW HELPER ==========
function withShadow(ctx, fn, { color = "rgba(0,0,0,0.7)", blur = 8, offsetX = 2, offsetY = 2 } = {}) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  fn();
  ctx.restore();
}

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      character = "Lelouch vi Britannia",
      anime = "Code Geass: Lelouch of the Rebellion",
      episode = "Episode 1 – The Day a New Demon Was Born",
      quotes = "The only ones who should kill are those who are prepared to be killed.",
      image: imageUrl = "",
      bg = settings.bgColor,
      accent = settings.accentColor,
    } = req.query;

    const {
      canvasWidth,
      canvasHeight,
      textX,
      layout,
      font,
      accentBar,
      quotesMaxChars,
      quotesMaxLines,
    } = settings;

    // Resolve accent & bg colors (simple hex validation)
    const accentColor = /^#[0-9A-Fa-f]{3,8}$/.test(accent) ? accent : settings.accentColor;
    const bgColor = /^#[0-9A-Fa-f]{3,8}$/.test(bg) ? bg : settings.bgColor;

    // ---- Canvas setup ----
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // 1. Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw character image (fit height = 600, gravity West)
    let charImgWidth = 0;
    if (imageUrl) {
      try {
        const img = await loadImage(imageUrl);
        const scale = canvasHeight / img.height;
        charImgWidth = Math.round(img.width * scale);
        ctx.drawImage(img, 0, 0, charImgWidth, canvasHeight);
      } catch (e) {
        console.warn("[quotesanime] Failed to load image:", e.message);
      }
    }

    // 3. Gradient overlay (900px wide from East side)
    // Mirrors: `(-size 900x600 gradient:"#0d0d0d00-#0d0d0dff" -flop) -gravity East -composite`
    // In canvas terms: gradient starts at (canvasWidth - 900) fading left→right transparent→solid
    const gradWidth = 900;
    const gradStartX = canvasWidth - gradWidth;
    drawGradientOverlay(ctx, gradStartX, gradWidth, canvasHeight, bgColor);

    // 4. Accent vertical bar
    // geometry +560+0, gravity West → x=560, centered vertically
    const barY = (canvasHeight - accentBar.height) / 2;
    ctx.fillStyle = accentColor;
    ctx.fillRect(accentBar.x, barY, accentBar.width, accentBar.height);

    // 5. Character name (yellow, large)
    withShadow(ctx, () => {
      ctx.font = fontStack(font.character);
      ctx.fillStyle = settings.textColor.character;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(character, textX, layout.characterY);
    });

    // 6. Anime title (white)
    withShadow(ctx, () => {
      ctx.font = fontStack(font.anime);
      ctx.fillStyle = settings.textColor.anime;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(anime, textX, layout.animeY);
    });

    // 7. Episode (grey)
    withShadow(ctx, () => {
      ctx.font = fontStack(font.episode);
      ctx.fillStyle = settings.textColor.episode;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(episode, textX, layout.episodeY);
    });

    // 8. Divider line (960x2, color #444444)
    ctx.fillStyle = "#444444";
    ctx.fillRect(textX, layout.dividerY, 960, 2);

    // 9. "QUOTES" label
    withShadow(ctx, () => {
      ctx.font = fontStack(font.label);
      ctx.fillStyle = settings.textColor.label;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText("QUOTES", textX, layout.labelY);
    });

    // 10. Quotes text (wrapped)
    const lines = wrapText(quotes, quotesMaxChars, quotesMaxLines);
    ctx.font = fontStack(font.quotes);
    ctx.fillStyle = settings.textColor.quotes;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    for (let i = 0; i < lines.length; i++) {
      const y = layout.quotesStartY + i * layout.quotesLineHeight;
      withShadow(ctx, () => {
        ctx.font = fontStack(font.quotes);
        ctx.fillStyle = settings.textColor.quotes;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillText(lines[i], textX, y);
      });
    }

    // 11. Output as PNG
    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[quotesanime handler]", err);
    res.status(500).json({ error: err.message });
  }
};
