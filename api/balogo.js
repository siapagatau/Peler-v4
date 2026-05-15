const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// ========== SETTINGS (sama persis dengan file settings asli) ==========
const settings = {
  canvasHeight: 250,
  canvasWidth: 900,
  fontSize: 84,
  textBaseLine: 0.68,
  horizontalTilt: -0.4,
  paddingX: 10,
  graphOffset: { X: -15, Y: 0 },
  hollowPath: [
    [284, 136],
    [321, 153],
    [159, 410],
    [148, 403],
  ],
};

const {
  canvasHeight,
  canvasWidth,
  fontSize,
  horizontalTilt,
  textBaseLine,
  graphOffset: defaultGraphOffset,
  paddingX,
  hollowPath,
} = settings;

// ========== PATH ASET ==========
const ASSET_DIR = path.resolve(__dirname, "../assetba");
const p = (f) => path.join(ASSET_DIR, f);

// ========== FONT STACK (sama persis) ==========
const FONT_STACK = `${fontSize}px RoGSanSrfStd-Bd, GlowSansSC-Normal-Heavy_diff, apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`;

// Load font
try {
  const fonts = [
    [p("RoGSanSrfStd-Bd.otf"), "RoGSanSrfStd-Bd"],
    [p("GlowSansSC-Normal-Heavy.otf"), "GlowSansSC-Normal-Heavy_diff"]
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
  const haloPath = p("halo.png");
  const crossPath = p("cross.png");
  const promises = [];
  if (fs.existsSync(haloPath)) {
    promises.push(loadImage(haloPath).then(img => { _haloImg = img; }));
  } else {
    console.warn("[logo] halo.png not found at:", haloPath);
  }
  if (fs.existsSync(crossPath)) {
    promises.push(loadImage(crossPath).then(img => { _crossImg = img; }));
  } else {
    console.warn("[logo] cross.png not found at:", crossPath);
  }
  await Promise.all(promises);
}

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
    await preloadAssets();

    let {
      textL = "Blue",
      textR = "Archive",
      colorL = "#128AFA",
      colorR = "#2B2B2B",
      bg = "#ffffff",
      fontSize: fontSizeParam = String(fontSize),
      tilt = String(horizontalTilt),
      transparent = "false",
      graphOffsetX = String(defaultGraphOffset.X),
      graphOffsetY = String(defaultGraphOffset.Y),
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSizeParam) || fontSize));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || horizontalTilt));
    const isTransparent = transparent === "true" || bg === "transparent" || bg === "none";
    const offsetX = parseInt(graphOffsetX) || defaultGraphOffset.X;
    const offsetY = parseInt(graphOffsetY) || defaultGraphOffset.Y;
    const graphOffset = { X: offsetX, Y: offsetY };

    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");
    const bgColor = isTransparent ? null : safeColor(bg, "#ffffff");

    const baselineY = canvasHeight * textBaseLine;
    const fontDef = `${fSize}px ${FONT_STACK.split(' ').slice(1).join(' ')}`; // ambil stack font tanpa ukuran

    // Ukur teks seperti di kode asli
    const mockCanvas = createCanvas(10, 10);
    const mockCtx = mockCanvas.getContext("2d");
    mockCtx.font = fontDef;
    const metricsL = mockCtx.measureText(textL);
    const metricsR = mockCtx.measureText(textR);

    // Hitung textWidthL dan textWidthR persis seperti setWidth()
    const descent = metricsL.fontBoundingBoxDescent || fSize * 0.15;
    const ascent = metricsR.fontBoundingBoxAscent || fSize * 0.85;
    let textWidthL = metricsL.width - (baselineY + descent) * shear;
    let textWidthR = metricsR.width + (baselineY - ascent) * shear;

    // Tentukan canvasWidthL dan canvasWidthR (setWidth)
    let canvasWidthL, canvasWidthR;
    if (textWidthL + paddingX > canvasWidth / 2) {
      canvasWidthL = textWidthL + paddingX;
    } else {
      canvasWidthL = canvasWidth / 2;
    }
    if (textWidthR + paddingX > canvasWidth / 2) {
      canvasWidthR = textWidthR + paddingX;
    } else {
      canvasWidthR = canvasWidth / 2;
    }
    const totalWidth = canvasWidthL + canvasWidthR;
    const centerX = canvasWidthL; // sama dengan this.canvasWidthL

    const canvas = createCanvas(totalWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, totalWidth, canvasHeight);

    // Background
    if (!isTransparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalWidth, canvasHeight);
    }

    // 1. Teks kiri (Blue)
    ctx.save();
    ctx.font = fontDef;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    ctx.setTransform(1, 0, shear, 1, 0, 0);
    ctx.fillText(textL, centerX, baselineY);
    ctx.resetTransform();
    ctx.restore();

    // 2. Halo
    if (_haloImg) {
      const haloSize = canvasHeight;
      const haloX = centerX - haloSize / 2 + graphOffset.X;
      const haloY = graphOffset.Y;
      ctx.drawImage(_haloImg, haloX, haloY, haloSize, haloSize);
    }

    // 3. Teks kanan (Archive) dengan stroke putih
    ctx.save();
    ctx.font = fontDef;
    ctx.textAlign = "start";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 12; // sesuai kode asli
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

    // 4. Hollow path (persis seperti di kode asli, hanya 4 titik)
    const graph = {
      X: centerX - canvasHeight / 2 + graphOffset.X,
      Y: graphOffset.Y,
    };
    ctx.beginPath();
    const scale = canvasHeight / 500; // karena hollowPath skala 500
    ctx.moveTo(
      graph.X + hollowPath[0][0] * scale,
      graph.Y + hollowPath[0][1] * scale
    );
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(
        graph.X + hollowPath[i][0] * scale,
        graph.Y + hollowPath[i][1] * scale
      );
    }
    ctx.closePath();

    if (isTransparent) {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // 5. Cross
    if (_crossImg) {
      const crossSize = canvasHeight;
      const crossX = centerX - crossSize / 2 + graphOffset.X;
      const crossY = graphOffset.Y;
      ctx.drawImage(_crossImg, crossX, crossY, crossSize, crossSize);
    }

    // 6. Crop seperti generateImg()
    let outputCanvas;
    if (textWidthL + paddingX < canvasWidth / 2 || textWidthR + paddingX < canvasWidth / 2) {
      const cropWidth = textWidthL + textWidthR + paddingX * 2;
      const cropX = canvasWidth / 2 - textWidthL - paddingX;
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
