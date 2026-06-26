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

function chatFont(size, weight = "normal") {
  const family = hasEmojiFont ? "'Inter','NotoColorEmoji'" : "Inter";
  return `${weight} ${size}px ${family}`;
}
function boldFont(size) {
  const family = hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold";
  return `bold ${size}px ${family}`;
}

// ── HELPERS ──────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);   ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);   ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);       ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
  if (fill)  ctx.fill();
  if (stroke) ctx.stroke();
}

// Rounded rect with only specific corners
function rrCustom(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);   ctx.quadraticCurveTo(x + w, y,     x + w, y + tr);
  ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);   ctx.quadraticCurveTo(x,     y + h, x,     y + h - bl);
  ctx.lineTo(x, y + tl);       ctx.quadraticCurveTo(x,     y,     x + tl, y);
  ctx.closePath();
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
    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#a0a0b0";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.52, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ── MAIN HANDLER: type=ttqc ──────────────────────────────────
/**
 * Query params:
 *   name       - nama pengirim (default: "User")
 *   message    - isi pesan; newline dengan \n (default: "Halo!")
 *   avatar     - URL foto profil (opsional)
 *   theme      - "light" | "dark" (default: "light") — TikTok default terang
 *   verified   - "true" | "false" — tampilkan centang biru TikTok (default: false)
 *   likes      - angka like (default: "")
 *   username   - @username di bawah nama (opsional)
 *   pinned     - "true" | "false" — tampilkan pin badge (default: false)
 *   time       - waktu custom e.g "2h" (default: "now")
 *
 * Contoh:
 *   /api/qc?type=ttqc&name=KaaOffc&message=miku+bot+anti+redup&avatar=<url>&verified=true
 */
async function handleTTQC(req, res) {
  let {
    name     = "User",
    message  = "Halo!",
    avatar   = "",
    theme    = "light",
    verified = "false",
    likes    = "",
    username = "",
    pinned   = "false",
    time     = "now",
  } = req.query;

  const isDark     = theme === "dark";
  const isVerified = verified === "true";
  const isPinned   = pinned === "true";

  // ── Color palette (TikTok DM light/dark) ──────────────────
  const BG        = isDark ? "#121212"           : "#f0f0f5";     // overall background
  const CARD_BG   = isDark ? "#1e1e1e"           : "#ffffff";     // white phone card
  const TOP_BG    = isDark ? "#1e1e1e"           : "#ffffff";     // header bar
  const MSG_BG    = isDark ? "#2a2a2a"           : "#ffffff";     // message bubble
  const TEXT_NAME = isDark ? "#ffffff"           : "#161823";     // sender name
  const TEXT_MSG  = isDark ? "#e0e0e0"           : "#161823";     // message body
  const TEXT_SUB  = isDark ? "#888888"           : "#8a8b91";     // subtext (time, username)
  const DIVIDER   = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const INPUT_BG  = isDark ? "#2a2a2a"           : "#f1f1f2";     // bottom input bar
  const SEND_CLR  = "#fe2c55";                                    // TikTok red/pink

  // ── Measure message text ───────────────────────────────────
  const PHONE_W   = 400;
  const PHONE_H_MIN = 420;
  const HEADER_H  = 64;
  const FOOTER_H  = 64;
  const EMOJI_ROW_H = 52;
  const MSG_PAD_X = 16;
  const MSG_PAD_Y = 12;
  const AVT_R     = 20;
  const AVT_GAP   = 10;
  const BUBBLE_MAX_W = PHONE_W - AVT_R * 2 - AVT_GAP * 2 - MSG_PAD_X * 2 - 12;
  const MSG_SIZE  = 17;
  const LINE_H    = Math.round(MSG_SIZE * 1.5);
  const CORNER    = 18;

  const dummy = createCanvas(900, 10);
  const dc    = dummy.getContext("2d");
  dc.font     = chatFont(MSG_SIZE);
  const msgRaw   = message.replace(/\\n/g, "\n");
  const msgLines = wrapText(dc, msgRaw, BUBBLE_MAX_W - 24);
  const msgTextW = msgLines.reduce((mx, l) => Math.max(mx, dc.measureText(l).width), 0);

  const bubbleInnerH = MSG_PAD_Y + msgLines.length * LINE_H + MSG_PAD_Y;
  const bubbleW  = Math.min(BUBBLE_MAX_W, Math.max(msgTextW + 24, 80));

  // Context menu items (like in screenshot)
  const MENU_ITEMS = ["Balas", "Teruskan", "Salin", "Terjemahkan", "Hapus untuk saya"];
  const MENU_DANGER = ["Laporkan"];
  const MENU_ITEM_H = 52;
  const MENU_W     = PHONE_W - 40;
  const MENU_H     = (MENU_ITEMS.length + MENU_DANGER.length) * MENU_ITEM_H + 8;
  const MENU_CORNER = 16;

  // Emoji reaction bar
  const REACTION_EMOJIS = ["❤️", "😂", "😭", "👍", "😡", "🤔"];

  // Calculate total canvas height
  const MSG_AREA_H = 56 + bubbleInnerH + 12;        // avatar row + bubble + gap
  const PHONE_H    = HEADER_H + EMOJI_ROW_H + MSG_AREA_H + MENU_H + FOOTER_H + 16;

  // Outer canvas — slight padding + subtle shadow effect
  const PAD_OUTER = 40;
  const CW = PHONE_W + PAD_OUTER * 2;
  const CH = PHONE_H + PAD_OUTER * 2;

  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // ── Outer background ───────────────────────────────────────
  if (isDark) {
    ctx.fillStyle = "#0a0a0a";
  } else {
    const obg = ctx.createLinearGradient(0, 0, CW, CH);
    obg.addColorStop(0, "#e8e8f0");
    obg.addColorStop(1, "#d8d8e8");
    ctx.fillStyle = obg;
  }
  ctx.fillRect(0, 0, CW, CH);

  // ── Phone card (white rounded rect) ───────────────────────
  const PX = PAD_OUTER, PY = PAD_OUTER;
  ctx.save();
  ctx.shadowColor  = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.18)";
  ctx.shadowBlur   = 36;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle    = CARD_BG;
  rr(ctx, PX, PY, PHONE_W, PHONE_H, 24, true, false);
  ctx.restore();
  // clip phone area
  ctx.save();
  rr(ctx, PX, PY, PHONE_W, PHONE_H, 24, true, false);
  ctx.clip();

  // ── HEADER BAR ─────────────────────────────────────────────
  ctx.fillStyle = TOP_BG;
  ctx.fillRect(PX, PY, PHONE_W, HEADER_H);

  // Back arrow
  const arrX = PX + 16, arrY = PY + HEADER_H / 2;
  ctx.strokeStyle = isDark ? "#ffffff" : "#161823";
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.beginPath();
  ctx.moveTo(arrX + 10, arrY - 8);
  ctx.lineTo(arrX,      arrY);
  ctx.lineTo(arrX + 10, arrY + 8);
  ctx.stroke();

  // Header avatar
  const HAV_CX = PX + 52, HAV_CY = PY + HEADER_H / 2, HAV_R = 20;
  await drawRoundAvatar(ctx, avatar, HAV_CX, HAV_CY, HAV_R);

  // Header name
  ctx.font      = boldFont(16);
  ctx.fillStyle = TEXT_NAME;
  ctx.fillText(name.length > 18 ? name.slice(0,17)+"…" : name, PX + 80, PY + HEADER_H / 2 + 6);

  // Verified badge (blue checkmark circle)
  if (isVerified) {
    const vx = PX + 80 + ctx.measureText(name.length > 18 ? name.slice(0,17)+"…" : name).width + 8;
    const vy = PY + HEADER_H / 2 - 1;
    ctx.save();
    ctx.fillStyle = "#20d5ec"; // TikTok blue
    ctx.beginPath();
    ctx.arc(vx + 9, vy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(vx + 5, vy);
    ctx.lineTo(vx + 8, vy + 3.5);
    ctx.lineTo(vx + 13, vy - 3.5);
    ctx.stroke();
    ctx.restore();
  }

  // ··· menu dots
  const dotsX = PX + PHONE_W - 28, dotsY = PY + HEADER_H / 2;
  ctx.fillStyle = isDark ? "#ffffff" : "#161823";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(dotsX, dotsY + i * 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Header divider
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(PX, PY + HEADER_H, PHONE_W, 1);

  // ── BLURRED BACKGROUND MESSAGES (decorative) ──────────────
  let curY = PY + HEADER_H + 8;

  // Some ghost message bubbles behind (blurred, for atmosphere like screenshot)
  const ghostBubbles = [
    { right: true, w: 160, h: 32, y: curY + 6 },
    { right: false, w: 200, h: 32, y: curY + 14 },
    { right: true, w: 120, h: 32, y: curY + 52 },
  ];
  for (const gb of ghostBubbles) {
    ctx.save();
    ctx.globalAlpha = isDark ? 0.18 : 0.13;
    ctx.fillStyle = isDark ? "#555" : "#c0c0d0";
    const gx = gb.right ? PX + PHONE_W - gb.w - 16 : PX + 52;
    rr(ctx, gx, gb.y, gb.w, gb.h, 16, true, false);
    ctx.restore();
  }

  curY += 88;

  // ── EMOJI REACTION BAR ─────────────────────────────────────
  const REAC_Y = curY;
  ctx.save();
  ctx.shadowColor  = isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)";
  ctx.shadowBlur   = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle    = isDark ? "#2e2e2e" : "#ffffff";
  rr(ctx, PX + 12, REAC_Y, PHONE_W - 24, EMOJI_ROW_H - 6, 24, true, false);
  ctx.restore();

  const emojiSpacing = (PHONE_W - 24) / REACTION_EMOJIS.length;
  for (let i = 0; i < REACTION_EMOJIS.length; i++) {
    ctx.font = `${28}px ${hasEmojiFont ? "NotoColorEmoji" : "sans-serif"}`;
    ctx.textAlign = "center";
    ctx.fillStyle = TEXT_MSG;
    ctx.fillText(
      REACTION_EMOJIS[i],
      PX + 12 + emojiSpacing * i + emojiSpacing / 2,
      REAC_Y + EMOJI_ROW_H / 2 + 9
    );
  }
  ctx.textAlign = "left";
  curY += EMOJI_ROW_H + 4;

  // ── QUOTED MESSAGE (main bubble) ──────────────────────────
  const MSG_Y   = curY;
  const AVT_CX  = PX + MSG_PAD_X + AVT_R;
  const AVT_CY  = MSG_Y + AVT_R + 8;

  // Avatar
  await drawRoundAvatar(ctx, avatar, AVT_CX, AVT_CY, AVT_R);

  // Message bubble
  const BX = AVT_CX + AVT_R + AVT_GAP;
  const BY = MSG_Y;
  ctx.save();
  ctx.shadowColor  = isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)";
  ctx.shadowBlur   = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle    = MSG_BG;
  // TikTok bubble: top-left corner flat (near avatar), others rounded
  rrCustom(ctx, BX, BY, bubbleW, bubbleInnerH, 4, CORNER, CORNER, CORNER);
  ctx.fill();
  ctx.restore();

  // Message text
  let ty = BY + MSG_PAD_Y + MSG_SIZE;
  ctx.font      = chatFont(MSG_SIZE);
  ctx.fillStyle = TEXT_MSG;
  for (const line of msgLines) {
    ctx.fillText(line, BX + 12, ty);
    ty += LINE_H;
  }

  // Pinned badge
  if (isPinned) {
    ctx.save();
    ctx.fillStyle = isDark ? "#333" : "#f0f0f5";
    rr(ctx, BX + bubbleW - 60, BY + 6, 54, 22, 11, true, false);
    ctx.fillStyle = isDark ? "#aaa" : "#8a8b91";
    ctx.font = chatFont(11);
    ctx.fillText("📌 pinned", BX + bubbleW - 57, BY + 20);
    ctx.restore();
  }

  curY += bubbleInnerH + 8;

  // Time + reactions row
  ctx.font      = chatFont(12);
  ctx.fillStyle = TEXT_SUB;
  ctx.fillText(time, BX, curY + 12);
  if (likes) {
    ctx.fillText(`❤️ ${likes}`, BX + 44, curY + 12);
  }
  curY += 20;

  // ── CONTEXT MENU ──────────────────────────────────────────
  const MENU_X = PX + 20;
  const MENU_Y = curY + 6;

  ctx.save();
  ctx.shadowColor  = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)";
  ctx.shadowBlur   = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle    = isDark ? "#2a2a2a" : "#ffffff";
  rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, MENU_CORNER, true, false);
  ctx.restore();

  // Menu items
  const ICON_CLR  = isDark ? "#cccccc" : "#444444";
  const ITEM_TXT  = isDark ? "#ffffff" : "#161823";
  const ITEM_DANGER_CLR = "#fe2c55";

  // Icon draw helpers
  function drawReplyIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 12, cy - 6);
    ctx.lineTo(cx + 2, cy);
    ctx.lineTo(cx + 12, cy + 6);
    ctx.moveTo(cx + 2, cy);
    ctx.quadraticCurveTo(cx + 10, cy, cx + 10, cy - 5);
    ctx.stroke();
    ctx.restore();
  }
  function drawForwardIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.moveTo(cx + 10, cy);
    ctx.quadraticCurveTo(cx + 2, cy, cx + 2, cy - 5);
    ctx.stroke();
    ctx.restore();
  }
  function drawCopyIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    rr(ctx, cx, cy - 7, 9, 10, 2, false, true);
    rr(ctx, cx + 3, cy - 10, 9, 10, 2, false, true);
    ctx.restore();
  }
  function drawTranslateIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 12, cy - 6);
    ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 6, cy - 2);
    ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 10, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 2); ctx.lineTo(cx + 8, cy + 6);
    ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 6, cy + 6);
    ctx.moveTo(cx + 5, cy + 2); ctx.lineTo(cx + 9, cy + 2);
    ctx.stroke();
    ctx.restore();
  }
  function drawTrashIcon(cx, cy, danger) {
    ctx.save();
    ctx.strokeStyle = danger ? ITEM_DANGER_CLR : ICON_CLR;
    ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    rr(ctx, cx + 2, cy - 5, 9, 10, 1, false, true);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 13, cy - 5);
    ctx.moveTo(cx + 4, cy - 5); ctx.lineTo(cx + 4, cy - 8);
    ctx.lineTo(cx + 9, cy - 8); ctx.lineTo(cx + 9, cy - 5);
    ctx.stroke();
    ctx.restore();
  }
  function drawFlagIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ITEM_DANGER_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.fillStyle   = ITEM_DANGER_CLR;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 11, cy - 3); ctx.lineTo(cx, cy + 1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const iconDrawers = [drawReplyIcon, drawForwardIcon, drawCopyIcon, drawTranslateIcon, drawTrashIcon];
  const allItems = [...MENU_ITEMS.map((t,i) => ({text:t, danger:false, draw:iconDrawers[i]})),
                    ...MENU_DANGER.map(t => ({text:t, danger:true, draw:drawFlagIcon}))];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const iy = MENU_Y + i * MENU_ITEM_H;

    // Divider (not first)
    if (i > 0) {
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(MENU_X + 16, iy, MENU_W - 32, 1);
    }

    // Icon
    const ICX = MENU_X + 24, ICY = iy + MENU_ITEM_H / 2;
    item.draw(ICX, ICY, item.danger);

    // Label
    ctx.font      = chatFont(17);
    ctx.fillStyle = item.danger ? ITEM_DANGER_CLR : ITEM_TXT;
    ctx.fillText(item.text, MENU_X + 52, iy + MENU_ITEM_H / 2 + 6);
  }

  curY = MENU_Y + MENU_H + 8;

  // ── FOOTER INPUT BAR ───────────────────────────────────────
  const FOOT_Y = PY + PHONE_H - FOOTER_H;
  ctx.fillStyle = isDark ? "#1e1e1e" : "#ffffff";
  ctx.fillRect(PX, FOOT_Y, PHONE_W, FOOTER_H);
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(PX, FOOT_Y, PHONE_W, 1);

  // Camera icon
  const CAM_X = PX + 14, CAM_Y = FOOT_Y + FOOTER_H / 2;
  ctx.strokeStyle = isDark ? "#aaa" : "#555";
  ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, CAM_X, CAM_Y - 9, 24, 18, 4, false, true);
  ctx.beginPath(); ctx.arc(CAM_X + 12, CAM_Y - 1, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CAM_X + 19, CAM_Y - 7); ctx.lineTo(CAM_X + 22, CAM_Y - 10); ctx.stroke();

  // Input box
  ctx.save();
  ctx.fillStyle = INPUT_BG;
  rr(ctx, PX + 46, FOOT_Y + 10, PHONE_W - 100, FOOTER_H - 20, 22, true, false);
  ctx.restore();
  ctx.font      = chatFont(15);
  ctx.fillStyle = isDark ? "#555" : "#aaa";
  ctx.fillText("Kirim pesan...", PX + 62, FOOT_Y + FOOTER_H / 2 + 5);

  // Emoji + mic icons
  const rightIcons = [PX + PHONE_W - 50, PX + PHONE_W - 22];
  // Emoji sticker icon
  ctx.strokeStyle = isDark ? "#aaa" : "#555";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(rightIcons[0] - 6, FOOT_Y + FOOTER_H / 2, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = isDark ? "#aaa" : "#555";
  ctx.beginPath(); ctx.arc(rightIcons[0] - 9, FOOT_Y + FOOTER_H / 2 - 2, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rightIcons[0] - 3, FOOT_Y + FOOTER_H / 2 - 2, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.arc(rightIcons[0] - 6, FOOT_Y + FOOTER_H / 2 + 1, 4, 0, Math.PI, false);
  ctx.stroke();

  // Mic icon
  ctx.strokeStyle = isDark ? "#aaa" : "#555";
  ctx.lineWidth = 1.8; ctx.lineCap = "round";
  rr(ctx, rightIcons[1] - 4, FOOT_Y + FOOTER_H / 2 - 9, 8, 10, 4, false, true);
  ctx.beginPath();
  ctx.arc(rightIcons[1], FOOT_Y + FOOTER_H / 2 + 4, 5, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightIcons[1], FOOT_Y + FOOTER_H / 2 + 9);
  ctx.lineTo(rightIcons[1], FOOT_Y + FOOTER_H / 2 + 13);
  ctx.stroke();

  // Reaction row at very bottom (TikTok style)
  // Already handled via emoji bar above

  ctx.restore(); // end clip

  res.setHeader("Content-Type", "image/png");
  res.send(canvas.toBuffer("image/png"));
}

// ── ENTRY POINT ───────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    return await handleTTQC(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
