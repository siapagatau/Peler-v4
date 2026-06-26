const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ────────────────────────────────────────────────────
let hasEmojiFont = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")), "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

const F = (size, bold = false) => {
  const family = bold
    ? (hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold")
    : (hasEmojiFont ? "'Inter','NotoColorEmoji'"     : "Inter");
  return `${bold ? "bold" : "normal"} ${size}px ${family}`;
};

// ── HELPERS ──────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);           ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x+w, y,    x+w, y+r);
  ctx.lineTo(x+w, y+h-r);         ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);           ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);             ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapText(ctx, text, maxWidth) {
  const hardLines = String(text).split("\n");
  const result = [];
  for (const hard of hardLines) {
    const words = hard.split(" ");
    let cur = "";
    for (const word of words) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && cur) {
        result.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    result.push(cur);
  }
  return result;
}

async function drawRoundAvatar(ctx, avatarUrl, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  let drawn = false;
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      drawn = true;
    } catch (_) {}
  }

  if (!drawn) {
    ctx.fillStyle = "#c8c8ce";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#8e8e96";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.52, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── MAIN HANDLER ─────────────────────────────────────────────
/**
 * Query params:
 *   name       - nama pengirim (default: "Pengguna")
 *   message    - isi pesan; newline dengan \n di URL (default: "Halo!")
 *   avatar     - URL foto profil (opsional)
 *   reactions  - emoji reaksi dipisah koma, misal "❤️,😂,👍" (default: 6 emoji TikTok)
 *   theme      - "light" | "dark" (default: "light")
 *   namecolor  - hex warna nama (default: #000000 light / #ffffff dark)
 *   time       - waktu custom misal "14:30" (default: jam server)
 *
 * Contoh:
 *   /api/ttqc?name=KaaOffc&message=no+reduo&avatar=<url>&reactions=❤️,😂,😭,👍,😡,🤔
 */
module.exports = async function handleTiktokQC(req, res) {
  let {
    name      = "Pengguna",
    message   = "Halo!",
    avatar    = "",
    reactions = "❤️,😂,😭,👍,😡,🤔",
    theme     = "light",
    namecolor = "",
    time      = "",
  } = req.query;

  const isDark = theme === "dark";

  // Warna tema
  const BG_OUTER   = isDark ? "#1a1a1a"               : "#f0f0f5";   // layar penuh
  const BG_CHAT    = isDark ? "#111111"               : "#e8e8ee";   // area chat (sedikit lebih gelap)
  const BUBBLE_BG  = isDark ? "#2a2a2e"               : "#ffffff";   // bubble pesan
  const REACT_BG   = isDark ? "#2e2e32"               : "#ffffff";   // reaction bar
  const REACT_SHD  = isDark ? "rgba(0,0,0,0.4)"       : "rgba(0,0,0,0.12)";
  const NAME_COLOR = namecolor && /^#[0-9A-F]{3,6}$/i.test(namecolor)
    ? namecolor
    : (isDark ? "#ffffff" : "#000000");
  const MSG_COLOR  = isDark ? "#e8e8e8" : "#1a1a1a";
  const TIME_COLOR = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.35)";
  const SHADOW     = isDark ? "rgba(0,0,0,0.5)"        : "rgba(0,0,0,0.10)";

  if (!time) {
    const now = new Date();
    time = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");
  }

  const msgRaw   = message.replace(/\\n/g, "\n");
  const emojiArr = reactions.split(",").map(e => e.trim()).filter(Boolean).slice(0, 8);

  // ── Layout ──────────────────────────────────────────────────
  const SCALE      = 2;          // retina
  const AVT_R      = 30;
  const AVT_DIA    = AVT_R * 2;
  const PAD_OUTER  = 28;         // margin luar canvas
  const GAP_AV_BUB = 12;        // jarak avatar ke bubble
  const BUB_PADX   = 18;
  const BUB_PADY   = 14;
  const NAME_SIZE  = 18;
  const MSG_SIZE   = 20;
  const LINE_H     = Math.round(MSG_SIZE * 1.5);
  const TIME_SIZE  = 13;
  const MAX_BW     = 500;
  const BUB_R      = 22;        // sudut bubble utama
  const REACT_H    = 58;        // tinggi reaction bar
  const REACT_GAP  = 10;        // jarak bubble ke reaction bar
  const REACT_PADX = 16;
  const TICK_SPACE = 22;        // ruang timestamp bawah

  // Ukur teks
  const dummy = createCanvas(1400, 10);
  const dc    = dummy.getContext("2d");

  dc.font = F(NAME_SIZE, true);
  const dispName = name.length > 24 ? name.slice(0, 23) + "…" : name;
  const nameW = dc.measureText(dispName).width;

  dc.font = F(MSG_SIZE, false);
  const maxMsgW = MAX_BW - BUB_PADX * 2;
  const msgLines = wrapText(dc, msgRaw, maxMsgW);
  const msgTextW = msgLines.reduce((mx, l) => Math.max(mx, dc.measureText(l).width), 0);

  dc.font = F(TIME_SIZE, false);
  const timeStr = `${time}  ✓✓`;
  const timeW   = dc.measureText(timeStr).width;

  const bubbleW = Math.min(MAX_BW, Math.max(nameW + BUB_PADX * 2, msgTextW + BUB_PADX * 2, timeW + BUB_PADX * 2 + 8));
  const nameH   = NAME_SIZE + 8;
  const msgH    = msgLines.length * LINE_H;
  const bubbleH = BUB_PADY + nameH + msgH + TICK_SPACE + BUB_PADY;

  // Ukur reaction bar
  dc.font = F(26, false);  // emoji size
  const emojiCellW = 46;
  const reactBarW  = Math.min(bubbleW, REACT_PADX * 2 + emojiArr.length * emojiCellW);

  // Total canvas size
  const totalBubRow = Math.max(bubbleH, AVT_DIA + 8);
  const CW = PAD_OUTER + AVT_DIA + GAP_AV_BUB + bubbleW + PAD_OUTER;
  const CH = PAD_OUTER + REACT_H + REACT_GAP + totalBubRow + PAD_OUTER;

  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // ── Background ────────────────────────────────────────────
  // Layer luar (seperti wallpaper chat TikTok)
  ctx.fillStyle = BG_OUTER;
  ctx.fillRect(0, 0, CW, CH);

  // Area chat sedikit lebih gelap/beda
  ctx.fillStyle = BG_CHAT;
  ctx.fillRect(0, 0, CW, CH);

  // Subtle noise / vignette ringan di atas dan bawah
  const topGrad = ctx.createLinearGradient(0, 0, 0, 60);
  topGrad.addColorStop(0, isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)");
  topGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CW, 60);

  // ── Posisi ────────────────────────────────────────────────
  const reactTop  = PAD_OUTER;
  const bubTop    = reactTop + REACT_H + REACT_GAP;
  const AVT_CX    = PAD_OUTER + AVT_R;
  const AVT_CY    = bubTop + Math.min(AVT_R + 4, bubbleH / 2);
  const bx        = PAD_OUTER + AVT_DIA + GAP_AV_BUB;
  const by        = bubTop;

  // ── Reaction Bar ─────────────────────────────────────────
  // Shadow
  ctx.save();
  ctx.shadowColor   = REACT_SHD;
  ctx.shadowBlur    = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = REACT_BG;
  rr(ctx, bx, reactTop, reactBarW, REACT_H, REACT_H / 2, true, false);
  ctx.restore();

  // Fill
  ctx.fillStyle = REACT_BG;
  rr(ctx, bx, reactTop, reactBarW, REACT_H, REACT_H / 2, true, false);

  // Stroke tipis
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  ctx.lineWidth   = 1;
  rr(ctx, bx, reactTop, reactBarW, REACT_H, REACT_H / 2, false, true);
  ctx.restore();

  // Emoji reaksi
  const emojiY = reactTop + REACT_H / 2 + 10;
  ctx.font = F(26, false);
  ctx.textAlign = "center";
  emojiArr.forEach((em, i) => {
    const ex = bx + REACT_PADX + i * emojiCellW + emojiCellW / 2;
    ctx.fillText(em, ex, emojiY);
  });
  ctx.textAlign = "left";

  // ── Avatar ────────────────────────────────────────────────
  // Ring abu tipis ala TikTok
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(AVT_CX, AVT_CY, AVT_R + 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  await drawRoundAvatar(ctx, avatar, AVT_CX, AVT_CY, AVT_R);

  // ── Bubble Pesan ─────────────────────────────────────────
  // Shadow
  ctx.save();
  ctx.shadowColor   = SHADOW;
  ctx.shadowBlur    = 20;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = BUBBLE_BG;
  rr(ctx, bx, by, bubbleW, bubbleH, BUB_R, true, false);
  ctx.restore();

  // Fill
  ctx.fillStyle = BUBBLE_BG;
  rr(ctx, bx, by, bubbleW, bubbleH, BUB_R, true, false);

  // Stroke tipis
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth   = 1;
  rr(ctx, bx, by, bubbleW, bubbleH, BUB_R, false, true);
  ctx.restore();

  // Tail kiri bawah (khas TikTok DM — ekor kecil di kiri bawah bubble)
  const tailTipX = bx - 8;
  const tailBaseY = by + Math.min(42, bubbleH * 0.35);
  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  ctx.moveTo(bx + 1,    tailBaseY);
  ctx.lineTo(tailTipX,  tailBaseY + 10);
  ctx.lineTo(bx + 1,    tailBaseY + 20);
  ctx.closePath();
  ctx.fill();

  // ── Nama ─────────────────────────────────────────────────
  let ty = by + BUB_PADY;
  ctx.font      = F(NAME_SIZE, true);
  ctx.fillStyle = NAME_COLOR;
  ctx.shadowBlur = 0;
  ctx.fillText(dispName, bx + BUB_PADX, ty + NAME_SIZE);
  ty += nameH;

  // ── Teks Pesan ───────────────────────────────────────────
  ctx.font      = F(MSG_SIZE, false);
  ctx.fillStyle = MSG_COLOR;
  for (const line of msgLines) {
    ctx.fillText(line, bx + BUB_PADX, ty + MSG_SIZE);
    ty += LINE_H;
  }

  // ── Timestamp ────────────────────────────────────────────
  ctx.font      = F(TIME_SIZE, false);
  ctx.fillStyle = TIME_COLOR;
  const tw = ctx.measureText(timeStr).width;
  ctx.fillText(timeStr, bx + bubbleW - BUB_PADX - tw, by + bubbleH - BUB_PADY + 2);

  res.setHeader("Content-Type", "image/png");
  res.send(canvas.toBuffer("image/png"));
};
