const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// ========== KONSTANTA (sama dengan settings.ts) ==========
const SETTINGS = {
  canvasHeight: 500,
  canvasWidth: 1000,
  fontSize: 120,
  horizontalTilt: -0.15,
  textBaseLine: 0.58,
  graphOffset: { X: 0, Y: 0 },
  paddingX: 20,
};

// ========== PATH ASET ==========
const ASSET_DIR = path.resolve(__dirname, "../assetba");
const p = (f) => path.join(ASSET_DIR, f);

// ========== FONT ==========
const FONT_STACK = "RoGSanSrfStd-Bd, GlowSansSC-Normal-Heavy, sans-serif";
try {
  const fonts = [
    [p("RoGSanSrfStd-Bd.otf"), "RoGSanSrfStd-Bd"],
    [p("GlowSansSC-Normal-Heavy.otf"), "GlowSansSC-Normal-Heavy"]
  ];
  for (const [full, alias] of fonts) {
    if (fs.existsSync(full)) {
      GlobalFonts.register(fs.readFileSync(full), alias);
      console.log(`[logo] Font loaded: ${path.basename(full)} as "${alias}"`);
    }
  }
} catch (e) {
  console.warn("[logo] Font load warning:", e.message);
}

// ========== PRELOAD GAMBAR ==========
let _haloImg = null;
let _crossImg = null;

async function preloadAssets() {
  for (const [file, varName] of [["halo.png", "_haloImg"], ["cross.png", "_crossImg"]]) {
    const full = p(file);
    if (fs.existsSync(full)) {
      try {
        const img = await loadImage(full);
        if (varName === "_haloImg") _haloImg = img;
        if (varName === "_crossImg") _crossImg = img;
        console.log(`[logo] ${file} loaded`);
      } catch (e) {
        console.warn(`[logo] Failed to load ${file}:`, e.message);
      }
    } else {
      console.warn(`[logo] ${file} not found at:`, full);
    }
  }
}
preloadAssets();

// ========== HELPER ==========
function safeColor(c, fallback) {
  return /^#[0-9A-Fa-f]{3,8}$/i.test(c) ? c : fallback;
}

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      textL = "Blue",
      textR = "Archive",
      colorL = "#128AFA",
      colorR = "#2B2B2B",
      bg = "#ffffff",
      fontSize = String(SETTINGS.fontSize),
      tilt = String(SETTINGS.horizontalTilt),
      transparent = "false",
      graphOffsetX = String(SETTINGS.graphOffset.X),
      graphOffsetY = String(SETTINGS.graphOffset.Y),
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSize) || SETTINGS.fontSize));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || SETTINGS.horizontalTilt));
    const isTransparent = transparent === "true" || bg === "transparent" || bg === "none";
    const offsetX = parseInt(graphOffsetX) || SETTINGS.graphOffset.X;
    const offsetY = parseInt(graphOffsetY) || SETTINGS.graphOffset.Y;

    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");
    const bgColor = isTransparent ? null : safeColor(bg, "#ffffff");

    const canvasHeight = SETTINGS.canvasHeight;
    const baseCanvasWidth = SETTINGS.canvasWidth;
    const baselineY = canvasHeight * SETTINGS.textBaseLine;
    const padding = SETTINGS.paddingX;

    const fontDef = `bold ${fSize}px ${FONT_STACK}`;

    // Ukur teks
    const mockCanvas = createCanvas(10, 10);
    const mockCtx = mockCanvas.getContext("2d");
    mockCtx.font = fontDef;
    const metricsL = mockCtx.measureText(textL);
    const metricsR = mockCtx.measureText(textR);

    const descent = metricsL.fontBoundingBoxDescent || fSize * 0.15;
    const ascent = metricsR.fontBoundingBoxAscent || fSize * 0.9;
    const textWidthL = metricsL.width - (baselineY + descent) * shear;
    const textWidthR = metricsR.width + (baselineY - ascent) * shear;

    let canvasWidthL = Math.max(baseCanvasWidth / 2, textWidthL + padding);
    let canvasWidthR = Math.max(baseCanvasWidth / 2, textWidthR + padding);
    const totalWidth = canvasWidthL + canvasWidthR;
    const centerX = canvasWidthL;

    const canvas = createCanvas(totalWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Background
    if (!isTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalWidth, canvasHeight);
    }

    // Teks kiri (biru)
    ctx.save();
    ctx.font = fontDef;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    ctx.setTransform(1, 0, shear, 1, 0, 0);
    ctx.fillText(textL, centerX, baselineY);
    ctx.resetTransform();
    ctx.restore();

    // Halo
    if (_haloImg) {
      const haloSize = canvasHeight;
      const haloX = centerX - haloSize / 2 + offsetX;
      const haloY = offsetY;
      ctx.drawImage(_haloImg, haloX, haloY, haloSize, haloSize);
    }

    // Teks kanan (hitam) + stroke putih
    ctx.save();
    ctx.font = fontDef;
    ctx.textAlign = "start";
    ctx.strokeStyle = "white";
    ctx.lineWidth = Math.max(4, fSize * 0.09);
    ctx.lineJoin = "round";
    ctx.setTransform(1, 0, shear, 1, 0, 0);

    if (isTransparent) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeText(textR, centerX, baselineY);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.strokeText(textR, centerX, baselineY);
    }

    ctx.fillStyle = colorR;
    ctx.fillText(textR, centerX, baselineY);
    ctx.resetTransform();
    ctx.restore();

    // ========== HOLLOW PATH: PARALLELOGRAM TIPIS VERTIKAL (efek lancip) ==========
    const slantWidth = Math.abs(shear) * canvasHeight * 0.8; // lebar potongan
    const halfSlant = slantWidth / 2;
    // Offset horizontal karena shear membuat parallelogram miring
    const shearOffset = shear * canvasHeight;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX - halfSlant, 0);
    ctx.lineTo(centerX + halfSlant, 0);
    ctx.lineTo(centerX + halfSlant + shearOffset, canvasHeight);
    ctx.lineTo(centerX - halfSlant + shearOffset, canvasHeight);
    ctx.closePath();
    
    if (isTransparent) {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // Cross (di atas semua)
    if (_crossImg) {
      const crossSize = canvasHeight;
      const crossX = centerX - crossSize / 2 + offsetX;
      const crossY = offsetY;
      ctx.drawImage(_crossImg, crossX, crossY, crossSize, crossSize);
    }

    // Crop seperti generateImg()
    let outputCanvas;
    if (textWidthL + padding < baseCanvasWidth / 2 || textWidthR + padding < baseCanvasWidth / 2) {
      const cropWidth = textWidthL + textWidthR + padding * 2;
      const cropX = baseCanvasWidth / 2 - textWidthL - padding;
      outputCanvas = createCanvas(cropWidth, canvasHeight);
      const outCtx = outputCanvas.getContext("2d");
      outCtx.drawImage(canvas, cropX, 0, cropWidth, canvasHeight, 0, 0, cropWidth, canvasHeight);
    } else {
      outputCanvas = canvas;
    }

    res.setHeader("Content-Type", "image/png");
    res.send(outputCanvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[logo handler]", err);
    res.status(500).json({ error: err.message });
  }
};
