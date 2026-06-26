const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

let hasEmojiFont = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")), "InterBold");
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")), "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

const ef = (sz) => `${sz}px ${hasEmojiFont ? "NotoColorEmoji,sans-serif" : "sans-serif"}`;
const cf = (sz) => `${sz}px ${hasEmojiFont ? "Inter,NotoColorEmoji,sans-serif" : "Inter,sans-serif"}`;
const bf = (sz) => `bold ${sz}px ${hasEmojiFont ? "InterBold,NotoColorEmoji,sans-serif" : "InterBold,sans-serif"}`;

function rr(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

function rrC(ctx, x, y, w, h, tl, tr, br, bl) {
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
    try { const img = await loadImage(url); ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); ok = true; }
    catch (_) {}
  }
  if (!ok) {
    ctx.fillStyle = "#c0c0cc"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#9090a8";
    ctx.beginPath(); ctx.arc(cx, cy - r * .12, r * .36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * .58, r * .48, r * .32, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── ICON HELPERS ──────────────────────────────────────────────

function icoBack(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 8); ctx.lineTo(x, y); ctx.lineTo(x + 10, y + 8);
  ctx.stroke();
  ctx.restore();
}

function icoMore(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  [-8, 0, 8].forEach(dy => {
    ctx.beginPath(); ctx.arc(x, y + dy, 2.2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function icoVerified(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = "#20d5ec";
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy); ctx.lineTo(cx - 1, cy + 3.5); ctx.lineTo(cx + 5, cy - 3.5);
  ctx.stroke();
  ctx.restore();
}

function icoReply(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx + 14, cy - 7); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx + 14, cy + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 2, cy); ctx.quadraticCurveTo(cx + 14, cy - 1, cx + 14, cy - 8); ctx.stroke();
  ctx.restore();
}

function icoForward(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx + 2, cy - 7); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx + 2, cy + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 14, cy); ctx.quadraticCurveTo(cx + 2, cy - 1, cx + 2, cy - 8); ctx.stroke();
  ctx.restore();
}

function icoCopy(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, cx + 1, cy - 5, 10, 11, 2, false, true);
  rr(ctx, cx + 4, cy - 9, 10, 11, 2, false, true);
  ctx.restore();
}

function icoTranslate(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 12, cy - 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 6, cy - 7); ctx.lineTo(cx + 6, cy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 1, cy - 2); ctx.lineTo(cx + 11, cy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2); ctx.lineTo(cx + 1, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 9, cy - 2); ctx.lineTo(cx + 11, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 3, cy + 2); ctx.lineTo(cx + 11, cy + 2); ctx.stroke();
  ctx.restore();
}

function icoTrash(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, cx + 2, cy - 4, 10, 11, 2, false, true);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 14, cy - 4);
  ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx + 4, cy - 8);
  ctx.lineTo(cx + 10, cy - 8); ctx.lineTo(cx + 10, cy - 4);
  ctx.stroke();
  ctx.restore();
}

function icoFlag(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.danger; ctx.fillStyle = C.danger; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 13, cy - 4); ctx.lineTo(cx, cy + 1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function icoSmiley(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.icon;
  ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + 2, 6, 0.1 * Math.PI, 0.9 * Math.PI, false); ctx.stroke();
  ctx.restore();
}

function icoSend(ctx, cx, cy, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 2, cy - 8); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx + 2, cy + 8); ctx.stroke();
  ctx.restore();
}

// ── MAIN HANDLER ─────────────────────────────────────────────

async function handleTTQC(req, res) {
  const {
    name     = "User",
    message  = "Halo!",
    avatar   = "",
    theme    = "light",
    verified = "false",
    time     = "now",
    likes    = "",
  } = req.query;

  const dark = theme === "dark";

  const C = {
    bg:       dark ? "#111111" : "#ededf2",
    white:    dark ? "#1e1e1e" : "#ffffff",
    bubble:   dark ? "#272727" : "#ffffff",
    ghostS:   dark ? "#5050cc" : "#c8c8e8",  // sent ghost
    ghostR:   dark ? "#333333" : "#d0d0dc",  // recv ghost
    ghostAvt: dark ? "#3a3a4a" : "#b8b8cc",
    name:     dark ? "#ffffff" : "#111111",
    msg:      dark ? "#e8e8e8" : "#111111",
    sub:      dark ? "#777777" : "#888899",
    div:      dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
    inputBg:  dark ? "#2a2a2a" : "#eeeeee",
    danger:   "#fe2c55",
    icon:     dark ? "#aaaaaa" : "#555566",
    itemText: dark ? "#f0f0f0" : "#111111",
    menuBg:   dark ? "#222222" : "#ffffff",
    pillBg:   dark ? "#2e2e2e" : "#ffffff",
  };

  const W      = 400;
  const FS     = 17;
  const LH     = 26;
  const AVT_R  = 20;
  const GAP    = 10;
  const BX     = 14 + AVT_R * 2 + GAP;
  const BMAX   = W - BX - 16;
  const BPX    = 14, BPY = 11;

  // Measure bubble
  const tmp = createCanvas(800, 10);
  const tc  = tmp.getContext("2d");
  tc.font   = cf(FS);
  const lines = wrapText(tc, message, BMAX - BPX * 2);
  const textW = lines.reduce((m, l) => Math.max(m, tc.measureText(l).width), 0);
  const bW    = Math.min(BMAX, Math.max(textW + BPX * 2, 100));
  const bH    = BPY + lines.length * LH + BPY;

  // Heights
  const H_HDR   = 60;
  const H_GHOST = 148;
  const H_PILL  = 60;
  const H_BUB   = Math.max(bH + 16, 58);
  const H_TIME  = 28;
  const ITEM_H  = 50;
  const N_ITEMS = 6;
  const H_MENU  = N_ITEMS * ITEM_H;
  const H_INPUT = 62;
  const PAD     = 8;  // padding between sections

  const H = H_HDR + H_GHOST + PAD + H_PILL + PAD + H_BUB + H_TIME + PAD + H_MENU + PAD + H_INPUT;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let Y = 0;

  // ── 1. HEADER ───────────────────────────────────────────────
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_HDR);

  const hcy = Y + H_HDR / 2;
  icoBack(ctx, 20, hcy, C.name);
  await drawAvatar(ctx, avatar, 52, hcy, 20);

  ctx.font = bf(16);
  ctx.fillStyle = C.name;
  const dn = name.length > 20 ? name.slice(0, 19) + "…" : name;
  ctx.fillText(dn, 82, hcy + 6);

  if (verified === "true") {
    const vx = 82 + ctx.measureText(dn).width + 8;
    icoVerified(ctx, vx + 9, hcy);
  }

  icoMore(ctx, W - 20, hcy, C.icon);

  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y + H_HDR - 1, W, 1);
  Y += H_HDR;

  // ── 2. GHOST CHAT ────────────────────────────────────────────
  // Row layout: recv(avatar) | sent, sent | recv(avatar), recv(no avatar) | sent
  // But per our design: sent, recv(avt), sent, recv(avt)
  const GH  = 30;   // ghost bubble height
  const GR  = 15;   // ghost bubble border radius
  const GAV = 16;   // ghost avatar radius
  const GP  = 14;   // left/right padding

  const ghostRows = [
    { type: "sent", w: 130 },
    { type: "recv", w: 155, avt: true },
    { type: "sent", w: 95  },
    { type: "recv", w: 130, avt: true },
  ];

  const rowSpacing = Math.floor(H_GHOST / ghostRows.length);

  for (let i = 0; i < ghostRows.length; i++) {
    const row  = ghostRows[i];
    const rowY = Y + i * rowSpacing + (rowSpacing - GH) / 2;

    ctx.save();
    ctx.globalAlpha = 0.42;

    if (row.type === "recv") {
      // avatar circle
      ctx.fillStyle = C.ghostAvt;
      ctx.beginPath();
      ctx.arc(GP + GAV, rowY + GH / 2, GAV, 0, Math.PI * 2);
      ctx.fill();
      // bubble
      ctx.fillStyle = C.ghostR;
      rr(ctx, GP + GAV * 2 + 8, rowY, row.w, GH, GR, true, false);
    } else {
      // sent bubble right-aligned
      ctx.fillStyle = C.ghostS;
      rr(ctx, W - GP - row.w, rowY, row.w, GH, GR, true, false);
    }

    ctx.restore();
  }

  Y += H_GHOST;

  // ── 3. EMOJI REACTION PILL ──────────────────────────────────
  Y += PAD;
  const PX = 14, PW = W - 28, PH = 48, PY = Y + 4;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.12)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.pillBg;
  rr(ctx, PX, PY, PW, PH, PH / 2, true, false);
  ctx.restore();

  const emojis = ["❤️", "😂", "😭", "👍", "😡", "🤔"];
  const eSlot  = PW / emojis.length;
  ctx.font = ef(26); ctx.textAlign = "center";
  for (let i = 0; i < emojis.length; i++) {
    ctx.fillText(emojis[i], PX + eSlot * i + eSlot / 2, PY + PH / 2 + 10);
  }
  ctx.textAlign = "left";

  Y += H_PILL;

  // ── 4. HIGHLIGHTED BUBBLE ───────────────────────────────────
  Y += PAD;
  const ACX = 14 + AVT_R;
  const ACY = Y + AVT_R + 4;
  await drawAvatar(ctx, avatar, ACX, ACY, AVT_R);

  const BXX = ACX + AVT_R + GAP;
  const BYY = Y + 4;

  ctx.save();
  ctx.shadowColor = dark ? "rgba(0,0,0,0.40)" : "rgba(0,0,0,0.14)";
  ctx.shadowBlur  = 18;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.bubble;
  rrC(ctx, BXX, BYY, bW, bH, 4, 18, 18, 18);
  ctx.fill();
  ctx.restore();

  let ty = BYY + BPY + FS;
  ctx.font = cf(FS); ctx.fillStyle = C.msg;
  for (const line of lines) {
    ctx.fillText(line, BXX + BPX, ty);
    ty += LH;
  }

  Y += H_BUB;

  // ── 5. TIMESTAMP ────────────────────────────────────────────
  ctx.font = cf(12); ctx.fillStyle = C.sub;
  ctx.fillText(time + (likes ? `   ❤️ ${likes}` : ""), BXX, Y + 18);
  Y += H_TIME;

  // ── 6. CONTEXT MENU ─────────────────────────────────────────
  Y += PAD;
  const MX = 12, MW = W - 24;

  ctx.save();
  ctx.shadowColor   = dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.13)";
  ctx.shadowBlur    = 22;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.menuBg;
  rr(ctx, MX, Y, MW, H_MENU, 14, true, false);
  ctx.restore();

  const menuItems = [
    { label: "Balas",            danger: false, draw: icoReply     },
    { label: "Teruskan",         danger: false, draw: icoForward   },
    { label: "Salin",            danger: false, draw: icoCopy      },
    { label: "Terjemahkan",      danger: false, draw: icoTranslate },
    { label: "Hapus untuk saya", danger: false, draw: icoTrash     },
    { label: "Laporkan",         danger: true,  draw: icoFlag      },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    const it  = menuItems[i];
    const IY  = Y + i * ITEM_H;
    const ICX = MX + 26, ICY = IY + ITEM_H / 2;

    if (i > 0) {
      ctx.fillStyle = C.div;
      ctx.fillRect(MX + 14, IY, MW - 28, 1);
    }

    it.draw(ctx, ICX, ICY, C);

    ctx.font      = cf(16);
    ctx.fillStyle = it.danger ? C.danger : C.itemText;
    ctx.fillText(it.label, MX + 54, ICY + 6);
  }

  Y += H_MENU;

  // ── 7. INPUT BAR ────────────────────────────────────────────
  Y += PAD;
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_INPUT);
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y, W, 1);

  const ICY2 = Y + H_INPUT / 2;

  // Smiley left
  icoSmiley(ctx, 28, ICY2, C);

  // Input box
  const IX = 54, IW = W - 54 - 52, IH2 = 40, IY2 = ICY2 - IH2 / 2;
  ctx.fillStyle = C.inputBg;
  rr(ctx, IX, IY2, IW, IH2, IH2 / 2, true, false);
  ctx.font = cf(14); ctx.fillStyle = C.sub;
  ctx.fillText("Kirim pesan...", IX + 16, ICY2 + 5);

  // Send button right
  icoSend(ctx, W - 26, ICY2, C);

  res.setHeader("Content-Type", "image/png");
  res.send(canvas.toBuffer("image/png"));
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  try   { return await handleTTQC(req, res); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};
