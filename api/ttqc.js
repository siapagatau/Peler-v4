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

function cf(size, bold = false) {
  const fam = hasEmojiFont
    ? (bold ? "'InterBold','NotoColorEmoji'" : "'Inter','NotoColorEmoji'")
    : (bold ? "InterBold" : "Inter");
  return `${bold ? "bold" : "normal"} ${size}px ${fam}`;
}

// ── HELPERS ──────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);     ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
  ctx.lineTo(x+w, y+h-r);       ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);         ctx.quadraticCurveTo(x, y+h,   x, y+h-r);
  ctx.lineTo(x, y+r);           ctx.quadraticCurveTo(x, y,     x+r, y);
  ctx.closePath();
}

// Bubble: top-left corner kecil (dekat avatar), sisanya rounded normal
function bubblePath(ctx, x, y, w, h, r) {
  const tl = 4, tr = r, br = r, bl = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);    ctx.quadraticCurveTo(x+w, y,   x+w, y+tr);
  ctx.lineTo(x+w, y+h-br);      ctx.quadraticCurveTo(x+w, y+h, x+w-br, y+h);
  ctx.lineTo(x+bl, y+h);        ctx.quadraticCurveTo(x, y+h,   x, y+h-bl);
  ctx.lineTo(x, y+tl);          ctx.quadraticCurveTo(x, y,     x+tl, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const out = [];
  for (const hard of String(text).replace(/\\n/g, "\n").split("\n")) {
    const words = hard.split(" ");
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; }
      else cur = t;
    }
    out.push(cur);
  }
  return out;
}

async function drawAvatar(ctx, url, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  let ok = false;
  if (url) { try { ctx.drawImage(await loadImage(url), cx-r, cy-r, r*2, r*2); ok = true; } catch(_){} }
  if (!ok) {
    // TikTok default grey silhouette
    ctx.fillStyle = "#c8c8d4"; ctx.fillRect(cx-r, cy-r, r*2, r*2);
    ctx.fillStyle = "#a0a0b2";
    ctx.beginPath(); ctx.arc(cx, cy - r*0.1, r*0.38, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r*0.62, r*0.52, r*0.36, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ── MAIN ─────────────────────────────────────────────────────
/**
 * Query params:
 *   name      - nama pengirim (default: "User")
 *   message   - isi pesan; gunakan \n untuk newline (default: "Halo!")
 *   avatar    - URL foto profil
 *   theme     - "light" | "dark" (default: "light")
 *   verified  - "true" tampilkan centang biru
 *   time      - waktu misal "2h" (default: "now")
 *   likes     - angka like misal "1.2K" (default: kosong)
 *
 * Contoh:
 *   /api/qc?type=ttqc&name=KaaOffc&message=miku+bot+anti+redup&avatar=<url>
 */
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      name     = "User",
      message  = "Halo!",
      avatar   = "",
      theme    = "light",
      verified = "false",
      time     = "now",
      likes    = "",
    } = req.query;

    const isDark     = theme === "dark";
    const isVerified = verified === "true";

    // ── Palette ───────────────────────────────────────────────
    // Outer background — lavender seperti screenshot
    const BG_OUTER   = isDark ? "#0f0f14" : "#e8e8f2";
    // Card putih
    const CARD_BG    = isDark ? "#1c1c22" : "#ffffff";
    // Header
    const HDR_BG     = isDark ? "#1c1c22" : "#ffffff";
    const HDR_TEXT   = isDark ? "#ffffff" : "#111111";
    const HDR_ICON   = isDark ? "#cccccc" : "#333333";
    // Emoji bar
    const EBAR_BG    = isDark ? "#2a2a35" : "#ffffff";
    // Bubble pesan
    const BUBBLE_BG  = isDark ? "#2e2e3a" : "#ffffff";
    const BUBBLE_TXT = isDark ? "#e8e8e8" : "#111111";
    // Timestamp
    const TIME_TXT   = isDark ? "#666677" : "#888899";
    // Context menu
    const MENU_BG    = isDark ? "#232330" : "#ffffff";
    const MENU_TXT   = isDark ? "#e0e0e0" : "#111111";
    const MENU_DIV   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
    const MENU_ICON  = isDark ? "#aaaaaa" : "#444444";
    const DANGER_CLR = "#fe2c55";
    // Input bar
    const FOOT_BG    = isDark ? "#1c1c22" : "#ffffff";
    const INPUT_BG   = isDark ? "#2a2a35" : "#f1f1f4";
    const INPUT_PH   = isDark ? "#555566" : "#aaaaaa";

    // ── Dimensions ────────────────────────────────────────────
    // Mengikuti proporsi screenshot: lebar ~480px (2x scale dari 240px content)
    const SCALE    = 2;          // render 2x lalu kirim langsung (no downscale, terlihat tajam)
    const CW_CSS   = 300;        // lebar card dalam "css pixels"
    const CW       = CW_CSS * SCALE;

    const CARD_RX   = 20 * SCALE;   // card corner radius
    const OUTER_PAD = 22 * SCALE;   // padding luar (lavender border)

    // Header
    const HDR_H    = 56 * SCALE;
    const AVT_R    = 18 * SCALE;    // radius avatar header

    // Ghost bubbles area
    const GHOST_H  = 68 * SCALE;

    // Emoji bar
    const EBAR_H   = 52 * SCALE;
    const EBAR_MX  = 0;             // margin x (rata kiri card)
    const EBAR_R   = 24 * SCALE;

    // Message area
    const MSG_AVT_R   = 20 * SCALE;
    const MSG_AVT_GAP = 8 * SCALE;
    const BUBBLE_R    = 16 * SCALE;
    const BUBBLE_PADX = 14 * SCALE;
    const BUBBLE_PADY = 10 * SCALE;
    const MSG_SIZE    = 15 * SCALE;
    const LINE_H      = Math.round(MSG_SIZE * 1.5);
    const MAX_BUB_W   = (CW_CSS - 20 - MSG_AVT_R/SCALE*2 - MSG_AVT_GAP/SCALE - 16) * SCALE;

    // Measure bubble
    const dummy  = createCanvas(2000, 10);
    const dc     = dummy.getContext("2d");
    dc.font      = cf(MSG_SIZE);
    const msgLines = wrapText(dc, message, MAX_BUB_W - BUBBLE_PADX * 2);
    const msgTextW = msgLines.reduce((mx, l) => Math.max(mx, dc.measureText(l).width), 0);
    const bubW     = Math.max(msgTextW + BUBBLE_PADX * 2, 60 * SCALE);
    const bubH     = BUBBLE_PADY + msgLines.length * LINE_H + BUBBLE_PADY;

    const MSG_AREA_H = Math.max(MSG_AVT_R * 2, bubH) + 6 * SCALE;
    const TIME_H     = 20 * SCALE;

    // Context menu
    const MENU_ITEMS = [
      { label: "Balas",          icon: "reply",     danger: false },
      { label: "Teruskan",       icon: "forward",   danger: false },
      { label: "Salin",          icon: "copy",      danger: false },
      { label: "Terjemahkan",    icon: "translate", danger: false },
      { label: "Hapus untuk saya", icon: "trash",   danger: false },
      { label: "Laporkan",       icon: "flag",      danger: true  },
    ];
    const ITEM_H   = 52 * SCALE;
    const MENU_H   = MENU_ITEMS.length * ITEM_H;
    const MENU_R   = 14 * SCALE;

    // Footer
    const FOOT_H   = 56 * SCALE;

    // Total card height
    const CARD_H = HDR_H + GHOST_H + EBAR_H + (8 * SCALE) + MSG_AREA_H + TIME_H + (8 * SCALE) + MENU_H + (8 * SCALE) + FOOT_H;

    // Total canvas
    const TOT_W = CW + OUTER_PAD * 2;
    const TOT_H = CARD_H + OUTER_PAD * 2;

    const canvas = createCanvas(TOT_W, TOT_H);
    const ctx    = canvas.getContext("2d");

    // ── Outer background ──────────────────────────────────────
    ctx.fillStyle = BG_OUTER;
    ctx.fillRect(0, 0, TOT_W, TOT_H);

    // ── Card ─────────────────────────────────────────────────
    const CX = OUTER_PAD, CY = OUTER_PAD;

    ctx.save();
    ctx.shadowColor   = isDark ? "rgba(0,0,0,0.7)" : "rgba(100,100,140,0.18)";
    ctx.shadowBlur    = 28 * SCALE;
    ctx.shadowOffsetY = 6 * SCALE;
    ctx.fillStyle = CARD_BG;
    rr(ctx, CX, CY, CW, CARD_H, CARD_RX);
    ctx.fill();
    ctx.restore();

    // Clip to card
    ctx.save();
    rr(ctx, CX, CY, CW, CARD_H, CARD_RX);
    ctx.clip();

    let Y = CY; // running Y cursor

    // ── HEADER ───────────────────────────────────────────────
    ctx.fillStyle = HDR_BG;
    ctx.fillRect(CX, Y, CW, HDR_H);

    // Back arrow <
    const ARX = CX + 16 * SCALE, ARY = Y + HDR_H / 2;
    ctx.strokeStyle = HDR_ICON; ctx.lineWidth = 1.8 * SCALE;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ARX + 8 * SCALE, ARY - 7 * SCALE);
    ctx.lineTo(ARX,             ARY);
    ctx.lineTo(ARX + 8 * SCALE, ARY + 7 * SCALE);
    ctx.stroke();

    // Avatar header
    const HAX = CX + 40 * SCALE, HAY = Y + HDR_H / 2;
    await drawAvatar(ctx, avatar, HAX, HAY, AVT_R);

    // Name
    ctx.font      = cf(15 * SCALE, true);
    ctx.fillStyle = HDR_TEXT;
    const nameDisp = name.length > 16 ? name.slice(0,15)+"…" : name;
    ctx.fillText(nameDisp, HAX + AVT_R + 10 * SCALE, Y + HDR_H / 2 + 5 * SCALE);

    // Verified badge
    if (isVerified) {
      const vbx = HAX + AVT_R + 10 * SCALE + ctx.measureText(nameDisp).width + 6 * SCALE;
      const vby = Y + HDR_H / 2;
      ctx.save();
      ctx.fillStyle = "#20d5ec";
      ctx.beginPath(); ctx.arc(vbx + 8 * SCALE, vby, 8 * SCALE, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6 * SCALE; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(vbx + 4 * SCALE,  vby);
      ctx.lineTo(vbx + 7 * SCALE,  vby + 3 * SCALE);
      ctx.lineTo(vbx + 12 * SCALE, vby - 3.5 * SCALE);
      ctx.stroke();
      ctx.restore();
    }

    // ··· dots (vertical)
    const DTX = CX + CW - 18 * SCALE, DTY = Y + HDR_H / 2;
    ctx.fillStyle = HDR_ICON;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(DTX, DTY + i * 5 * SCALE, 2 * SCALE, 0, Math.PI*2); ctx.fill();
    }

    // Header bottom divider
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(CX, Y + HDR_H - 1, CW, 1);

    Y += HDR_H;

    // ── GHOST BUBBLES ─────────────────────────────────────────
    // Tiga bubble abu blur (seperti pesan sebelumnya yang tidak terbaca)
    const ghosts = [
      { x: CX + CW - 170 * SCALE, w: 145 * SCALE, h: 26 * SCALE, y: Y + 10 * SCALE, right: true },
      { x: CX + 10 * SCALE,       w: 185 * SCALE, h: 26 * SCALE, y: Y + 14 * SCALE, right: false },
      { x: CX + CW - 140 * SCALE, w: 115 * SCALE, h: 26 * SCALE, y: Y + 50 * SCALE, right: true },
    ];
    for (const g of ghosts) {
      ctx.save();
      ctx.globalAlpha = isDark ? 0.2 : 0.25;
      ctx.fillStyle   = isDark ? "#555577" : "#c8c8d8";
      rr(ctx, g.x, g.y, g.w, g.h, 13 * SCALE); ctx.fill();
      ctx.restore();
    }
    Y += GHOST_H;

    // ── EMOJI REACTION BAR ────────────────────────────────────
    const EBAR_X = CX + 0;
    const EBAR_Y = Y;
    const EBAR_W = CW - 0;

    ctx.save();
    ctx.shadowColor  = isDark ? "rgba(0,0,0,0.3)" : "rgba(100,100,140,0.12)";
    ctx.shadowBlur   = 10 * SCALE; ctx.shadowOffsetY = 3 * SCALE;
    ctx.fillStyle = EBAR_BG;
    rr(ctx, EBAR_X, EBAR_Y, EBAR_W, EBAR_H, EBAR_R); ctx.fill();
    ctx.restore();

    const EMOJIS = ["❤️","😂","😭","👍","😡","🤔"];
    const eSlot  = EBAR_W / EMOJIS.length;
    ctx.font     = hasEmojiFont
      ? `${28 * SCALE}px NotoColorEmoji`
      : `${28 * SCALE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < EMOJIS.length; i++) {
      ctx.fillText(EMOJIS[i], EBAR_X + eSlot * i + eSlot / 2, EBAR_Y + EBAR_H / 2);
    }
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
    Y += EBAR_H + 8 * SCALE;

    // ── MESSAGE ROW ───────────────────────────────────────────
    const MSG_Y  = Y;
    const AVMX   = CX + 10 * SCALE;
    const AVMY   = MSG_Y + MSG_AVT_R;

    await drawAvatar(ctx, avatar, AVMX + MSG_AVT_R, AVMY, MSG_AVT_R);

    const BUB_X = AVMX + MSG_AVT_R * 2 + MSG_AVT_GAP;
    const BUB_Y = MSG_Y;

    ctx.save();
    ctx.shadowColor  = isDark ? "rgba(0,0,0,0.25)" : "rgba(100,100,140,0.1)";
    ctx.shadowBlur   = 6 * SCALE; ctx.shadowOffsetY = 2 * SCALE;
    ctx.fillStyle = BUBBLE_BG;
    bubblePath(ctx, BUB_X, BUB_Y, bubW, bubH, BUBBLE_R); ctx.fill();
    ctx.restore();

    ctx.font      = cf(MSG_SIZE);
    ctx.fillStyle = BUBBLE_TXT;
    let ty = BUB_Y + BUBBLE_PADY + MSG_SIZE;
    for (const line of msgLines) {
      ctx.fillText(line, BUB_X + BUBBLE_PADX, ty);
      ty += LINE_H;
    }

    Y += Math.max(MSG_AVT_R * 2, bubH) + 6 * SCALE;

    // Timestamp
    ctx.font      = cf(11 * SCALE);
    ctx.fillStyle = TIME_TXT;
    const timeStr = likes ? `${time}  ❤️ ${likes}` : time;
    ctx.fillText(timeStr, AVMX, Y + 13 * SCALE);
    Y += TIME_H + 8 * SCALE;

    // ── CONTEXT MENU ─────────────────────────────────────────
    const MX = CX + 0;
    const MY = Y;
    const MW = CW;

    ctx.save();
    ctx.shadowColor  = isDark ? "rgba(0,0,0,0.4)" : "rgba(100,100,140,0.14)";
    ctx.shadowBlur   = 16 * SCALE; ctx.shadowOffsetY = 4 * SCALE;
    ctx.fillStyle = MENU_BG;
    rr(ctx, MX, MY, MW, MENU_H, MENU_R); ctx.fill();
    ctx.restore();

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      const IY   = MY + i * ITEM_H;
      const ICX  = MX + 22 * SCALE;
      const ICY  = IY + ITEM_H / 2;
      const IC   = item.danger ? DANGER_CLR : MENU_ICON;

      // Divider
      if (i > 0) {
        ctx.fillStyle = MENU_DIV;
        ctx.fillRect(MX + 16 * SCALE, IY, MW - 32 * SCALE, 1);
      }

      // Icons
      ctx.strokeStyle = IC; ctx.fillStyle = IC;
      ctx.lineWidth = 1.7 * SCALE; ctx.lineCap = "round"; ctx.lineJoin = "round";

      const S = SCALE; // shorthand
      if (item.icon === "reply") {
        // < arrow (back)
        ctx.beginPath();
        ctx.moveTo(ICX + 9*S, ICY - 6*S); ctx.lineTo(ICX, ICY); ctx.lineTo(ICX + 9*S, ICY + 6*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX, ICY);
        ctx.quadraticCurveTo(ICX + 8*S, ICY, ICX + 8*S, ICY - 5*S);
        ctx.stroke();
      } else if (item.icon === "forward") {
        // > arrow
        ctx.beginPath();
        ctx.moveTo(ICX, ICY - 6*S); ctx.lineTo(ICX + 9*S, ICY); ctx.lineTo(ICX, ICY + 6*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX + 9*S, ICY);
        ctx.quadraticCurveTo(ICX + 1*S, ICY, ICX + 1*S, ICY - 5*S);
        ctx.stroke();
      } else if (item.icon === "copy") {
        // two overlapping rects
        ctx.strokeRect(ICX + 2*S, ICY - 7*S, 8*S, 9*S);
        ctx.strokeRect(ICX, ICY - 10*S, 8*S, 9*S);
      } else if (item.icon === "translate") {
        // simplified translate symbol (like screenshot ≜)
        ctx.beginPath();
        ctx.moveTo(ICX, ICY - 7*S); ctx.lineTo(ICX + 11*S, ICY - 7*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX + 5*S, ICY - 7*S); ctx.lineTo(ICX + 5*S, ICY - 2*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX + 2*S, ICY - 2*S); ctx.lineTo(ICX + 8*S, ICY - 2*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX + 3*S, ICY - 2*S); ctx.lineTo(ICX + 6*S, ICY + 5*S);
        ctx.moveTo(ICX + 9*S, ICY - 2*S); ctx.lineTo(ICX + 6*S, ICY + 5*S);
        ctx.stroke();
      } else if (item.icon === "trash") {
        // trash can
        ctx.beginPath();
        ctx.moveTo(ICX, ICY - 5*S); ctx.lineTo(ICX + 11*S, ICY - 5*S); ctx.stroke();
        ctx.strokeRect(ICX + 2*S, ICY - 5*S, 8*S, 10*S);
        ctx.beginPath();
        ctx.moveTo(ICX + 4*S, ICY - 5*S); ctx.lineTo(ICX + 4*S, ICY - 8*S);
        ctx.lineTo(ICX + 8*S, ICY - 8*S); ctx.lineTo(ICX + 8*S, ICY - 5*S); ctx.stroke();
      } else if (item.icon === "flag") {
        ctx.fillStyle = IC;
        ctx.beginPath();
        ctx.moveTo(ICX, ICY - 8*S);
        ctx.lineTo(ICX + 11*S, ICY - 3*S);
        ctx.lineTo(ICX, ICY + 2*S);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ICX, ICY - 8*S); ctx.lineTo(ICX, ICY + 8*S); ctx.stroke();
      }

      // Label
      ctx.font      = cf(15 * SCALE);
      ctx.fillStyle = item.danger ? DANGER_CLR : MENU_TXT;
      ctx.fillText(item.label, MX + 48 * SCALE, IY + ITEM_H / 2 + 5 * SCALE);
    }

    Y += MENU_H + 8 * SCALE;

    // ── FOOTER ───────────────────────────────────────────────
    const FY = Y;
    ctx.fillStyle = FOOT_BG;
    ctx.fillRect(CX, FY, CW, FOOT_H);
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(CX, FY, CW, 1);

    // Camera icon
    const CAX = CX + 14 * SCALE, CAY = FY + FOOT_H / 2;
    ctx.strokeStyle = isDark ? "#888" : "#555"; ctx.lineWidth = 1.7 * SCALE; ctx.lineCap = "round";
    // body
    rr(ctx, CAX, CAY - 9*SCALE, 22*SCALE, 16*SCALE, 4*SCALE); ctx.stroke();
    // lens
    ctx.beginPath(); ctx.arc(CAX + 11*SCALE, CAY - 1*SCALE, 5*SCALE, 0, Math.PI*2); ctx.stroke();
    // top bump
    ctx.beginPath(); ctx.moveTo(CAX + 17*SCALE, CAY - 9*SCALE); ctx.lineTo(CAX + 20*SCALE, CAY - 12*SCALE); ctx.stroke();

    // Input box
    ctx.save();
    ctx.fillStyle = INPUT_BG;
    rr(ctx, CX + 44*SCALE, FY + 11*SCALE, CW - 88*SCALE, FOOT_H - 22*SCALE, 20*SCALE); ctx.fill();
    ctx.restore();
    ctx.font      = cf(13 * SCALE);
    ctx.fillStyle = INPUT_PH;
    ctx.fillText("Kirim pesan...", CX + 58*SCALE, FY + FOOT_H/2 + 5*SCALE);

    // Right icons (emoji sticker + mic)
    const R1X = CX + CW - 40*SCALE, R2X = CX + CW - 16*SCALE;
    ctx.strokeStyle = isDark ? "#888" : "#555"; ctx.lineWidth = 1.7*SCALE;
    // emoji face
    ctx.beginPath(); ctx.arc(R1X, FY + FOOT_H/2, 9*SCALE, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = isDark ? "#888" : "#555";
    ctx.beginPath(); ctx.arc(R1X - 3*SCALE, FY + FOOT_H/2 - 2*SCALE, 1.5*SCALE, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R1X + 3*SCALE, FY + FOOT_H/2 - 2*SCALE, 1.5*SCALE, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R1X, FY + FOOT_H/2 + 1*SCALE, 4*SCALE, 0, Math.PI, false); ctx.stroke();
    // mic
    rr(ctx, R2X - 4*SCALE, FY + FOOT_H/2 - 9*SCALE, 8*SCALE, 10*SCALE, 4*SCALE); ctx.stroke();
    ctx.beginPath(); ctx.arc(R2X, FY + FOOT_H/2 + 3*SCALE, 6*SCALE, Math.PI, 0, false); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R2X, FY + FOOT_H/2 + 9*SCALE); ctx.lineTo(R2X, FY + FOOT_H/2 + 13*SCALE); ctx.stroke();

    ctx.restore(); // end card clip

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
