const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ─────────────────────────────────────────────────────
let hasEmoji = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")), "InterBold");
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")), "NotoColorEmoji");
    hasEmoji = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

// Font helpers - tiru pola dari kode referensi agar emoji tampil
function EF(sz) { return `${sz}px ${hasEmoji ? "'NotoColorEmoji',sans-serif" : "sans-serif"}`; }
function CF(sz) { return `normal ${sz}px ${hasEmoji ? "'Inter','NotoColorEmoji'" : "Inter"}`; }
function BF(sz) { return `bold ${sz}px ${hasEmoji ? "'InterBold','NotoColorEmoji'" : "InterBold"}`; }

// ── UTILS ─────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function roundRectCustom(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y,     x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x,     y + h, br);
  ctx.arcTo(x,     y + h, x,     y,     bl);
  ctx.arcTo(x,     y,     x + w, y,     tl);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const hard of String(text).replace(/\\n/g, "\n").split("\n")) {
    const words = hard.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}

// Draw shadow without affecting clip
function drawShadowRect(ctx, x, y, w, h, r, color, blur, oy) {
  ctx.save();
  ctx.shadowColor   = color;
  ctx.shadowBlur    = blur;
  ctx.shadowOffsetY = oy;
  ctx.shadowOffsetX = 0;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(0,0,0,0)"; // transparent fill just to trigger shadow
  // We need an opaque fill for shadow to show — use a tiny trick:
  ctx.restore();
}

async function drawAvatar(ctx, url, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  let drawn = false;
  if (url) {
    try {
      const img = await loadImage(url);
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      drawn = true;
    } catch (_) {}
  }
  if (!drawn) {
    // Fallback: silhouette
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, "#9090c8");
    grad.addColorStop(1, "#6060a0");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.12, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.58, r * 0.46, r * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── ICON DRAWING ─────────────────────────────────────────────
function icoBack(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + 9, y - 7);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 9, y + 7);
  ctx.stroke();
  ctx.restore();
}

function icoMore(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (const dy of [-7, 0, 7]) {
    ctx.beginPath(); ctx.arc(x, y + dy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function icoVerified(ctx, cx, cy, r = 9) {
  ctx.save();
  ctx.fillStyle = "#20d5ec";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, cy + 0.5);
  ctx.lineTo(cx - 0.5, cy + 3.5);
  ctx.lineTo(cx + 4.5, cy - 3);
  ctx.stroke();
  ctx.restore();
}

function icoReply(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx + 13, cy - 6); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx + 13, cy + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy);
  ctx.quadraticCurveTo(cx + 13, cy, cx + 13, cy - 7);
  ctx.stroke();
  ctx.restore();
}

function icoForward(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy - 6); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx + 3, cy + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy);
  ctx.quadraticCurveTo(cx + 3, cy, cx + 3, cy - 7);
  ctx.stroke();
  ctx.restore();
}

function icoCopy(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.9;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  roundRect(ctx, cx + 2, cy - 4, 10, 11, 2); ctx.stroke();
  roundRect(ctx, cx - 1, cy - 8, 10, 11, 2); ctx.stroke();
  ctx.restore();
}

function icoTranslate(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.9;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // "A" language icon
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 7); ctx.lineTo(cx + 11, cy - 7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy - 7); ctx.lineTo(cx + 6, cy - 3); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 3); ctx.lineTo(cx + 10, cy - 3); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx + 1, cy + 5); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 9, cy - 3); ctx.lineTo(cx + 11, cy + 5); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy + 1); ctx.lineTo(cx + 11, cy + 1); ctx.stroke();
  ctx.restore();
}

function icoTrash(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.9;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  roundRect(ctx, cx + 1, cy - 3, 12, 11, 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 1, cy - 3); ctx.lineTo(cx + 15, cy - 3); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 3); ctx.lineTo(cx + 4, cy - 7);
  ctx.lineTo(cx + 10, cy - 7); ctx.lineTo(cx + 10, cy - 3);
  ctx.stroke();
  ctx.restore();
}

function icoFlag(ctx, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx + 1, cy - 8); ctx.lineTo(cx + 1, cy + 8); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 8);
  ctx.lineTo(cx + 14, cy - 4);
  ctx.lineTo(cx + 1, cy + 1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function icoSmiley(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy - 3, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + 2, 5.5, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
  ctx.restore();
}

function icoSend(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 7); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx + 2, cy + 7);
  ctx.stroke();
  ctx.restore();
}

// ── MAIN ──────────────────────────────────────────────────────
async function handleTTQC(req, res) {
  const q = req.query || {};
  const name     = q.name     || "User";
  const message  = q.message  || "Halo!";
  const avatar   = q.avatar   || "";
  const theme    = q.theme    || "light";
  const verified = q.verified === "true";
  const time     = q.time     || "now";

  const dark = theme === "dark";

  // ── COLOR TOKENS ──────────────────────────────────────────
  const C = {
    bg:       dark ? "#0f0f0f" : "#e8e8f0",
    hdr:      dark ? "#1a1a1a" : "#ffffff",
    bubble:   dark ? "#242424" : "#ffffff",
    ghostS:   dark ? "#3d3d8a" : "#bdbde8",
    ghostR:   dark ? "#2e2e2e" : "#d4d4e0",
    ghostAvt: dark ? "#383850" : "#b0b0c8",
    name:     dark ? "#f0f0f0" : "#0d0d0d",
    msg:      dark ? "#e0e0e0" : "#131313",
    sub:      dark ? "#666680" : "#8080a0",
    div:      dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
    inputBg:  dark ? "#262626" : "#ececec",
    danger:   "#fe2c55",
    icon:     dark ? "#909090" : "#606070",
    itemTxt:  dark ? "#eeeeee" : "#111111",
    menuBg:   dark ? "#1e1e1e" : "#ffffff",
    pillBg:   dark ? "#252525" : "#ffffff",
    shadow:   dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.12)",
  };

  // ── LAYOUT CONSTANTS ──────────────────────────────────────
  const W      = 420;
  const SCALE  = 2; // retina
  const FS     = 16;
  const LH     = 25;
  const AVR    = 20; // avatar radius
  const BX     = 16 + AVR * 2 + 10; // bubble x start
  const BMAX   = W - BX - 18;
  const BPX    = 13; const BPY = 10;

  // Measure text
  const tmp = createCanvas(W * 2, 10);
  const tc  = tmp.getContext("2d");
  tc.font   = CF(FS);
  const lines = wrapText(tc, message, BMAX - BPX * 2);
  const textW = lines.reduce((m, l) => Math.max(m, tc.measureText(l).width), 0);
  const bW    = Math.min(BMAX, Math.max(textW + BPX * 2, 110));
  const bH    = BPY + lines.length * LH + BPY + 2;

  // Section heights
  const H_HDR   = 64;
  const H_GHOST = 152;
  const H_PILL  = 64;
  const H_BUB   = Math.max(bH + 20, 60);
  const H_TIME  = 22;
  const ITEM_H  = 52;
  const H_MENU  = ITEM_H * 6;
  const H_INPUT = 64;
  const GAP     = 10;

  const H = H_HDR + H_GHOST + GAP + H_PILL + GAP + H_BUB + H_TIME + GAP + H_MENU + GAP + H_INPUT;

  // Create canvas at 2x for retina sharpness
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx    = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let Y = 0;

  // ── 1. HEADER ─────────────────────────────────────────────
  ctx.fillStyle = C.hdr;
  ctx.fillRect(0, 0, W, H_HDR);

  // Bottom border
  ctx.fillStyle = C.div;
  ctx.fillRect(0, H_HDR - 1, W, 1);

  const hMid = H_HDR / 2;

  // Back arrow — cukup ruang dari tepi kiri
  icoBack(ctx, 14, hMid, C.name);

  // Avatar — jarak 28px dari ujung kanan panah (panah ujung x=14+9=23, avatar center di 23+16+AVR=~60)
  const HDR_AVT_CX = 52;
  await drawAvatar(ctx, avatar, HDR_AVT_CX, hMid, AVR);

  // Name & online — mulai 12px setelah avatar kanan
  const HDR_TX = HDR_AVT_CX + AVR + 12;
  const dn = name.length > 22 ? name.slice(0, 21) + "…" : name;
  ctx.font = BF(15);
  ctx.fillStyle = C.name;
  ctx.fillText(dn, HDR_TX, hMid - 3);

  // Online
  ctx.font = CF(12);
  ctx.fillStyle = C.sub;
  ctx.fillText("online", HDR_TX, hMid + 13);

  // Verified badge — sejajar tengah baris nama (hMid - 3 adalah baseline, badge center = baseline - fontSize/2)
  if (verified) {
    ctx.font = BF(15);
    const nw  = ctx.measureText(dn).width;
    const badgeCY = hMid - 3 - 15 / 2 + 1; // tengah karakter nama
    icoVerified(ctx, HDR_TX + nw + 12, badgeCY);
  }

  // More icon
  icoMore(ctx, W - 18, hMid, C.icon);

  Y += H_HDR;

  // ── 2. GHOST CHAT ─────────────────────────────────────────
  const ghostRows = [
    { type: "sent", w: 120 },
    { type: "recv", w: 150 },
    { type: "sent", w: 85  },
    { type: "recv", w: 125 },
  ];
  const rowH = Math.floor(H_GHOST / ghostRows.length);
  const GH = 28; const GAV = 15; const GP = 16;

  for (let i = 0; i < ghostRows.length; i++) {
    const row = ghostRows[i];
    const ry  = Y + i * rowH + (rowH - GH) / 2;

    ctx.save();
    ctx.globalAlpha = 0.38;

    if (row.type === "recv") {
      ctx.fillStyle = C.ghostAvt;
      ctx.beginPath(); ctx.arc(GP + GAV, ry + GH / 2, GAV, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ghostR;
      roundRect(ctx, GP + GAV * 2 + 8, ry, row.w, GH, 14);
      ctx.fill();
    } else {
      ctx.fillStyle = C.ghostS;
      roundRect(ctx, W - GP - row.w, ry, row.w, GH, 14);
      ctx.fill();
    }

    ctx.restore();
  }

  Y += H_GHOST;

  // ── 3. EMOJI PILL ─────────────────────────────────────────
  Y += GAP;
  const PX = 14, PW = W - 28, PH = 50, PY = Y + 7;

  // Shadow
  ctx.save();
  ctx.shadowColor = C.shadow; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.pillBg;
  roundRect(ctx, PX, PY, PW, PH, PH / 2);
  ctx.fill();
  ctx.restore();

  const emojis = ["❤️", "😂", "😭", "👍", "😡", "🤔"];
  const slotW  = PW / emojis.length;
  ctx.font = EF(24);
  ctx.textAlign = "center";
  for (let i = 0; i < emojis.length; i++) {
    ctx.fillText(emojis[i], PX + slotW * i + slotW / 2, PY + PH / 2 + 9);
  }
  ctx.textAlign = "left";

  Y += H_PILL;

  // ── 4. HIGHLIGHTED BUBBLE ─────────────────────────────────
  Y += GAP;
  const avCX = 16 + AVR;
  const avCY = Y + AVR + 6;
  await drawAvatar(ctx, avatar, avCX, avCY, AVR);

  const bXX = avCX + AVR + 10;
  const bYY = Y + 4;

  // Bubble shadow
  ctx.save();
  ctx.shadowColor   = dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)";
  ctx.shadowBlur    = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.bubble;
  roundRectCustom(ctx, bXX, bYY, bW, bH, 4, 18, 18, 18);
  ctx.fill();
  ctx.restore();

  // Message text
  ctx.font = CF(FS);
  ctx.fillStyle = C.msg;
  let ty = bYY + BPY + FS;
  for (const line of lines) {
    ctx.fillText(line, bXX + BPX, ty);
    ty += LH;
  }

  Y += H_BUB;

  // ── 5. TIMESTAMP ──────────────────────────────────────────
  ctx.font = CF(12);
  ctx.fillStyle = C.sub;
  ctx.fillText(time, bXX, Y + 14);
  Y += H_TIME;

  // ── 6. CONTEXT MENU ───────────────────────────────────────
  Y += GAP;
  const MX = 14, MW = W - 28;

  // Menu shadow
  ctx.save();
  ctx.shadowColor   = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.11)";
  ctx.shadowBlur    = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = C.menuBg;
  roundRect(ctx, MX, Y, MW, H_MENU, 16);
  ctx.fill();
  ctx.restore();

  const menuItems = [
    { label: "Balas",            danger: false, fn: icoReply     },
    { label: "Teruskan",         danger: false, fn: icoForward   },
    { label: "Salin",            danger: false, fn: icoCopy      },
    { label: "Terjemahkan",      danger: false, fn: icoTranslate },
    { label: "Hapus untuk saya", danger: false, fn: icoTrash     },
    { label: "Laporkan",         danger: true,  fn: icoFlag      },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    const it  = menuItems[i];
    const iy  = Y + i * ITEM_H;
    const icx = MX + 28;
    const icy = iy + ITEM_H / 2;

    // Divider
    if (i > 0) {
      ctx.fillStyle = C.div;
      ctx.fillRect(MX + 16, iy, MW - 32, 1);
    }

    // Icon
    it.fn(ctx, icx, icy, it.danger ? C.danger : C.icon);

    // Label
    ctx.font = CF(15);
    ctx.fillStyle = it.danger ? C.danger : C.itemTxt;
    ctx.fillText(it.label, MX + 56, icy + 6);
  }

  Y += H_MENU;

  // ── 7. INPUT BAR ──────────────────────────────────────────
  Y += GAP;
  ctx.fillStyle = C.hdr;
  ctx.fillRect(0, Y, W, H_INPUT);
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y, W, 1);

  const iMid = Y + H_INPUT / 2;

  icoSmiley(ctx, 26, iMid, C.icon);

  // Input field
  const ifX = 50, ifW = W - 50 - 48, ifH = 38, ifY = iMid - ifH / 2;
  ctx.fillStyle = C.inputBg;
  roundRect(ctx, ifX, ifY, ifW, ifH, ifH / 2);
  ctx.fill();

  ctx.font = CF(13);
  ctx.fillStyle = C.sub;
  ctx.fillText("Kirim pesan...", ifX + 16, iMid + 5);

  icoSend(ctx, W - 24, iMid, C.icon);

  // Output
  res.setHeader("Content-Type", "image/png");
  res.send(canvas.toBuffer("image/png"));
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  try   { return await handleTTQC(req, res); }
  catch (err) { console.error(err); return res.status(500).json({ error: err.message }); }
};
