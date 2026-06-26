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

function chatFont(size) {
  const family = hasEmojiFont ? "'Inter','NotoColorEmoji'" : "Inter";
  return `${size}px ${family}`;
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

/**
 * Query params:
 *   name       - nama pengirim (default: "User")
 *   message    - isi pesan; newline dengan \n (default: "Halo!")
 *   avatar     - URL foto profil (opsional)
 *   theme      - "light" | "dark" (default: "light")
 *   verified   - "true" | "false" (default: false)
 *   likes      - angka like (default: "")
 *   pinned     - "true" | "false" (default: false)
 *   time       - waktu e.g "2h" (default: "now")
 */
async function handleTTQC(req, res) {
  let {
    name     = "User",
    message  = "Halo!",
    avatar   = "",
    theme    = "light",
    verified = "false",
    likes    = "",
    pinned   = "false",
    time     = "now",
  } = req.query;

  const isDark     = theme === "dark";
  const isVerified = verified === "true";
  const isPinned   = pinned === "true";

  // ── Color palette ──────────────────────────────────────────
  const BG        = isDark ? "#121212"                 : "#f0f0f5";
  const CARD_BG   = isDark ? "#1a1a1a"                 : "#f0f0f5";   // same as BG, no distinct card
  const TOP_BG    = isDark ? "#1a1a1a"                 : "#ffffff";
  const MSG_BG    = isDark ? "#2a2a2a"                 : "#ffffff";   // bubble bg (left/incoming)
  const SENT_BG   = isDark ? "#6c6cff"                 : "#c8c8f0";   // sent bubble (right, blurred)
  const TEXT_NAME = isDark ? "#ffffff"                 : "#161823";
  const TEXT_MSG  = isDark ? "#e0e0e0"                 : "#161823";
  const TEXT_SUB  = isDark ? "#888888"                 : "#8a8b91";
  const DIVIDER   = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)";
  const INPUT_BG  = isDark ? "#2a2a2a"                 : "#f1f1f2";
  const MENU_BG   = isDark ? "#2a2a2a"                 : "#ffffff";

  // ── Canvas sizing ──────────────────────────────────────────
  const W         = 400;   // phone width

  // Pre-measure message
  const MSG_SIZE    = 16;
  const LINE_H      = Math.round(MSG_SIZE * 1.55);
  const AVT_R       = 20;
  const AVT_GAP     = 10;
  const BUBBLE_PADX = 14;
  const BUBBLE_PADY = 11;
  const BUBBLE_MAX_W = W - AVT_R * 2 - AVT_GAP * 2 - 24 - 16;

  const dummy = createCanvas(900, 10);
  const dc    = dummy.getContext("2d");
  dc.font     = chatFont(MSG_SIZE);
  const msgRaw   = message.replace(/\\n/g, "\n");
  const msgLines = wrapText(dc, msgRaw, BUBBLE_MAX_W - BUBBLE_PADX * 2);
  const msgTextW = msgLines.reduce((mx, l) => Math.max(mx, dc.measureText(l).width), 0);
  const bubbleW  = Math.min(BUBBLE_MAX_W, Math.max(msgTextW + BUBBLE_PADX * 2, 72));
  const bubbleH  = BUBBLE_PADY + msgLines.length * LINE_H + BUBBLE_PADY;

  // Sections heights
  const HEADER_H    = 64;    // top bar with back + avatar + name
  const BLUR_SEC_H  = 160;   // blurred bg chat area
  const REACT_H     = 58;    // emoji reaction pill
  const BUBBLE_SEC_H = AVT_R * 2 + Math.max(bubbleH, AVT_R * 2) + 8;  // avatar + bubble row
  const TIME_ROW_H  = 24;    // "now", hearts etc
  const MENU_ITEM_H = 52;
  const MENU_ITEMS  = ["Balas", "Teruskan", "Salin", "Terjemahkan", "Hapus untuk saya"];
  const MENU_DANGER = ["Laporkan"];
  const MENU_ALL    = MENU_ITEMS.length + MENU_DANGER.length;
  const MENU_H      = MENU_ALL * MENU_ITEM_H + 1;
  const MENU_W      = W - 32;
  const EMOJI_FOOT_H = 56;   // emoji reaction shortcut row above input
  const FOOTER_H    = 60;    // bottom input bar

  const H = HEADER_H + BLUR_SEC_H + REACT_H + BUBBLE_SEC_H + TIME_ROW_H + MENU_H + 16 + EMOJI_FOOT_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── Background ─────────────────────────────────────────────
  ctx.fillStyle = isDark ? "#121212" : "#f0f0f5";
  ctx.fillRect(0, 0, W, H);

  let Y = 0; // running Y cursor

  // ── HEADER ─────────────────────────────────────────────────
  ctx.fillStyle = TOP_BG;
  ctx.fillRect(0, Y, W, HEADER_H);

  // Divider bottom of header
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, Y + HEADER_H - 1, W, 1);

  // Back arrow
  const arrX = 16, arrCY = Y + HEADER_H / 2;
  ctx.save();
  ctx.strokeStyle = isDark ? "#ffffff" : "#161823";
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.beginPath();
  ctx.moveTo(arrX + 10, arrCY - 8);
  ctx.lineTo(arrX,      arrCY);
  ctx.lineTo(arrX + 10, arrCY + 8);
  ctx.stroke();
  ctx.restore();

  // Header avatar
  await drawRoundAvatar(ctx, avatar, 50, Y + HEADER_H / 2, 22);

  // Header name
  ctx.font      = boldFont(16);
  ctx.fillStyle = TEXT_NAME;
  const displayName = name.length > 18 ? name.slice(0, 17) + "…" : name;
  const nameW   = ctx.measureText(displayName).width;
  ctx.fillText(displayName, 80, Y + HEADER_H / 2 + 6);

  // Verified badge
  if (isVerified) {
    const vx = 80 + nameW + 8, vy = Y + HEADER_H / 2;
    ctx.save();
    ctx.fillStyle = "#20d5ec";
    ctx.beginPath(); ctx.arc(vx + 9, vy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.8;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(vx + 5, vy); ctx.lineTo(vx + 8, vy + 3.5); ctx.lineTo(vx + 13, vy - 3.5);
    ctx.stroke();
    ctx.restore();
  }

  // ··· dots
  const dX = W - 24, dCY = Y + HEADER_H / 2;
  ctx.fillStyle = isDark ? "#ffffff" : "#161823";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.arc(dX, dCY + i * 6, 2, 0, Math.PI * 2); ctx.fill();
  }

  Y += HEADER_H;

  // ── BLURRED BACKGROUND CHAT AREA ──────────────────────────
  // This area shows blurred/faded chat bubbles behind to match the screenshot
  // We draw them with low opacity and then apply a frosted-glass style blur overlay

  // Ghost sent bubbles (right side, purple/blue)
  const ghostSent = [
    { x: W - 110 - 16, y: Y + 14, w: 110, h: 34 },
    { x: W -  90 - 16, y: Y + 58, w:  90, h: 34 },
    { x: W - 130 - 16, y: Y + 102, w: 130, h: 34 },
    { x: W -  60 - 16, y: Y + 146, w:  60, h: 28 },
  ];
  for (const g of ghostSent) {
    ctx.save();
    ctx.globalAlpha = isDark ? 0.22 : 0.28;
    ctx.fillStyle   = isDark ? "#7070e0" : "#b8b8e8";
    rr(ctx, g.x, g.y, g.w, g.h, 17, true, false);
    ctx.restore();
  }

  // Ghost received bubbles (left side, white/grey)
  const ghostRecv = [
    { x: 52, y: Y + 36, w: 140, h: 34 },
    { x: 52, y: Y + 80, w: 180, h: 34 },
    { x: 52, y: Y + 124, w: 110, h: 34 },
  ];
  for (const g of ghostRecv) {
    ctx.save();
    ctx.globalAlpha = isDark ? 0.18 : 0.22;
    ctx.fillStyle   = isDark ? "#444" : "#d0d0dc";
    rr(ctx, g.x, g.y, g.w, g.h, 17, true, false);
    ctx.restore();
  }

  // Ghost small avatars for received
  const ghostAvtY = [Y + 52, Y + 96, Y + 140];
  for (const ay of ghostAvtY) {
    ctx.save();
    ctx.globalAlpha = isDark ? 0.18 : 0.20;
    ctx.fillStyle   = isDark ? "#555" : "#c0c0cc";
    ctx.beginPath(); ctx.arc(28, ay, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Frosted glass overlay to blur everything (simulate blur effect)
  const gradBlur = ctx.createLinearGradient(0, Y, 0, Y + BLUR_SEC_H);
  gradBlur.addColorStop(0,   isDark ? "rgba(18,18,18,0.0)"  : "rgba(240,240,245,0.0)");
  gradBlur.addColorStop(0.5, isDark ? "rgba(18,18,18,0.25)" : "rgba(240,240,245,0.25)");
  gradBlur.addColorStop(1,   isDark ? "rgba(18,18,18,0.70)" : "rgba(240,240,245,0.70)");
  ctx.fillStyle = gradBlur;
  ctx.fillRect(0, Y, W, BLUR_SEC_H);

  Y += BLUR_SEC_H;

  // ── EMOJI REACTION BAR ─────────────────────────────────────
  // White pill, centered, with 6 emoji
  const REACT_PILL_W = W - 32;
  const REACT_PILL_H = 50;
  const REACT_PILL_X = 16;
  const REACT_PILL_Y = Y + 4;

  ctx.save();
  ctx.shadowColor   = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)";
  ctx.shadowBlur    = 16;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle     = isDark ? "#2a2a2a" : "#ffffff";
  rr(ctx, REACT_PILL_X, REACT_PILL_Y, REACT_PILL_W, REACT_PILL_H, 25, true, false);
  ctx.restore();

  const EMOJIS  = ["❤️", "😂", "😭", "👍", "😡", "🤔"];
  const eSlot   = REACT_PILL_W / EMOJIS.length;
  const eSize   = 26;
  ctx.font      = `${eSize}px ${hasEmojiFont ? "NotoColorEmoji" : "sans-serif"}`;
  ctx.textAlign = "center";
  for (let i = 0; i < EMOJIS.length; i++) {
    ctx.fillText(
      EMOJIS[i],
      REACT_PILL_X + eSlot * i + eSlot / 2,
      REACT_PILL_Y + REACT_PILL_H / 2 + 9
    );
  }
  ctx.textAlign = "left";

  Y += REACT_H;

  // ── BUBBLE + AVATAR ROW ────────────────────────────────────
  const ROW_TOP  = Y + 8;
  const AVT_CX   = 16 + AVT_R;          // avatar center X
  const AVT_CY   = ROW_TOP + AVT_R;     // avatar center Y (top-aligned with bubble)
  const BX       = AVT_CX + AVT_R + AVT_GAP;  // bubble left X
  const BY       = ROW_TOP;             // bubble top Y
  const CORNER   = 18;

  // Draw avatar
  await drawRoundAvatar(ctx, avatar, AVT_CX, AVT_CY, AVT_R);

  // Draw message bubble (white, rounded, flat top-left corner near avatar)
  ctx.save();
  ctx.shadowColor   = isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.07)";
  ctx.shadowBlur    = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle     = MSG_BG;
  rrCustom(ctx, BX, BY, bubbleW, bubbleH, 4, CORNER, CORNER, CORNER);
  ctx.fill();
  ctx.restore();

  // Pinned badge inside bubble (top-right)
  if (isPinned) {
    ctx.save();
    ctx.fillStyle = isDark ? "#333" : "#f0f0f5";
    rr(ctx, BX + bubbleW - 62, BY + 7, 56, 20, 10, true, false);
    ctx.font = chatFont(11);
    ctx.fillStyle = isDark ? "#aaa" : "#8a8b91";
    ctx.fillText("📌 pinned", BX + bubbleW - 60, BY + 20);
    ctx.restore();
  }

  // Message text
  let ty = BY + BUBBLE_PADY + MSG_SIZE;
  ctx.font      = chatFont(MSG_SIZE);
  ctx.fillStyle = TEXT_MSG;
  for (const line of msgLines) {
    ctx.fillText(line, BX + BUBBLE_PADX, ty);
    ty += LINE_H;
  }

  Y += BUBBLE_SEC_H;

  // ── TIME + REACTION COUNTS ─────────────────────────────────
  const TIME_X = BX;
  ctx.font      = chatFont(12);
  ctx.fillStyle = TEXT_SUB;
  ctx.fillText(time, TIME_X, Y + 14);
  if (likes) {
    ctx.fillText(`❤️ ${likes}`, TIME_X + 44, Y + 14);
  }

  Y += TIME_ROW_H;

  // ── CONTEXT MENU ──────────────────────────────────────────
  const MENU_X = 16;
  const MENU_Y = Y + 6;

  ctx.save();
  ctx.shadowColor   = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.13)";
  ctx.shadowBlur    = 20;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle     = MENU_BG;
  rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, 16, true, false);
  ctx.restore();

  const ICON_CLR    = isDark ? "#cccccc" : "#444444";
  const ITEM_CLR    = isDark ? "#ffffff" : "#161823";
  const DANGER_CLR  = "#fe2c55";

  function drawReplyIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy - 6); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx + 13, cy + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy);
    ctx.bezierCurveTo(cx + 10, cy - 1, cx + 14, cy - 7, cx + 14, cy - 7);
    ctx.stroke();
    ctx.restore();
  }
  function drawForwardIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 6); ctx.lineTo(cx + 13, cy); ctx.lineTo(cx + 2, cy + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 13, cy);
    ctx.bezierCurveTo(cx + 5, cy - 1, cx + 1, cy - 7, cx + 1, cy - 7);
    ctx.stroke();
    ctx.restore();
  }
  function drawCopyIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    rr(ctx, cx + 1, cy - 6, 9, 10, 2, false, true);
    rr(ctx, cx + 4, cy - 9, 9, 10, 2, false, true);
    ctx.restore();
  }
  function drawTranslateIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = ICON_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 12, cy - 6);
    ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 4, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 10, cy - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 2, cy + 6);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 10, cy + 6);
    ctx.moveTo(cx + 3, cy + 3); ctx.lineTo(cx + 9, cy + 3);
    ctx.stroke();
    ctx.restore();
  }
  function drawTrashIcon(cx, cy, danger) {
    ctx.save();
    ctx.strokeStyle = danger ? DANGER_CLR : ICON_CLR;
    ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    rr(ctx, cx + 2, cy - 4, 9, 10, 2, false, true);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 13, cy - 4);
    ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx + 4, cy - 8);
    ctx.lineTo(cx + 9, cy - 8); ctx.lineTo(cx + 9, cy - 4);
    ctx.stroke();
    ctx.restore();
  }
  function drawFlagIcon(cx, cy) {
    ctx.save();
    ctx.strokeStyle = DANGER_CLR; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.fillStyle   = DANGER_CLR;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 12, cy - 3); ctx.lineTo(cx, cy + 1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const iconFns = [drawReplyIcon, drawForwardIcon, drawCopyIcon, drawTranslateIcon, drawTrashIcon];
  const allItems = [
    ...MENU_ITEMS.map((t, i) => ({ text: t, danger: false, draw: iconFns[i] })),
    ...MENU_DANGER.map(t      => ({ text: t, danger: true,  draw: drawFlagIcon })),
  ];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const iy   = MENU_Y + i * MENU_ITEM_H;

    // Divider
    if (i > 0) {
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(MENU_X + 16, iy, MENU_W - 32, 1);
    }

    // Icon
    item.draw(MENU_X + 24, iy + MENU_ITEM_H / 2, item.danger);

    // Label
    ctx.font      = chatFont(17);
    ctx.fillStyle = item.danger ? DANGER_CLR : ITEM_CLR;
    ctx.fillText(item.text, MENU_X + 52, iy + MENU_ITEM_H / 2 + 6);
  }

  Y = MENU_Y + MENU_H + 8;

  // ── EMOJI SHORTCUT FOOTER ROW ──────────────────────────────
  // From screenshot: ❤️ 😂 👍 👍 [Streak Pet] [icon]
  const EF_Y = Y;
  ctx.fillStyle = isDark ? "#1a1a1a" : "#f0f0f5";
  ctx.fillRect(0, EF_Y, W, EMOJI_FOOT_H);

  // Divider top
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, EF_Y, W, 1);

  // Draw shortcut emojis + Streak Pet
  const shortcutEmojis = ["❤️", "😂", "👍", "👍"];
  const STREAK_LABEL   = "Streak Pet";
  const SE_SIZE        = 28;
  const SE_SLOT_W      = 52;
  const SE_START_X     = 14;
  const SE_CY          = EF_Y + EMOJI_FOOT_H / 2;

  ctx.font = `${SE_SIZE}px ${hasEmojiFont ? "NotoColorEmoji" : "sans-serif"}`;
  ctx.textAlign = "center";
  for (let i = 0; i < shortcutEmojis.length; i++) {
    ctx.fillText(shortcutEmojis[i], SE_START_X + SE_SLOT_W * i + SE_SLOT_W / 2, SE_CY + 10);
  }
  ctx.textAlign = "left";

  // Streak Pet pill
  const SP_X = SE_START_X + SE_SLOT_W * shortcutEmojis.length + 4;
  const SP_W = 100, SP_H = 34;
  const SP_Y = SE_CY - SP_H / 2;
  ctx.save();
  ctx.fillStyle = isDark ? "#2a2a2a" : "#e8e8f0";
  rr(ctx, SP_X, SP_Y, SP_W, SP_H, 17, true, false);
  ctx.restore();

  // Streak pet icon (small circle with face)
  ctx.save();
  ctx.fillStyle = isDark ? "#888" : "#9090a8";
  ctx.beginPath(); ctx.arc(SP_X + 18, SE_CY, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isDark ? "#555" : "#f0f0f5";
  ctx.beginPath(); ctx.arc(SP_X + 15, SE_CY - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(SP_X + 21, SE_CY - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.font = boldFont(13);
  ctx.fillStyle = isDark ? "#e0e0e0" : "#333344";
  ctx.fillText(STREAK_LABEL, SP_X + 30, SE_CY + 5);

  // Right icon (story/video icon from screenshot)
  const STORY_X = W - 44;
  ctx.save();
  ctx.strokeStyle = isDark ? "#aaa" : "#555566";
  ctx.lineWidth = 2; ctx.lineCap = "round";
  // Play triangle inside rounded rect = story icon
  rr(ctx, STORY_X, SE_CY - 14, 28, 28, 7, false, true);
  ctx.fillStyle = isDark ? "#aaa" : "#555566";
  // Play arrow
  ctx.beginPath();
  ctx.moveTo(STORY_X + 10, SE_CY - 6);
  ctx.lineTo(STORY_X + 10, SE_CY + 6);
  ctx.lineTo(STORY_X + 20, SE_CY);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  Y = EF_Y + EMOJI_FOOT_H;

  // ── FOOTER INPUT BAR ───────────────────────────────────────
  ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
  ctx.fillRect(0, Y, W, FOOTER_H);
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, Y, W, 1);

  // Camera icon (left)
  const CAM_CX = 26, CAM_CY = Y + FOOTER_H / 2;
  ctx.save();
  ctx.strokeStyle = isDark ? "#aaa" : "#555566";
  ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  rr(ctx, CAM_CX - 12, CAM_CY - 9, 24, 18, 4, false, true);
  ctx.beginPath(); ctx.arc(CAM_CX, CAM_CY - 1, 5, 0, Math.PI * 2); ctx.stroke();
  // flash notch
  ctx.beginPath();
  ctx.moveTo(CAM_CX + 8, CAM_CY - 7);
  ctx.lineTo(CAM_CX + 11, CAM_CY - 11);
  ctx.stroke();
  ctx.restore();

  // Input box
  const INP_X = 52, INP_Y = Y + 12;
  const INP_W = W - 52 - 64, INP_H = FOOTER_H - 24;
  ctx.save();
  ctx.fillStyle = INPUT_BG;
  rr(ctx, INP_X, INP_Y, INP_W, INP_H, INP_H / 2, true, false);
  ctx.restore();
  ctx.font = chatFont(14);
  ctx.fillStyle = isDark ? "#555" : "#aaaaaa";
  ctx.fillText("Kirim pesan...", INP_X + 16, Y + FOOTER_H / 2 + 5);

  // Sticker icon
  const STK_X = W - 56, STK_CY = Y + FOOTER_H / 2;
  ctx.save();
  ctx.strokeStyle = isDark ? "#aaa" : "#555566";
  ctx.lineWidth = 1.8; ctx.lineCap = "round";
  rr(ctx, STK_X - 12, STK_CY - 12, 24, 24, 8, false, true);
  ctx.beginPath();
  ctx.arc(STK_X - 3, STK_CY - 3, 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(STK_X - 3, STK_CY - 3, 2, 0, Math.PI * 2);
  ctx.fill();
  // smiley
  ctx.beginPath();
  ctx.arc(STK_X, STK_CY + 2, 5, 0.2 * Math.PI, 0.8 * Math.PI, false);
  ctx.stroke();
  ctx.restore();

  // Mic icon
  const MIC_X = W - 26, MIC_CY = Y + FOOTER_H / 2;
  ctx.save();
  ctx.strokeStyle = isDark ? "#aaa" : "#555566";
  ctx.lineWidth = 1.8; ctx.lineCap = "round";
  rr(ctx, MIC_X - 4, MIC_CY - 10, 8, 11, 4, false, true);
  ctx.beginPath();
  ctx.arc(MIC_X, MIC_CY + 3, 6, Math.PI, 0, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(MIC_X, MIC_CY + 9); ctx.lineTo(MIC_X, MIC_CY + 13);
  ctx.stroke();
  ctx.restore();

  // ── OUTPUT ─────────────────────────────────────────────────
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
