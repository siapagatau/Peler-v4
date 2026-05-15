const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// ========== KONSTANTA DEFAULT (settings.ts) ==========
const DEFAULT_SETTINGS = {
  canvasHeight: 500,
  canvasWidth: 1000,
  fontSize: 120,
  horizontalTilt: -0.15,
  textBaseLine: 0.58,
  graphOffset: { X: 0, Y: 0 },
  paddingX: 20,
  // Hollow path: 4 titik relatif terhadap 500x500 (bentuk potongan)
  hollowPath: [
    [240, 240],
    [260, 240],
    [260, 260],
    [240, 260]
  ]
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
      fontSize = String(DEFAULT_SETTINGS.fontSize),
      tilt = String(DEFAULT_SETTINGS.horizontalTilt),
      transparent = "false",
      graphOffsetX = String(DEFAULT_SETTINGS.graphOffset.X),
      graphOffsetY = String(DEFAULT_SETTINGS.graphOffset.Y),
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSize) || DEFAULT_SETTINGS.fontSize));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || DEFAULT_SETTINGS.horizontalTilt));
    const isTransparent = transparent === "true" || bg === "transparent" || bg === "none";
    const offsetX = parseInt(graphOffsetX) || DEFAULT_SETTINGS.graphOffset.X;
    const offsetY = parseInt(graphOffsetY) || DEFAULT_SETTINGS.graphOffset.Y;

    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");
    const bgColor = isTransparent ? null : safeColor(bg, "#ffffff");

    const canvasHeight = DEFAULT_SETTINGS.canvasHeight;
    const baseCanvasWidth = DEFAULT_SETTINGS.canvasWidth;
    const baselineY = canvasHeight * DEFAULT_SETTINGS.textBaseLine;
    const padding = DEFAULT_SETTINGS.paddingX;

    const fontDef = `bold ${fSize}px ${FONT_STACK}`;

    // Ukur teks
    const mockCanvas = createCanvas(10, 10);
    const mockCtx = mockCanvas.getContext("2d");
    mockCtx.font = fontDef;
    const metricsL = mockCtx.measureText(textL);
    const metricsR = mockCtx.measureText(textR);

    // Lebar efektif setelah tilt (shear)
    const effectiveWidthL = (metrics) =>
      metrics.width - (baselineY + (metrics.fontBoundingBoxDescent || fSize * 0.15)) * shear;
    const effectiveWidthR = (metrics) =>
      metrics.width + (baselineY - (metrics.fontBoundingBoxAscent || fSize * 0.9)) * shear;

    let textWidthL = effectiveWidthL(metricsL);
    let textWidthR = effectiveWidthR(metricsR);

    // Hitung lebar kiri & kanan canvas dinamis (minimal setengah dari baseCanvasWidth)
    let canvasWidthL = Math.max(baseCanvasWidth / 2, textWidthL + padding);
    let canvasWidthR = Math.max(baseCanvasWidth / 2, textWidthR + padding);
    let totalWidth = canvasWidthL + canvasWidthR;

    // Posisi tengah (garis pemisah antara teks kiri dan kanan)
    const centerX = canvasWidthL;

    // Buat canvas utama
    const canvas = createCanvas(totalWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Background (jika tidak transparan)
    if (!isTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalWidth, canvasHeight);
    }

    // 1. Teks kiri (biru) dengan shear
    ctx.save();
    ctx.font = fontDef;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    ctx.setTransform(1, 0, shear, 1, 0, 0);
    ctx.fillText(textL, centerX, baselineY);
    ctx.resetTransform();
    ctx.restore();

    // 2. Halo (di atas teks kiri)
    if (_haloImg) {
      const haloSize = canvasHeight;
      const haloX = centerX - haloSize / 2 + offsetX;
      const haloY = offsetY;
      ctx.drawImage(_haloImg, haloX, haloY, haloSize, haloSize);
    }

    // 3. Teks kanan (hitam) dengan stroke putih & fill
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

    // 4. Hollow path (polygon dari settings)
    const graphX = centerX - canvasHeight / 2 + offsetX;
    const graphY = offsetY;
    ctx.beginPath();
    const points = DEFAULT_SETTINGS.hollowPath;
    for (let i = 0; i < points.length; i++) {
      const x = graphX + (points[i][0] / 500) * canvasHeight;
      const y = graphY + (points[i][1] / 500) * canvasHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (isTransparent) {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.fillStyle = "white";
    ctx.fill();
    if (isTransparent) {
      ctx.globalCompositeOperation = "source-over";
    }

    // 5. Cross (di atas semua)
    if (_crossImg) {
      const crossSize = canvasHeight;
      const crossX = centerX - crossSize / 2 + offsetX;
      const crossY = offsetY;
      ctx.drawImage(_crossImg, crossX, crossY, crossSize, crossSize);
    }

    // ----- CROP ke area teks aktif (jika lebih kecil dari totalWidth) -----
    let cropX, cropWidth;
    if (textWidthL + padding < baseCanvasWidth / 2 || textWidthR + padding < baseCanvasWidth / 2) {
      // Hitung batas kiri teks kiri dan batas kanan teks kanan
      const leftBound = centerX - textWidthL - padding;
      const rightBound = centerX + textWidthR + padding;
      cropX = leftBound;
      cropWidth = rightBound - leftBound;
    } else {
      cropX = 0;
      cropWidth = totalWidth;
    }

    const outputCanvas = createCanvas(cropWidth, canvasHeight);
    const outputCtx = outputCanvas.getContext("2d");
    outputCtx.drawImage(canvas, cropX, 0, cropWidth, canvasHeight, 0, 0, cropWidth, canvasHeight);

    res.setHeader("Content-Type", "image/png");
    res.send(outputCanvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[logo handler]", err);
    res.status(500).json({ error: err.message });
  }
};
