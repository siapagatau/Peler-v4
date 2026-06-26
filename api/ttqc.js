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

// Rounded rect — all corners same radius
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

// Rounded rect — custom per-corner radii (tl, tr, br, bl)
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

async function handleTTQC(req, res) {
  const {
    name = "User", message = "Halo!", avatar = "", theme = "light",
    verified = "false", likes = "", pinned = "false", time = "now",
  } = req.query;

  const dark = theme === "dark";

  const C = {
    bg:        dark ? "#111111" : "#ededf2",
    white:     dark ? "#1e1e1e" : "#ffffff",
    bubble:    dark ? "#272727" : "#ffffff",
    ghostSent: dark ? "#6060e0" : "#c8c8e8",
    ghostRecv: dark ? "#363636" : "#c8c8d8",
    ghostAvt:  dark ? "#3a3a4a" : "#c0c0cc",
    name:      dark ? "#ffffff" : "#111111",
    msg:       dark ? "#e8e8e8" : "#111111",
    sub:       dark ? "#777777" : "#888899",
    div:       dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
    inputBg:   dark ? "#2a2a2a" : "#eeeeee",
    danger:    "#fe2c55",
    icon:      dark ? "#aaaaaa" : "#555566",
    itemText:  dark ? "#f0f0f0" : "#111111",
    menuBg:    dark ? "#222222" : "#ffffff",
    pillBg:    dark ? "#2e2e2e" : "#ffffff",
    streakBg:  dark ? "#2a2a2a" : "#e8e8f0",
  };

  // ── measure message ──────────────────────────────────────────
  const W       = 400;
  const FS      = 17;
  const LH      = 26;
  const AVT_R   = 22;
  const GAP     = 10;
  const BX      = 12 + AVT_R * 2 + GAP;
  const BMAX    = W - BX - 16;
  const BPX     = 14, BPY = 11;

  const tmp = createCanvas(800, 10);
  const tc  = tmp.getContext("2d");
  tc.font   = cf(FS);
  const lines = wrapText(tc, message, BMAX - BPX * 2);
  const textW = lines.reduce((m, l) => Math.max(m, tc.measureText(l).width), 0);
  const bW    = Math.min(BMAX, Math.max(textW + BPX * 2, 90));
  const bH    = BPY + lines.length * LH + BPY;

  // ── section heights (matched from screenshot) ────────────────
  const H_HDR    = 62;
  const H_GHOST  = 160;   // 3 ghost rows
  const H_REACT  = 64;    // emoji pill
  const H_BUBBLE = Math.max(bH + 18, 62);
  const H_TIME   = 30;
  const ITEM_H   = 52;
  const N_ITEMS  = 6;
  const H_MENU   = N_ITEMS * ITEM_H + 2;  // +2 for top/bottom breathing room
  const H_STREAK = 52;    // streak pet + play button row (no emoji shortcuts)
  const H_INPUT  = 62;

  const H = H_HDR + H_GHOST + H_REACT + H_BUBBLE + H_TIME + H_MENU + 10 + H_STREAK + H_INPUT;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let Y = 0;

  // ════════════════════════════════════════════════════
  // 1. HEADER
  // ════════════════════════════════════════════════════
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_HDR);

  // back "<"
  ctx.save();
  ctx.strokeStyle = C.name; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const arrCY = Y + H_HDR / 2;
  ctx.beginPath();
  ctx.moveTo(26, arrCY - 8); ctx.lineTo(14, arrCY); ctx.lineTo(26, arrCY + 8);
  ctx.stroke();
  ctx.restore();

  await drawAvatar(ctx, avatar, 50, Y + H_HDR / 2, 21);

  ctx.font = bf(17);
  ctx.fillStyle = C.name;
  const dn = name.length > 20 ? name.slice(0, 19) + "…" : name;
  ctx.fillText(dn, 80, Y + H_HDR / 2 + 6);

  if (verified === "true") {
    const vx = 80 + ctx.measureText(dn).width + 8, vy = Y + H_HDR / 2;
    ctx.save();
    ctx.fillStyle = "#20d5ec";
    ctx.beginPath(); ctx.arc(vx + 9, vy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(vx + 5, vy); ctx.lineTo(vx + 8, vy + 3.5); ctx.lineTo(vx + 14, vy - 3.5); ctx.stroke();
    ctx.restore();
  }

  // ⋮ dots
  ctx.fillStyle = C.icon;
  [Y + H_HDR / 2 - 8, Y + H_HDR / 2, Y + H_HDR / 2 + 8].forEach(dy => {
    ctx.beginPath(); ctx.arc(W - 20, dy, 2.2, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = C.div; ctx.fillRect(0, Y + H_HDR - 1, W, 1);
  Y += H_HDR;

  // ════════════════════════════════════════════════════
  // 2. GHOST CHAT AREA  (3 rows matching screenshot)
  // row structure from screenshot:
  //   row A: avatar left + short recv bubble | long sent bubble right
  //   row B: avatar left + medium recv bubble | medium sent bubble right
  //   row C: avatar left + short recv bubble  | (nothing right, partial)
  // ════════════════════════════════════════════════════
  const ROW_H   = Math.floor(H_GHOST / 3);   // ~53px per row
  const AVT_GR  = 18;   // ghost avatar radius

  const ghostRows = [
    { recvW: 140, sentW: 120, sentRight: true },
    { recvW: 170, sentW:  90, sentRight: true },
    { recvW: 110, sentW:   0, sentRight: false },
  ];

  for (let ri = 0; ri < ghostRows.length; ri++) {
    const row  = ghostRows[ri];
    const rowY = Y + ri * ROW_H + 8;
    const bubY = rowY + AVT_GR - 13;   // vertically center bubble with avatar
    const bH_g = 28;

    // avatar circle
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle   = C.ghostAvt;
    ctx.beginPath(); ctx.arc(12 + AVT_GR, rowY + AVT_GR, AVT_GR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // recv bubble
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle   = C.ghostRecv;
    rr(ctx, 12 + AVT_GR * 2 + 8, bubY, row.recvW, bH_g, 14, true, false);
    ctx.restore();

    // sent bubble (right aligned)
    if (row.sentW > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle   = C.ghostSent;
      rr(ctx, W - row.sentW - 14, bubY, row.sentW, bH_g, 14, true, false);
      ctx.restore();
    }
  }

  // fade out bottom of ghost area
  const gFade = ctx.createLinearGradient(0, Y + H_GHOST * 0.45, 0, Y + H_GHOST);
  gFade.addColorStop(0, dark ? "rgba(17,17,17,0)"   : "rgba(237,237,242,0)");
  gFade.addColorStop(1, dark ? "rgba(17,17,17,0.92)" : "rgba(237,237,242,0.92)");
  ctx.fillStyle = gFade;
  ctx.fillRect(0, Y, W, H_GHOST);

  Y += H_GHOST;

  // ════════════════════════════════════════════════════
  // 3. EMOJI REACTION PILL
  // ════════════════════════════════════════════════════
  const PX = 16, PW = W - 32, PH = 50, PY = Y + 7;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.10)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.pillBg;
  rr(ctx, PX, PY, PW, PH, 26, true, false);
  ctx.restore();

  const emojis = ["❤️", "😂", "😭", "👍", "😡", "🤔"];
  const eSlot  = PW / emojis.length;
  ctx.font = ef(27); ctx.textAlign = "center";
  for (let i = 0; i < emojis.length; i++) {
    ctx.fillText(emojis[i], PX + eSlot * i + eSlot / 2, PY + PH / 2 + 10);
  }
  ctx.textAlign = "left";

  Y += H_REACT;

  // ════════════════════════════════════════════════════
  // 4. AVATAR + MESSAGE BUBBLE
  // ════════════════════════════════════════════════════
  const ROW_TOP = Y + 6;
  const ACX = 12 + AVT_R, ACY = ROW_TOP + AVT_R;

  await drawAvatar(ctx, avatar, ACX, ACY, AVT_R);

  const BXX = ACX + AVT_R + GAP, BYY = ROW_TOP;
  ctx.save();
  ctx.shadowColor = dark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.08)";
  ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  ctx.fillStyle = C.bubble;
  rrC(ctx, BXX, BYY, bW, bH, 4, 18, 18, 18);
  ctx.fill();
  ctx.restore();

  let ty = BYY + BPY + FS;
  ctx.font = cf(FS); ctx.fillStyle = C.msg;
  for (const line of lines) { ctx.fillText(line, BXX + BPX, ty); ty += LH; }

  if (pinned === "true") {
    ctx.save();
    ctx.fillStyle = dark ? "#2e2e2e" : "#f0f0f5";
    rr(ctx, BXX + bW - 65, BYY + 7, 58, 20, 10, true, false);
    ctx.font = cf(11); ctx.fillStyle = C.sub;
    ctx.fillText("📌 pinned", BXX + bW - 62, BYY + 20);
    ctx.restore();
  }

  Y += H_BUBBLE;

  // ════════════════════════════════════════════════════
  // 5. TIMESTAMP
  // ════════════════════════════════════════════════════
  ctx.font = cf(13); ctx.fillStyle = C.sub;
  ctx.fillText(time + (likes ? `   ❤️ ${likes}` : ""), BXX, Y + 18);
  Y += H_TIME;

  // ════════════════════════════════════════════════════
  // 6. CONTEXT MENU
  // ════════════════════════════════════════════════════
  const MX = 12, MY = Y + 4, MW = W - 24, MH = H_MENU;

  ctx.save();
  ctx.shadowColor = dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.13)";
  ctx.shadowBlur = 22; ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.menuBg;
  rr(ctx, MX, MY, MW, MH, 14, true, false);
  ctx.restore();

  const menuItems = [
    { label: "Balas",            danger: false, draw: icoReply },
    { label: "Teruskan",         danger: false, draw: icoForward },
    { label: "Salin",            danger: false, draw: icoCopy },
    { label: "Terjemahkan",      danger: false, draw: icoTranslate },
    { label: "Hapus untuk saya", danger: false, draw: icoTrash },
    { label: "Laporkan",         danger: true,  draw: icoFlag },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    const it  = menuItems[i];
    const IY  = MY + i * ITEM_H;
    const ICX = MX + 26, ICY = IY + ITEM_H / 2;

    if (i > 0) {
      ctx.fillStyle = C.div;
      ctx.fillRect(MX + 14, IY, MW - 28, 1);
    }

    it.draw(ctx, ICX, ICY, it.danger, C);

    ctx.font = cf(17);
    ctx.fillStyle = it.danger ? C.danger : C.itemText;
    ctx.fillText(it.label, MX + 54, IY + ITEM_H / 2 + 6);
  }

  Y = MY + MH + 10;

  // ════════════════════════════════════════════════════
  // 7. STREAK PET ROW  (right-aligned, no emoji shortcuts)
  // ════════════════════════════════════════════════════
  ctx.fillStyle = C.div; ctx.fillRect(0, Y, W, 1);

  // Faint bg overlay
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, Y + 1, W, H_STREAK - 1);
  ctx.restore();

  const SCY = Y + H_STREAK / 2;

  // Streak Pet pill — right aligned, leave space for play button
  const PLAY_W = 40;
  const SP_W = 120, SP_H = 36;
  const SP_X  = W - PLAY_W - 14 - SP_W - 10;
  const SP_Y  = SCY - SP_H / 2;

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = C.streakBg;
  rr(ctx, SP_X, SP_Y, SP_W, SP_H, SP_H / 2, true, false);

  // dot/circle icon inside pill
  ctx.fillStyle = dark ? "#8888bb" : "#9090b8";
  ctx.beginPath(); ctx.arc(SP_X + SP_H / 2, SCY, SP_H / 2 - 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.60;
  ctx.font = bf(13);
  ctx.fillStyle = dark ? "#e0e0e0" : "#333355";
  ctx.fillText("Streak Pet", SP_X + SP_H + 4, SCY + 5);
  ctx.restore();

  // Play button (rounded square with triangle)
  const PL_X = W - PLAY_W - 14;
  const PL_Y = SCY - PLAY_W / 2 + 4;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = dark ? "#2a2a2a" : "#e0e0ec";
  rr(ctx, PL_X, PL_Y, PLAY_W - 8, PLAY_W - 8, 9, true, false);
  ctx.fillStyle = dark ? "#9090b8" : "#6868a0";
  ctx.beginPath();
  ctx.moveTo(PL_X + 10,  SCY + 4 - 8);
  ctx.lineTo(PL_X + 10,  SCY + 4 + 8);
  ctx.lineTo(PL_X + 24,  SCY + 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  Y += H_STREAK;

  // ════════════════════════════════════════════════════
  // 8. INPUT BAR
  // ════════════════════════════════════════════════════
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_INPUT);
  ctx.fillStyle = C.div; ctx.fillRect(0, Y, W, 1);

  const ICY2 = Y + H_INPUT / 2;

  // Camera icon (left)
  const CX = 28;
  ctx.save();
  ctx.strokeStyle = C.icon; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, CX - 13, ICY2 - 11, 26, 21, 5, false, true);
  ctx.beginPath(); ctx.arc(CX, ICY2 - 1, 5.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX + 8, ICY2 - 9); ctx.lineTo(CX + 12, ICY2 - 14); ctx.stroke();
  ctx.restore();

  // Input box
  const IX = 56, IW = W - 56 - 72, IH2 = 40, IY2 = ICY2 - IH2 / 2;
  ctx.save();
  ctx.fillStyle = C.inputBg;
  rr(ctx, IX, IY2, IW, IH2, IH2 / 2, true, false);
  ctx.restore();
  ctx.font = cf(15); ctx.fillStyle = C.sub;
  ctx.fillText("Kirim pesan...", IX + 18, ICY2 + 5);

  // Smiley / sticker icon
  const SMX = W - 50, SMY = ICY2;
  ctx.save();
  ctx.strokeStyle = C.icon; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(SMX, SMY, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.icon;
  ctx.beginPath(); ctx.arc(SMX - 4, SMY - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(SMX + 4, SMY - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(SMX, SMY + 2, 6, 0.1 * Math.PI, 0.9 * Math.PI, false); ctx.stroke();
  ctx.restore();

  // Person + lock icon (right-most)
  const PLX = W - 22, PLY = ICY2;
  ctx.save();
  ctx.strokeStyle = C.icon; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // head circle
  ctx.beginPath(); ctx.arc(PLX, PLY - 8, 5, 0, Math.PI * 2); ctx.stroke();
  // shoulders arc
  ctx.beginPath(); ctx.arc(PLX, PLY + 2, 8, Math.PI, 0, false); ctx.stroke();
  // lock body
  ctx.fillStyle = C.icon;
  rr(ctx, PLX - 5, PLY + 6, 10, 8, 2, true, false);
  // lock shackle
  ctx.strokeStyle = C.icon;
  ctx.beginPath(); ctx.arc(PLX, PLY + 6, 3, Math.PI, 0, false); ctx.stroke();
  ctx.restore();

  res.setHeader("Content-Type", "image/png");
  res.send(canvas.toBuffer("image/png"));
}

// ── ICON HELPERS ─────────────────────────────────────────────
function icoReply(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // arrowhead pointing left
  ctx.beginPath(); ctx.moveTo(cx + 14, cy - 7); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx + 14, cy + 7); ctx.stroke();
  // tail curving up-right
  ctx.beginPath(); ctx.moveTo(cx + 2, cy); ctx.quadraticCurveTo(cx + 14, cy - 1, cx + 14, cy - 8); ctx.stroke();
  ctx.restore();
}
function icoForward(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx + 2, cy - 7); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx + 2, cy + 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 14, cy); ctx.quadraticCurveTo(cx + 2, cy - 1, cx + 2, cy - 8); ctx.stroke();
  ctx.restore();
}
function icoCopy(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // front rect
  rr(ctx, cx + 1, cy - 5, 10, 11, 2, false, true);
  // back rect (offset top-left)
  rr(ctx, cx + 4, cy - 9, 10, 11, 2, false, true);
  ctx.restore();
}
function icoTranslate(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // horizontal base line
  ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 12, cy - 7); ctx.stroke();
  // vertical stem
  ctx.beginPath(); ctx.moveTo(cx + 6, cy - 7); ctx.lineTo(cx + 6, cy - 2); ctx.stroke();
  // horizontal sub-line
  ctx.beginPath(); ctx.moveTo(cx + 1, cy - 2); ctx.lineTo(cx + 11, cy - 2); ctx.stroke();
  // two diagonal legs going down
  ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2); ctx.lineTo(cx + 1, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 9, cy - 2); ctx.lineTo(cx + 11, cy + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 3, cy + 2); ctx.lineTo(cx + 11, cy + 2); ctx.stroke();
  ctx.restore();
}
function icoTrash(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.icon; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, cx + 2, cy - 4, 10, 11, 2, false, true);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 14, cy - 4);
  ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx + 4, cy - 8); ctx.lineTo(cx + 10, cy - 8); ctx.lineTo(cx + 10, cy - 4);
  ctx.stroke();
  ctx.restore();
}
function icoFlag(ctx, cx, cy, _, C) {
  ctx.save(); ctx.strokeStyle = C.danger; ctx.fillStyle = C.danger; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 13, cy - 4); ctx.lineTo(cx, cy + 1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  try { return await handleTTQC(req, res); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};
