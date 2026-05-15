const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONT SETUP ───────────────────────────────────────────────
const FONT_STACK = "BlueArchive, InterBold, sans-serif";

try {
  const candidates = [
    ["fonts/RoGSanSrfStd-Bd.otf",             "BlueArchive"],
    ["fonts/GlowSansSC-Normal-Heavy_diff.otf", "BlueArchive"],
    ["fonts/Inter-Bold.ttf",                    "InterBold"],
  ];
  for (const [rel, alias] of candidates) {
    const full = path.join(process.cwd(), rel);
    if (fs.existsSync(full)) {
      GlobalFonts.register(fs.readFileSync(full), alias);
    }
  }
} catch (e) {
  console.warn("[logo] Font load warning:", e.message);
}

// ── SETTINGS ─────────────────────────────────────────────────
const SETTINGS = {
  canvasHeight:    200,
  canvasWidth:     800,
  fontSize:        130,
  horizontalTilt:  -0.15,
  textBaseLine:    0.78,
  paddingX:        40,
  graphOffset:     { X: 0, Y: 0 },

  hollowPath: [
    [214, 0],
    [500, 0],
    [286, 500],
    [0,   500],
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
function effectiveWidthL(metrics, tilt, canvasH, baseLine) {
  return (
    metrics.width -
    (baseLine * canvasH + metrics.fontBoundingBoxDescent) * tilt
  );
}
function effectiveWidthR(metrics, tilt, canvasH, baseLine) {
  return (
    metrics.width +
    (baseLine * canvasH - metrics.fontBoundingBoxAscent) * tilt
  );
}
function applyShear(ctx, tilt) {
  ctx.setTransform(1, 0, tilt, 1, 0, 0);
}

// ── MAIN HANDLER ──────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      textL      = "Blue",
      textR      = "Archive",
      colorL     = "#128AFA",
      colorR     = "#2B2B2B",
      bg         = "#ffffff",
      fontSize   = String(SETTINGS.fontSize),
      tilt       = String(SETTINGS.horizontalTilt),
      halo       = "",
      cross      = "",
      haloScale  = "1.5",    // baru: perbesar halo
      crossScale = "1.5",    // baru: perbesar cross
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSize) || SETTINGS.fontSize));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || SETTINGS.horizontalTilt));
    const hScale = Math.max(0.5, Math.min(3, parseFloat(haloScale) || 1.5));
    const cScale = Math.max(0.5, Math.min(3, parseFloat(crossScale) || 1.5));
    const CH    = SETTINGS.canvasHeight;
    const pad   = SETTINGS.paddingX;
    const bLine = SETTINGS.textBaseLine;
    const font  = `bold ${fSize}px ${FONT_STACK}`;

    const safeColor = (c, fallback) =>
      /^#[0-9A-Fa-f]{3,8}$/.test(c) ? c : fallback;
    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");

    const transparent = bg === "transparent" || bg === "none";
    if (!transparent) bg = safeColor(bg, "#ffffff");

    // ── Ukur teks ─────────────────────────────────────────────
    const measure = createCanvas(10, 10);
    const mc = measure.getContext("2d");
    mc.font = font;
    const mL = mc.measureText(textL);
    const mR = mc.measureText(textR);

    const twL = effectiveWidthL(mL, shear, CH, bLine);
    const twR = effectiveWidthR(mR, shear, CH, bLine);
    const halfL = Math.max(twL + pad, SETTINGS.canvasWidth / 2);
    const halfR = Math.max(twR + pad, SETTINGS.canvasWidth / 2);
    const CW    = halfL + halfR;

    // ── Canvas utama ──────────────────────────────────────────
    const canvas = createCanvas(CW, CH);
    const ctx    = canvas.getContext("2d");

    if (!transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);
    }

    // ── Load gambar ───────────────────────────────────────────
    let haloImg  = null;
    let crossImg = null;
    if (halo)  { try { haloImg  = await loadImage(halo);  } catch (_) {} }
    if (cross) { try { crossImg = await loadImage(cross); } catch (_) {} }

    // ── Gambar HALO (di belakang teks) dengan skala ───────────
    if (haloImg) {
      const iconCenterX = halfL - CH/2 + SETTINGS.graphOffset.X;
      const iconCenterY = SETTINGS.graphOffset.Y;
      const newW = CH * hScale;
      const newH = CH * hScale;
      const drawX = iconCenterX - newW/2;
      const drawY = iconCenterY - newH/2;
      ctx.drawImage(haloImg, drawX, drawY, newW, newH);
    }

    // ── Teks kiri (biru) ──────────────────────────────────────
    ctx.save();
    ctx.font      = font;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    applyShear(ctx, shear);
    ctx.fillText(textL, halfL, CH * bLine);
    ctx.resetTransform();
    ctx.restore();

    // ── Teks kanan (hitam + stroke putih) ─────────────────────
    ctx.save();
    ctx.font      = font;
    ctx.textAlign = "start";
    ctx.strokeStyle = "white";
    ctx.lineWidth   = Math.max(4, fSize * 0.09);
    ctx.lineJoin    = "round";
    applyShear(ctx, shear);

    if (transparent) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeText(textR, halfL, CH * bLine);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.strokeText(textR, halfL, CH * bLine);
    }

    ctx.fillStyle = colorR;
    ctx.fillText(textR, halfL, CH * bLine);
    ctx.resetTransform();
    ctx.restore();

    // ── Hollow path (potong sudut) ────────────────────────────
    const scale = CH / 500;
    const gx    = halfL - CH / 2 + SETTINGS.graphOffset.X;
    const gy    = SETTINGS.graphOffset.Y;
    const hp    = SETTINGS.hollowPath;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx + hp[0][0] * scale, gy + hp[0][1] * scale);
    for (let i = 1; i < hp.length; i++) {
      ctx.lineTo(gx + hp[i][0] * scale, gy + hp[i][1] * scale);
    }
    ctx.closePath();

    if (transparent) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "white";
    } else {
      ctx.fillStyle = bg;
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // ── Gambar CROSS (melubangi semua lapisan di bawahnya) ────
    if (crossImg) {
      ctx.save();
      // Mode destination-out → menghapus pixel (membuat transparan)
      ctx.globalCompositeOperation = "destination-out";
      const iconCenterX = halfL - CH/2 + SETTINGS.graphOffset.X;
      const iconCenterY = SETTINGS.graphOffset.Y;
      const newW = CH * cScale;
      const newH = CH * cScale;
      const drawX = iconCenterX - newW/2;
      const drawY = iconCenterY - newH/2;
      ctx.drawImage(crossImg, drawX, drawY, newW, newH);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    // ── Crop ke area teks ─────────────────────────────────────
    const cropX = halfL - twL - pad;
    const cropW = twL + twR + pad * 2;
    const output = createCanvas(cropW, CH);
    const oc     = output.getContext("2d");
    oc.drawImage(canvas, cropX, 0, cropW, CH, 0, 0, cropW, CH);

    res.setHeader("Content-Type", "image/png");
    res.send(output.toBuffer("image/png"));

  } catch (err) {
    console.error("[logo handler]", err);
    res.status(500).json({ error: err.message });
  }
};
