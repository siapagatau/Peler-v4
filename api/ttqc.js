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

function EF(sz) { return `${sz}px ${hasEmoji ? "'NotoColorEmoji',sans-serif" : "sans-serif"}`; }
function CF(sz) { return `normal ${sz}px ${hasEmoji ? "'Inter','NotoColorEmoji'" : "Inter,sans-serif"}`; }
function BF(sz) { return `bold ${sz}px ${hasEmoji ? "'InterBold','NotoColorEmoji'" : "InterBold,sans-serif"}`; }

// ── HELPERS ───────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function rrTail(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y,     x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x,     y + h, br);
  ctx.arcTo(x,     y + h, x,     y,     bl);
  ctx.arcTo(x,     y,     x + w, y,     tl);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const out = [];
  for (const hard of String(text).replace(/\\n/g, "\n").split("\n")) {
    const words = hard.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; }
      else cur = test;
    }
    out.push(cur);
  }
  return out;
}

async function drawAvatar(ctx, url, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  let ok = false;
  if (url) {
    try { const img = await loadImage(url); ctx.drawImage(img, cx-r, cy-r, r*2, r*2); ok = true; }
    catch (_) {}
  }
  if (!ok) {
    const g = ctx.createLinearGradient(cx-r, cy-r, cx+r, cy+r);
    g.addColorStop(0, "#9090c8"); g.addColorStop(1, "#6060a0");
    ctx.fillStyle = g; ctx.fillRect(cx-r, cy-r, r*2, r*2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.arc(cx, cy - r*0.12, r*0.34, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r*0.55, r*0.44, r*0.28, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ── ICONS ─────────────────────────────────────────────────────
function icoBack(ctx, x, y, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.2;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(x+8, y-6); ctx.lineTo(x, y); ctx.lineTo(x+8, y+6); ctx.stroke();
  ctx.restore();
}

function icoMore(ctx, x, y, color) {
  ctx.save(); ctx.fillStyle = color;
  for (const dy of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(x, y+dy, 2, 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
}

function icoVerified(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = "#20d5ec";
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx-3, cy+0.5); ctx.lineTo(cx-0.5, cy+3); ctx.lineTo(cx+4, cy-2.5); ctx.stroke();
  ctx.restore();
}

function icoReply(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx+12, cy-5); ctx.lineTo(cx+2, cy); ctx.lineTo(cx+12, cy+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+2, cy); ctx.quadraticCurveTo(cx+12, cy, cx+12, cy-6); ctx.stroke();
  ctx.restore();
}

function icoForward(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx+4, cy-5); ctx.lineTo(cx+14, cy); ctx.lineTo(cx+4, cy+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+14, cy); ctx.quadraticCurveTo(cx+4, cy, cx+4, cy-6); ctx.stroke();
  ctx.restore();
}

function icoCopy(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, cx+2, cy-3, 9, 10, 2); ctx.stroke();
  rr(ctx, cx-1, cy-7, 9, 10, 2); ctx.stroke();
  ctx.restore();
}

function icoTranslate(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx+1, cy-6); ctx.lineTo(cx+10, cy-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+5.5, cy-6); ctx.lineTo(cx+5.5, cy-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+2, cy-2); ctx.lineTo(cx+9, cy-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+3, cy-2); ctx.lineTo(cx+1, cy+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+8, cy-2); ctx.lineTo(cx+10, cy+5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+3, cy+1); ctx.lineTo(cx+10, cy+1); ctx.stroke();
  ctx.restore();
}

function icoTrash(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, cx+1, cy-3, 11, 10, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-1, cy-3); ctx.lineTo(cx+14, cy-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+4, cy-3); ctx.lineTo(cx+4, cy-7); ctx.lineTo(cx+9, cy-7); ctx.lineTo(cx+9, cy-3); ctx.stroke();
  ctx.restore();
}

function icoFlag(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx+1, cy-7); ctx.lineTo(cx+1, cy+7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+1, cy-7); ctx.lineTo(cx+13, cy-3.5); ctx.lineTo(cx+1, cy+1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function icoSmiley(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx-3.5, cy-2.5, 1.6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+3.5, cy-2.5, 1.6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy+2, 5, 0.12*Math.PI, 0.88*Math.PI); ctx.stroke();
  ctx.restore();
}

function icoSend(ctx, cx, cy, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx-8, cy); ctx.lineTo(cx+8, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+2, cy-6); ctx.lineTo(cx+8, cy); ctx.lineTo(cx+2, cy+6); ctx.stroke();
  ctx.restore();
}

// ── MAIN ──────────────────────────────────────────────────────
async function handleTTQC(req, res) {
  const q        = req.query || {};
  const name     = q.name     || "User";
  const message  = q.message  || "Halo!";
  const avatar   = q.avatar   || "";
  const theme    = q.theme    || "light";
  const verified = q.verified === "true";
  const time     = q.time     || "now";

  const dark = theme === "dark";

  const C = {
    bg:       dark ? "#111114" : "#eaeaf2",
    hdr:      dark ? "#1c1c20" : "#ffffff",
    bubble:   dark ? "#26262c" : "#ffffff",
    ghostS:   dark ? "#38388a" : "#c0c0e8",
    ghostR:   dark ? "#2c2c32" : "#d2d2de",
    ghostAvt: dark ? "#363645" : "#b4b4cc",
    name:     dark ? "#f0f0f4" : "#0a0a14",
    msg:      dark ? "#dcdce8" : "#111118",
    sub:      dark ? "#60607a" : "#8888a8",
    div:      dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.055)",
    inputBg:  dark ? "#242428" : "#ececf2",
    danger:   "#fe2c55",
    icon:     dark ? "#88889a" : "#58586a",
    itemTxt:  dark ? "#eeeef2" : "#111118",
    menuBg:   dark ? "#1e1e24" : "#ffffff",
    pillBg:   dark ? "#232329" : "#ffffff",
    shadow:   dark ? "rgba(0,0,0,0.55)" : "rgba(80,80,120,0.10)",
  };

  // ── CANVAS SIZE ───────────────────────────────────────────
  const W     = 360;  // lebih compact
  const SCALE = 2;
  const FS    = 15;
  const LH    = 23;
  const AVR   = 18;   // avatar radius
  const BPX   = 12; const BPY = 9;

  // Hitung lebar/tinggi bubble
  const tmp = createCanvas(W * 2, 10);
  const tc  = tmp.getContext("2d");
  tc.font   = CF(FS);
  const BMAX  = W - (16 + AVR*2 + 8) - 14;
  const lines = wrapText(tc, message, BMAX - BPX*2);
  const textW = lines.reduce((m, l) => Math.max(m, tc.measureText(l).width), 0);
  const bW    = Math.min(BMAX, Math.max(textW + BPX*2, 90));
  const bH    = BPY + lines.length * LH + BPY;

  // Heights — semua compact
  const H_HDR   = 56;
  const H_GHOST = 132;
  const H_PILL  = 56;
  const H_BUB   = bH + 8;          // bubble + sedikit padding
  const H_TIME  = 20;              // timestamp rapat
  const ITEM_H  = 46;
  const H_MENU  = ITEM_H * 6;
  const H_INPUT = 56;
  const GAP     = 8;

  const H = H_HDR + H_GHOST + GAP + H_PILL + GAP + H_BUB + H_TIME + GAP + H_MENU + GAP + H_INPUT;

  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx    = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let Y = 0;

  // ── 1. HEADER ─────────────────────────────────────────────
  ctx.fillStyle = C.hdr;
  ctx.fillRect(0, 0, W, H_HDR);
  ctx.fillStyle = C.div;
  ctx.fillRect(0, H_HDR - 1, W, 1);

  const hMid = H_HDR / 2;

  // Back arrow — beri ruang 14px dari kiri
  icoBack(ctx, 14, hMid, C.name);

  // Avatar — 30px dari kiri (setelah arrow ~22px + gap 8px)
  const avHX = 36;
  await drawAvatar(ctx, avatar, avHX + AVR, hMid, AVR);

  // Name + online
  const TX = avHX + AVR*2 + 10;
  const dn = name.length > 20 ? name.slice(0, 19) + "…" : name;

  ctx.font = BF(14);
  ctx.fillStyle = C.name;
  ctx.fillText(dn, TX, hMid - 2);

  ctx.font = CF(11);
  ctx.fillStyle = C.sub;
  ctx.fillText("online", TX, hMid + 12);

  // Verified badge — sejajar center teks nama
  if (verified) {
    ctx.font = BF(14);
    const nw = ctx.measureText(dn).width;
    icoVerified(ctx, TX + nw + 10, hMid - 5);
  }

  // More dots
  icoMore(ctx, W - 16, hMid, C.icon);

  Y += H_HDR;

  // ── 2. GHOST BUBBLES ──────────────────────────────────────
  const ghostRows = [
    { type: "sent", w: 100 },
    { type: "recv", w: 130 },
    { type: "sent", w: 75  },
    { type: "recv", w: 110 },
  ];
  const rowH = Math.floor(H_GHOST / ghostRows.length);
  const GH = 24; const GAV = 13; const GP = 14;

  for (let i = 0; i < ghostRows.length; i++) {
    const row = ghostRows[i];
    const ry  = Y + i * rowH + (rowH - GH) / 2;
    ctx.save(); ctx.globalAlpha = 0.35;
    if (row.type === "recv") {
      ctx.fillStyle = C.ghostAvt;
      ctx.beginPath(); ctx.arc(GP + GAV, ry + GH/2, GAV, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.ghostR;
      rr(ctx, GP + GAV*2 + 6, ry, row.w, GH, 12); ctx.fill();
    } else {
      ctx.fillStyle = C.ghostS;
      rr(ctx, W - GP - row.w, ry, row.w, GH, 12); ctx.fill();
    }
    ctx.restore();
  }
  Y += H_GHOST;

  // ── 3. EMOJI PILL ─────────────────────────────────────────
  Y += GAP;
  const emojis = ["❤️","😂","😭","👍","😡","🤔"];
  const E_SZ   = 22;
  const E_GAP  = 10;
  const E_PAD  = 12;
  const PH     = 44;
  const PW     = emojis.length * E_SZ + (emojis.length - 1) * E_GAP + E_PAD * 2;
  const PX     = Math.round((W - PW) / 2);
  const PY     = Y + 6;

  ctx.save();
  ctx.shadowColor = C.shadow; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.pillBg;
  rr(ctx, PX, PY, PW, PH, PH/2); ctx.fill();
  ctx.restore();

  ctx.font = EF(E_SZ); ctx.textAlign = "center";
  for (let i = 0; i < emojis.length; i++) {
    const ex = PX + E_PAD + E_SZ/2 + i * (E_SZ + E_GAP);
    ctx.fillText(emojis[i], ex, PY + PH/2 + 8);
  }
  ctx.textAlign = "left";
  Y += H_PILL;

  // ── 4. BUBBLE ─────────────────────────────────────────────
  Y += GAP;
  const avBX = 14 + AVR;
  const avBY = Y + AVR + 4;
  await drawAvatar(ctx, avatar, avBX, avBY, AVR);

  const bXX = avBX + AVR + 8;
  const bYY = Y + 2;

  // Shadow + fill
  ctx.save();
  ctx.shadowColor   = dark ? "rgba(0,0,0,0.45)" : "rgba(80,80,120,0.13)";
  ctx.shadowBlur    = 16;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.bubble;
  rrTail(ctx, bXX, bYY, bW, bH, 4, 16, 16, 16); ctx.fill();
  ctx.restore();

  // Text
  ctx.font = CF(FS); ctx.fillStyle = C.msg;
  let ty = bYY + BPY + FS - 1;
  for (const line of lines) { ctx.fillText(line, bXX + BPX, ty); ty += LH; }

  Y += H_BUB;

  // ── 5. TIMESTAMP — rapat langsung di bawah bubble ─────────
  // Tambahkan di dalam area H_BUB tidak perlu, kita render di Y tepat
  ctx.font = CF(11); ctx.fillStyle = C.sub;
  ctx.fillText(time, bXX + 2, Y + 13);
  Y += H_TIME;

  // ── 6. CONTEXT MENU ───────────────────────────────────────
  Y += GAP;
  const MX = 12, MW = W - 24;

  ctx.save();
  ctx.shadowColor = dark ? "rgba(0,0,0,0.55)" : "rgba(80,80,120,0.10)";
  ctx.shadowBlur = 20; ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.menuBg;
  rr(ctx, MX, Y, MW, H_MENU, 14); ctx.fill();
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
    const icx = MX + 24;
    const icy = iy + ITEM_H / 2;

    if (i > 0) {
      ctx.fillStyle = C.div;
      ctx.fillRect(MX + 14, iy, MW - 28, 1);
    }

    it.fn(ctx, icx, icy, it.danger ? C.danger : C.icon);

    ctx.font = CF(14);
    ctx.fillStyle = it.danger ? C.danger : C.itemTxt;
    ctx.fillText(it.label, MX + 48, icy + 5);
  }

  Y += H_MENU;

  // ── 7. INPUT BAR ──────────────────────────────────────────
  Y += GAP;
  ctx.fillStyle = C.hdr;
  ctx.fillRect(0, Y, W, H_INPUT);
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y, W, 1);

  const iMid = Y + H_INPUT / 2;
  icoSmiley(ctx, 22, iMid, C.icon);

  const ifX = 42, ifW = W - 42 - 40, ifH = 34, ifY = iMid - ifH/2;
  ctx.fillStyle = C.inputBg;
  rr(ctx, ifX, ifY, ifW, ifH, ifH/2); ctx.fill();

  ctx.font = CF(12); ctx.fillStyle = C.sub;
  ctx.fillText("Kirim pesan...", ifX + 14, iMid + 4);

  icoSend(ctx, W - 20, iMid, C.icon);

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
