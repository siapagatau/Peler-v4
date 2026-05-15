const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── PATH ASET ────────────────────────────────────────────────
// Semua font dan gambar diambil dari ../assetba relatif ke file ini.
//
// Struktur folder yang diharapkan:
//   ../assetba/
//     RoGSanSrfStd-Bd.otf          ← font utama
//     GlowSansSC-Normal-Heavy.otf  ← font fallback CJK
//     halo.png                     ← gambar lingkaran halo
//     cross.png                    ← gambar tanda silang
//
const ASSET_DIR = path.resolve(__dirname, "../assetba");
const p = (f) => path.join(ASSET_DIR, f);

// ── FONT SETUP ───────────────────────────────────────────────
const FONT_STACK = "BlueArchive, GlowSans, sans-serif";

try {
  const fontCandidates = [
    [p("RoGSanSrfStd-Bd.otf"),         "BlueArchive"],
    [p("GlowSansSC-Normal-Heavy.otf"), "BlueArchive"],
    [p("GlowSansSC-Normal-Heavy.otf"), "GlowSans"],
  ];
  for (const [full, alias] of fontCandidates) {
    if (fs.existsSync(full)) {
      GlobalFonts.register(fs.readFileSync(full), alias);
      console.log(`[logo] Font loaded: ${path.basename(full)} as "${alias}"`);
    }
  }
} catch (e) {
  console.warn("[logo] Font load warning:", e.message);
}

// ── PRE-LOAD ASET GAMBAR ─────────────────────────────────────
// Load halo.png dan cross.png sekali saat startup, bukan per request.
let _haloImg  = null;
let _crossImg = null;

async function preloadAssets() {
  const haloPath  = p("halo.png");
  const crossPath = p("cross.png");
  if (fs.existsSync(haloPath)) {
    try { _haloImg  = await loadImage(haloPath);  console.log("[logo] halo.png loaded"); }
    catch (e) { console.warn("[logo] Failed to load halo.png:", e.message); }
  } else {
    console.warn("[logo] halo.png not found at:", haloPath);
  }
  if (fs.existsSync(crossPath)) {
    try { _crossImg = await loadImage(crossPath); console.log("[logo] cross.png loaded"); }
    catch (e) { console.warn("[logo] Failed to load cross.png:", e.message); }
  } else {
    console.warn("[logo] cross.png not found at:", crossPath);
  }
}

// Jalankan preload saat modul di-require (non-blocking)
preloadAssets();

// ── SETTINGS ─────────────────────────────────────────────────
const SETTINGS = {
  canvasHeight:   200,
  canvasWidth:    800,
  fontSize:       130,
  horizontalTilt: -0.15,
  textBaseLine:   0.78,
  paddingX:       40,
  graphOffset:    { X: 0, Y: 0 },
  hollowPath: [
    [214, 0],
    [500, 0],
    [286, 500],
    [0,   500],
  ],
};

// ── HELPERS ──────────────────────────────────────────────────
function effectiveWidthL(metrics, tilt, canvasH, baseLine) {
  return metrics.width - (baseLine * canvasH + metrics.fontBoundingBoxDescent) * tilt;
}
function effectiveWidthR(metrics, tilt, canvasH, baseLine) {
  return metrics.width + (baseLine * canvasH - metrics.fontBoundingBoxAscent) * tilt;
}
function applyShear(ctx, tilt) {
  ctx.setTransform(1, 0, tilt, 1, 0, 0);
}

// ── MAIN HANDLER ─────────────────────────────────────────────
/**
 * Query params:
 *   textL     - teks kiri (biru)    — default "Blue"
 *   textR     - teks kanan (hitam)  — default "Archive"
 *   colorL    - warna teks kiri     — default "#128AFA"
 *   colorR    - warna teks kanan    — default "#2B2B2B"
 *   bg        - warna bg atau "transparent" — default "#ffffff"
 *   fontSize  - ukuran font px      — default 130
 *   tilt      - italic shear        — default -0.15
 *
 * halo.png dan cross.png diambil otomatis dari ../assetba/
 * Tidak perlu kirim URL halo/cross lewat query.
 *
 * Contoh:
 *   /api/image?type=logo&textL=Arona&textR=Sensei
 *   /api/image?type=logo&textL=Blue&textR=Archive&bg=transparent
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      textL    = "Blue",
      textR    = "Archive",
      colorL   = "#128AFA",
      colorR   = "#2B2B2B",
      bg       = "#ffffff",
      fontSize = String(SETTINGS.fontSize),
      tilt     = String(SETTINGS.horizontalTilt),
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSize)  || SETTINGS.fontSize));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || SETTINGS.horizontalTilt));
    const CH    = SETTINGS.canvasHeight;
    const pad   = SETTINGS.paddingX;
    const bLine = SETTINGS.textBaseLine;
    const font  = `bold ${fSize}px ${FONT_STACK}`;

    const safeColor = (c, fallback) => /^#[0-9A-Fa-f]{3,8}$/.test(c) ? c : fallback;
    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");

    const transparent = bg === "transparent" || bg === "none";
    if (!transparent) bg = safeColor(bg, "#ffffff");

    // Ukur teks dengan canvas sementara
    const measure = createCanvas(10, 10);
    const mc = measure.getContext("2d");
    mc.font = font;
    const mL = mc.measureText(textL);
    const mR = mc.measureText(textR);

    const twL  = effectiveWidthL(mL, shear, CH, bLine);
    const twR  = effectiveWidthR(mR, shear, CH, bLine);
    const halfL = Math.max(twL + pad, SETTINGS.canvasWidth / 2);
    const halfR = Math.max(twR + pad, SETTINGS.canvasWidth / 2);
    const CW    = halfL + halfR;

    // Buat canvas utama
    const canvas = createCanvas(CW, CH);
    const ctx    = canvas.getContext("2d");

    if (!transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);
    }

    const gx = halfL - CH / 2 + SETTINGS.graphOffset.X;
    const gy = SETTINGS.graphOffset.Y;

    // Layer 1: halo (di belakang teks)
    if (_haloImg) {
      ctx.drawImage(_haloImg, gx, gy, CH, CH);
    }

    // Layer 2: teks kiri — biru, italic
    ctx.save();
    ctx.font      = font;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    applyShear(ctx, shear);
    ctx.fillText(textL, halfL, CH * bLine);
    ctx.resetTransform();
    ctx.restore();

    // Layer 3: teks kanan — stroke putih dulu lalu fill hitam
    ctx.save();
    ctx.font        = font;
    ctx.textAlign   = "start";
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

    // Layer 4: hollow path — potong sudut diagonal logo
    const scale = CH / 500;
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

    // Layer 5: cross (di atas semua)
    if (_crossImg) {
      ctx.drawImage(_crossImg, gx, gy, CH, CH);
    }

    // Crop ke area teks aktif saja (buang padding kosong)
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
