const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── PATH ASET ────────────────────────────────────────────────
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
let _haloImg  = null;
let _crossImg = null;

async function preloadAssets() {
  for (const [file, varName] of [["halo.png","_haloImg"],["cross.png","_crossImg"]]) {
    const full = p(file);
    if (fs.existsSync(full)) {
      try {
        if (varName === "_haloImg")  _haloImg  = await loadImage(full);
        if (varName === "_crossImg") _crossImg = await loadImage(full);
        console.log(`[logo] ${file} loaded`);
      } catch (e) { console.warn(`[logo] Failed to load ${file}:`, e.message); }
    } else { console.warn(`[logo] ${file} not found at:`, full); }
  }
}
preloadAssets();

// ── HELPERS ──────────────────────────────────────────────────
function effectiveWidthL(metrics, tilt, canvasH, baseLine) {
  return metrics.width - (baseLine * canvasH + metrics.fontBoundingBoxDescent) * tilt;
}
function effectiveWidthR(metrics, tilt, canvasH, baseLine) {
  return metrics.width + (baseLine * canvasH - metrics.fontBoundingBoxAscent) * tilt;
}

// ── MAIN HANDLER ─────────────────────────────────────────────
/**
 * Query params:
 *   textL     - teks kiri (biru)    — default "Blue"
 *   textR     - teks kanan (hitam)  — default "Archive"
 *   colorL    - warna teks kiri     — default "#128AFA"
 *   colorR    - warna teks kanan    — default "#2B2B2B"
 *   bg        - warna bg atau "transparent" — default "#ffffff"
 *   fontSize  - ukuran font px      — default 120
 *   tilt      - italic shear        — default -0.15
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
      fontSize = "120",
      tilt     = "-0.15",
    } = req.query;

    const fSize = Math.max(20, Math.min(300, parseInt(fontSize)  || 120));
    const shear = Math.max(-0.5, Math.min(0.5, parseFloat(tilt) || -0.15));

    const safeColor = (c, fb) => /^#[0-9A-Fa-f]{3,8}$/.test(c) ? c : fb;
    colorL = safeColor(colorL, "#128AFA");
    colorR = safeColor(colorR, "#2B2B2B");

    const transparent = bg === "transparent" || bg === "none";
    if (!transparent) bg = safeColor(bg, "#ffffff");

    // ── Layout ───────────────────────────────────────────────
    // canvasHeight = tinggi area TEKS saja
    // totalHeight  = lebih tinggi untuk memberi ruang halo/cross di atas
    const textH   = Math.round(fSize * 1.35);  // cukup untuk 1 baris teks
    const totalH  = Math.round(fSize * 2.2);   // ruang ekstra ke atas untuk halo
    const textY   = totalH - Math.round(fSize * 0.28); // baseline teks
    const padX    = Math.round(fSize * 0.35);

    const font    = `bold ${fSize}px ${FONT_STACK}`;

    // Ukur teks
    const mc = createCanvas(10, 10).getContext("2d");
    mc.font = font;
    const mL = mc.measureText(textL);
    const mR = mc.measureText(textR);

    // Lebar efektif setelah shear
    // (shear negatif → huruf condong ke kanan-atas → teks kiri lebih sempit di kiri)
    const twL = mL.width - (textY + (mL.fontBoundingBoxDescent || fSize*0.15)) * shear;
    const twR = mR.width + (textY - (mR.fontBoundingBoxAscent  || fSize*1.0))  * shear;

    const halfL = twL + padX;
    const halfR = twR + padX;
    const CW    = halfL + halfR;

    // ── Canvas ───────────────────────────────────────────────
    const canvas = createCanvas(CW, totalH);
    const ctx    = canvas.getContext("2d");

    if (!transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, totalH);
    }

    // ── Posisi halo & cross ───────────────────────────────────
    // Halo/cross duduk di tengah (halfL), mulai dari Y=0
    // Ukuran = totalH supaya bisa keluar ke atas teks
    const assetSize = totalH;
    const assetX    = halfL - assetSize / 2;
    const assetY    = 0;

    // Layer 1: halo (di belakang teks)
    if (_haloImg) {
      ctx.drawImage(_haloImg, assetX, assetY, assetSize, assetSize);
    }

    // Layer 2: teks kiri — biru, italic kanan
    ctx.save();
    ctx.font      = font;
    ctx.fillStyle = colorL;
    ctx.textAlign = "end";
    ctx.setTransform(1, 0, shear, 1, 0, 0);
    ctx.fillText(textL, halfL, textY);
    ctx.resetTransform();
    ctx.restore();

    // Layer 3: teks kanan — stroke putih dulu (biar terbaca di atas halo) lalu fill
    ctx.save();
    ctx.font        = font;
    ctx.textAlign   = "start";
    ctx.strokeStyle = "white";
    ctx.lineWidth   = Math.max(4, fSize * 0.09);
    ctx.lineJoin    = "round";
    ctx.setTransform(1, 0, shear, 1, 0, 0);

    if (transparent) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeText(textR, halfL, textY);
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.strokeText(textR, halfL, textY);
    }

    ctx.fillStyle = colorR;
    ctx.fillText(textR, halfL, textY);
    ctx.resetTransform();
    ctx.restore();

    // Layer 4: hollow path
    // Memotong area kecil HANYA di sekitar garis tengah (halfL),
    // membentuk parallelogram tipis vertikal mirip separator diagonal.
    // Koordinat absolut (bukan rescale dari 500×500).
    //
    // Di referensi asli (settings.ts), hollowPath ini memotong
    // bagian yang tertutupi gambar "cross" — supaya cross kelihatan
    // tembus ke background. Karena cross sudah punya alpha sendiri,
    // kita skip hollowPath agar tidak merusak teks.
    // (hollowPath hanya diperlukan bila bg transparan + tidak ada alpha di cross)
    if (transparent && !_crossImg) {
      // Parallelogram tipis di garis tengah
      const slantOffset = totalH * Math.abs(shear);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(halfL - slantOffset - 2,  0);
      ctx.lineTo(halfL + slantOffset + 2,  0);
      ctx.lineTo(halfL + slantOffset + 2,  totalH);
      ctx.lineTo(halfL - slantOffset - 2,  totalH);
      ctx.closePath();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    // Layer 5: cross (di atas semua)
    if (_crossImg) {
      ctx.drawImage(_crossImg, assetX, assetY, assetSize, assetSize);
    }

    // ── Crop ke area teks aktif ───────────────────────────────
    const cropX = halfL - twL - padX;
    const cropW = twL + twR + padX * 2;

    const output = createCanvas(cropW, totalH);
    const oc     = output.getContext("2d");
    oc.drawImage(canvas, cropX, 0, cropW, totalH, 0, 0, cropW, totalH);

    res.setHeader("Content-Type", "image/png");
    res.send(output.toBuffer("image/png"));

  } catch (err) {
    console.error("[logo handler]", err);
    res.status(500).json({ error: err.message });
  }
};
