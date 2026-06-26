const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ─────────────────────────────────────────────────────
let FONT_OK = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  FONT_OK = true;
} catch (e) { console.log("FONT WARN:", e.message); }

function cf(size, bold = false) {
  if (!FONT_OK) return `${bold?"bold":"normal"} ${size}px sans-serif`;
  return `${bold?"bold":"normal"} ${size}px ${bold?"InterBold":"Inter"}`;
}

// ── SHARED DRAW UTILS ─────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);     ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
  ctx.lineTo(x+w, y+h-r);   ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);     ctx.quadraticCurveTo(x, y+h,   x, y+h-r);
  ctx.lineTo(x, y+r);       ctx.quadraticCurveTo(x, y,     x+r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const out = [];
  for (const hard of String(text).replace(/\\n/g,"\n").split("\n")) {
    const words = hard.split(" "); let cur = "";
    for (const w of words) {
      const t = cur ? cur+" "+w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}

async function drawAvatar(ctx, url, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  let ok = false;
  if (url) { try { ctx.drawImage(await loadImage(url), cx-r, cy-r, r*2, r*2); ok=true; } catch(_){} }
  if (!ok) {
    // TikTok grey silhouette
    const g = ctx.createRadialGradient(cx, cy-r*0.1, 0, cx, cy, r);
    g.addColorStop(0, "#c8c8d4"); g.addColorStop(1, "#b8b8c8");
    ctx.fillStyle = g; ctx.fillRect(cx-r, cy-r, r*2, r*2);
    ctx.fillStyle = "#9090a4";
    ctx.beginPath(); ctx.arc(cx, cy-r*0.12, r*0.35, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy+r*0.58, r*0.48, r*0.34, 0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// Draw emoji sebagai canvas shapes (tidak butuh font emoji)
// Returns width used
function drawEmojiShape(ctx, type, cx, cy, size) {
  const r = size / 2;
  ctx.save();

  if (type === "heart") {
    // Pink heart ❤️
    ctx.fillStyle = "#f48fb1";
    ctx.beginPath();
    ctx.moveTo(cx, cy + r*0.6);
    const w = r*0.55, h = r*0.65;
    ctx.bezierCurveTo(cx - r*0.9, cy - r*0.3, cx - r*1.1, cy - r*1.1, cx, cy - r*0.3);
    ctx.bezierCurveTo(cx + r*1.1, cy - r*1.1, cx + r*0.9, cy - r*0.3, cx, cy + r*0.6);
    ctx.fill();
  } else if (type === "laugh") {
    // 😂 face - yellow circle, tears
    ctx.fillStyle = "#f9c74f"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#333"; ctx.beginPath();
    ctx.arc(cx-r*0.28, cy-r*0.15, r*0.12, 0, Math.PI*2); ctx.fill();
    ctx.arc(cx+r*0.28, cy-r*0.15, r*0.12, 0, Math.PI*2); ctx.fill();
    // smile big
    ctx.strokeStyle = "#333"; ctx.lineWidth = r*0.13; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(cx, cy+r*0.1, r*0.42, 0.1, Math.PI-0.1); ctx.stroke();
    // tears
    ctx.fillStyle = "#74c0fc";
    ctx.beginPath(); ctx.ellipse(cx-r*0.6, cy-r*0.4, r*0.1, r*0.2, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+r*0.6, cy-r*0.4, r*0.1, r*0.2,  0.4, 0, Math.PI*2); ctx.fill();
  } else if (type === "cry") {
    // 😭 sobbing
    ctx.fillStyle = "#f9c74f"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#333";
    // closed sad eyes
    ctx.lineWidth = r*0.11; ctx.strokeStyle = "#333"; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.1, r*0.18, Math.PI*0.1, Math.PI*0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+r*0.28, cy-r*0.1, r*0.18, Math.PI*0.1, Math.PI*0.9); ctx.stroke();
    // frown
    ctx.beginPath(); ctx.arc(cx, cy+r*0.55, r*0.3, Math.PI+0.2, -0.2); ctx.stroke();
    // tears
    ctx.fillStyle = "#74c0fc";
    ctx.beginPath(); ctx.ellipse(cx-r*0.55, cy+r*0.1, r*0.09, r*0.28, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+r*0.55, cy+r*0.1, r*0.09, r*0.28,  0.2, 0, Math.PI*2); ctx.fill();
  } else if (type === "thumbs") {
    // 👍
    ctx.fillStyle = "#f9c74f";
    // thumb up shape simplified
    ctx.beginPath();
    ctx.roundRect(cx-r*0.25, cy-r*0.9, r*0.5, r*1.0, r*0.15); ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx-r*0.7, cy-r*0.05, r*1.4, r*0.9, r*0.2); ctx.fill();
    // fingers suggestion
    ctx.strokeStyle = "#e6b800"; ctx.lineWidth = r*0.05;
    for (let i=0; i<3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx-r*0.2+i*r*0.2, cy-r*0.05);
      ctx.lineTo(cx-r*0.2+i*r*0.2, cy+r*0.8); ctx.stroke();
    }
  } else if (type === "angry") {
    // 😡
    ctx.fillStyle = "#e05555"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#c0392b";
    // angry brows
    ctx.lineWidth = r*0.14; ctx.strokeStyle = "#c0392b"; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx-r*0.45, cy-r*0.35); ctx.lineTo(cx-r*0.1, cy-r*0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+r*0.45, cy-r*0.35); ctx.lineTo(cx+r*0.1, cy-r*0.15); ctx.stroke();
    ctx.fillStyle="#333";
    ctx.beginPath(); ctx.arc(cx-r*0.28, cy, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+r*0.28, cy, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="#333"; ctx.lineWidth=r*0.12;
    ctx.beginPath(); ctx.arc(cx, cy+r*0.55, r*0.25, Math.PI+0.2, -0.2); ctx.stroke();
  } else if (type === "think") {
    // 🤔 thinking
    ctx.fillStyle = "#f9c74f"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#333";
    // one raised brow
    ctx.lineWidth = r*0.13; ctx.strokeStyle = "#333"; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx-r*0.45, cy-r*0.3); ctx.lineTo(cx-r*0.1, cy-r*0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+r*0.1, cy-r*0.18); ctx.lineTo(cx+r*0.45, cy-r*0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.05, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+r*0.28, cy-r*0.05, r*0.1, 0, Math.PI*2); ctx.fill();
    // mouth sideways
    ctx.beginPath(); ctx.moveTo(cx-r*0.2, cy+r*0.4); ctx.lineTo(cx+r*0.35, cy+r*0.32); ctx.stroke();
    // hand on chin
    ctx.fillStyle = "#f9c74f"; ctx.strokeStyle="#e6b800"; ctx.lineWidth=r*0.08;
    ctx.beginPath(); ctx.ellipse(cx+r*0.5, cy+r*0.7, r*0.25, r*0.18, -0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  }

  ctx.restore();
}

// ── MAIN MODULE ───────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error:"Method not allowed" });

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
    const BG      = isDark ? "#0d0d14" : "#e8e8f0";   // lavender outer
    const CARD    = isDark ? "#1a1a24" : "#ffffff";
    const HDR_DIV = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)";
    const GHOST1  = isDark ? "#2e2e40" : "#e0e0ea";
    const GHOST2  = isDark ? "#252535" : "#eaeaf2";
    const GHOST3  = isDark ? "#282838" : "#e8e8f0";
    const BUB_BG  = isDark ? "#262634" : "#ffffff";
    const BUB_TXT = isDark ? "#e8e8f0" : "#111111";
    const TIME_C  = isDark ? "#66667a" : "#8888a0";
    const MENU_BG = isDark ? "#1e1e2c" : "#ffffff";
    const MENU_LN = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)";
    const MENU_IC = isDark ? "#aaaacc" : "#444455";
    const MENU_TX = isDark ? "#e0e0f0" : "#111111";
    const DANGER  = "#f0455a";
    const FOOT_BG = isDark ? "#1a1a24" : "#ffffff";
    const INP_BG  = isDark ? "#2a2a3a" : "#f0f0f5";
    const INP_PH  = isDark ? "#55556a" : "#aaaabc";
    const HDR_TX  = isDark ? "#ffffff" : "#111111";
    const HDR_IC  = isDark ? "#ccccdd" : "#333344";

    // ── Scale & sizing (pixel-perfect dari screenshot) ─────────
    // Screenshot ratio: card ~345px wide, berbagai section heights
    // Kita render @2x untuk sharpness
    const S  = 2;          // scale factor
    const CW = 345 * S;    // card width

    const PAD_OUT  = 28 * S;   // outer lavender padding
    const HDR_H    = 72 * S;
    const GHOST_H  = 82 * S;
    const EBAR_H   = 70 * S;
    const MSG_AVTR = 38 * S;   // avatar radius in msg row
    const MSG_GAP  = 12 * S;
    const BUB_PADX = 16 * S;
    const BUB_PADY = 12 * S;
    const MSG_FS   = 17 * S;
    const MSG_LH   = Math.round(MSG_FS * 1.5);
    const TIME_H   = 28 * S;
    const ITEM_H   = 62 * S;
    const FOOT_H   = 72 * S;
    const MENU_GAP = 12 * S;

    // Measure message
    const dummy = createCanvas(1600, 10);
    const dc    = dummy.getContext("2d");
    const MAX_BW = CW - (MSG_AVTR * 2 + MSG_GAP + 20*S + 16*S);
    dc.font = cf(MSG_FS);
    const msgLines = wrapText(dc, message, MAX_BW - BUB_PADX*2);
    const msgTxtW  = msgLines.reduce((mx,l) => Math.max(mx, dc.measureText(l).width), 0);
    const bubW     = Math.min(MAX_BW, Math.max(msgTxtW + BUB_PADX*2, 80*S));
    const bubH     = BUB_PADY + msgLines.length*MSG_LH + BUB_PADY;

    const MENU_ITEMS = [
      { label:"Balas",           icon:"reply",     danger:false },
      { label:"Teruskan",        icon:"forward",   danger:false },
      { label:"Salin",           icon:"copy",      danger:false },
      { label:"Terjemahkan",     icon:"translate", danger:false },
      { label:"Hapus untuk saya",icon:"trash",     danger:false },
      { label:"Laporkan",        icon:"flag",      danger:true  },
    ];
    const MENU_H = MENU_ITEMS.length * ITEM_H;

    const MSG_ROW_H  = Math.max(MSG_AVTR*2, bubH);
    const CARD_H = HDR_H + GHOST_H + EBAR_H + (16*S) + MSG_ROW_H + TIME_H + MENU_GAP + MENU_H + (12*S) + FOOT_H;

    const TOT_W = CW + PAD_OUT*2;
    const TOT_H = CARD_H + PAD_OUT*2;

    const canvas = createCanvas(TOT_W, TOT_H);
    const ctx    = canvas.getContext("2d");

    // ── Outer background ──────────────────────────────────────
    ctx.fillStyle = BG; ctx.fillRect(0, 0, TOT_W, TOT_H);

    // ── Card shadow + fill ────────────────────────────────────
    const CX = PAD_OUT, CY = PAD_OUT;
    const CR = 28 * S;  // card corner radius

    ctx.save();
    ctx.shadowColor   = isDark ? "rgba(0,0,0,0.7)" : "rgba(80,80,120,0.18)";
    ctx.shadowBlur    = 32*S; ctx.shadowOffsetY = 8*S;
    ctx.fillStyle = CARD; rr(ctx, CX, CY, CW, CARD_H, CR); ctx.fill();
    ctx.restore();

    // Clip to card
    ctx.save();
    rr(ctx, CX, CY, CW, CARD_H, CR); ctx.clip();

    let Y = CY;

    // ── HEADER ────────────────────────────────────────────────
    ctx.fillStyle = CARD; ctx.fillRect(CX, Y, CW, HDR_H);

    // Back arrow <
    const AX = CX + 18*S, AY = Y + HDR_H/2;
    ctx.strokeStyle = HDR_IC; ctx.lineWidth = 2*S;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(AX + 10*S, AY - 9*S);
    ctx.lineTo(AX,         AY);
    ctx.lineTo(AX + 10*S, AY + 9*S);
    ctx.stroke();

    // Header avatar
    const HAX = CX + 50*S, HAY = Y + HDR_H/2, HAR = 24*S;
    await drawAvatar(ctx, avatar, HAX, HAY, HAR);

    // Name
    ctx.font = cf(18*S, true); ctx.fillStyle = HDR_TX;
    const nameDisp = name.length > 16 ? name.slice(0,15)+"…" : name;
    ctx.fillText(nameDisp, HAX + HAR + 12*S, Y + HDR_H/2 + 6*S);

    // Verified
    if (isVerified) {
      const vx = HAX + HAR + 12*S + ctx.measureText(nameDisp).width + 8*S;
      const vy = Y + HDR_H/2;
      ctx.fillStyle = "#20d5ec";
      ctx.beginPath(); ctx.arc(vx+9*S, vy, 9*S, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle="#fff"; ctx.lineWidth=1.8*S; ctx.lineCap="round"; ctx.lineJoin="round";
      ctx.beginPath();
      ctx.moveTo(vx+5*S, vy); ctx.lineTo(vx+8*S, vy+3.5*S); ctx.lineTo(vx+13*S, vy-3.5*S);
      ctx.stroke();
    }

    // ⋮ three dots (vertical)
    const DTX = CX + CW - 20*S, DTY = Y + HDR_H/2;
    ctx.fillStyle = HDR_IC;
    for (let i=-1; i<=1; i++) {
      ctx.beginPath(); ctx.arc(DTX, DTY + i*6*S, 2.5*S, 0, Math.PI*2); ctx.fill();
    }

    // Header divider
    ctx.fillStyle = HDR_DIV; ctx.fillRect(CX, Y+HDR_H-1, CW, 1);
    Y += HDR_H;

    // ── GHOST BUBBLES ─────────────────────────────────────────
    // Ikuti screenshot: 1 panjang di kiri, 1 kanan, 1 kanan lebih pendek
    const ghosts = [
      // Left long (kiri, seperti pesan masuk)
      { x: CX + 14*S, y: Y + 10*S, w: 240*S, h: 26*S, c: GHOST1 },
      // Right short (kanan, seperti pesan keluar)
      { x: CX + CW - 14*S - 160*S, y: Y + 10*S, w: 160*S, h: 26*S, c: GHOST2 },
      // Right medium bawah
      { x: CX + CW - 14*S - 190*S, y: Y + 46*S, w: 190*S, h: 26*S, c: GHOST3 },
    ];
    for (const g of ghosts) {
      ctx.fillStyle = g.c; rr(ctx, g.x, g.y, g.w, g.h, 13*S); ctx.fill();
    }
    Y += GHOST_H;

    // ── EMOJI REACTION BAR ────────────────────────────────────
    // Bar tanpa background border — emoji langsung di area
    const EMOJI_TYPES = ["heart","laugh","cry","thumbs","angry","think"];
    const EMOJI_SIZE  = 36 * S;
    const eSlot       = CW / EMOJI_TYPES.length;
    for (let i=0; i<EMOJI_TYPES.length; i++) {
      const ex = CX + eSlot*i + eSlot/2;
      const ey = Y + EBAR_H/2;
      drawEmojiShape(ctx, EMOJI_TYPES[i], ex, ey, EMOJI_SIZE);
    }
    Y += EBAR_H;

    // Thin divider before message
    ctx.fillStyle = HDR_DIV; ctx.fillRect(CX, Y, CW, 1);
    Y += 16*S;

    // ── MESSAGE ROW ───────────────────────────────────────────
    const AVMX  = CX + 14*S + MSG_AVTR;
    const AVMY  = Y + MSG_AVTR;
    await drawAvatar(ctx, avatar, AVMX, AVMY, MSG_AVTR);

    const BX = AVMX + MSG_AVTR + MSG_GAP;
    const BY = Y;

    // Bubble background (white/dark)
    ctx.save();
    ctx.shadowColor  = isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.07)";
    ctx.shadowBlur   = 8*S; ctx.shadowOffsetY = 2*S;
    ctx.fillStyle = BUB_BG;
    // TikTok bubble shape: top-left corner flat
    const BR = 16*S, BL = 3*S;
    ctx.beginPath();
    ctx.moveTo(BX + BL, BY);
    ctx.lineTo(BX + bubW - BR, BY);     ctx.quadraticCurveTo(BX+bubW, BY,   BX+bubW, BY+BR);
    ctx.lineTo(BX+bubW, BY+bubH-BR);    ctx.quadraticCurveTo(BX+bubW, BY+bubH, BX+bubW-BR, BY+bubH);
    ctx.lineTo(BX+BL, BY+bubH);         ctx.quadraticCurveTo(BX, BY+bubH, BX, BY+bubH-BL);
    ctx.lineTo(BX, BY+BL);              ctx.quadraticCurveTo(BX, BY, BX+BL, BY);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Message text
    ctx.font = cf(MSG_FS); ctx.fillStyle = BUB_TXT;
    let ty = BY + BUB_PADY + MSG_FS;
    for (const line of msgLines) { ctx.fillText(line, BX + BUB_PADX, ty); ty += MSG_LH; }

    Y += MSG_ROW_H;

    // Timestamp
    ctx.font = cf(13*S); ctx.fillStyle = TIME_C;
    const tstr = likes ? `${time}  ♥ ${likes}` : time;
    ctx.fillText(tstr, CX + 14*S, Y + 18*S);
    Y += TIME_H + MENU_GAP;

    // ── CONTEXT MENU ─────────────────────────────────────────
    const MX = CX, MY = Y, MW = CW, MH = MENU_H;

    ctx.fillStyle = MENU_BG; ctx.fillRect(MX, MY, MW, MH);

    for (let i=0; i<MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      const IY   = MY + i * ITEM_H;
      const ICX  = MX + 28*S;
      const ICY  = IY + ITEM_H/2;
      const IC   = item.danger ? DANGER : MENU_IC;

      // Divider (not first)
      if (i > 0) {
        ctx.fillStyle = MENU_LN;
        ctx.fillRect(MX + 20*S, IY, MW - 40*S, 1);
      }

      ctx.strokeStyle = IC; ctx.fillStyle = IC;
      ctx.lineWidth = 1.8*S; ctx.lineCap = "round"; ctx.lineJoin = "round";

      if (item.icon === "reply") {
        // < arrow shape (Balas)
        ctx.beginPath();
        ctx.moveTo(ICX+10*S, ICY-7*S);
        ctx.lineTo(ICX,      ICY);
        ctx.lineTo(ICX+10*S, ICY+7*S);
        ctx.stroke();
        // tail
        ctx.beginPath();
        ctx.moveTo(ICX, ICY);
        ctx.bezierCurveTo(ICX+12*S, ICY, ICX+12*S, ICY-6*S, ICX+6*S, ICY-6*S);
        ctx.stroke();
      } else if (item.icon === "forward") {
        // > arrow (Teruskan)
        ctx.beginPath();
        ctx.moveTo(ICX,      ICY-7*S);
        ctx.lineTo(ICX+10*S, ICY);
        ctx.lineTo(ICX,      ICY+7*S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ICX+10*S, ICY);
        ctx.bezierCurveTo(ICX-2*S, ICY, ICX-2*S, ICY-6*S, ICX+4*S, ICY-6*S);
        ctx.stroke();
      } else if (item.icon === "copy") {
        // Two stacked rects (Salin)
        ctx.lineWidth = 1.7*S;
        rr(ctx, ICX+3*S, ICY-8*S, 10*S, 11*S, 2*S); ctx.stroke();
        rr(ctx, ICX,     ICY-11*S, 10*S, 11*S, 2*S); ctx.stroke();
      } else if (item.icon === "translate") {
        // ⊽-like translate icon (Terjemahkan)
        ctx.lineWidth = 1.7*S;
        // top bar
        ctx.beginPath(); ctx.moveTo(ICX, ICY-7*S); ctx.lineTo(ICX+13*S, ICY-7*S); ctx.stroke();
        // center vertical
        ctx.beginPath(); ctx.moveTo(ICX+6.5*S, ICY-7*S); ctx.lineTo(ICX+6.5*S, ICY-2*S); ctx.stroke();
        // bottom V
        ctx.beginPath();
        ctx.moveTo(ICX+2*S, ICY-2*S); ctx.lineTo(ICX+6.5*S, ICY+6*S); ctx.lineTo(ICX+11*S, ICY-2*S);
        ctx.stroke();
      } else if (item.icon === "trash") {
        // Trash can (Hapus)
        ctx.lineWidth = 1.7*S;
        // lid
        ctx.beginPath(); ctx.moveTo(ICX, ICY-5*S); ctx.lineTo(ICX+13*S, ICY-5*S); ctx.stroke();
        // handle
        ctx.beginPath(); ctx.moveTo(ICX+4*S, ICY-5*S); ctx.lineTo(ICX+4*S, ICY-8*S); ctx.lineTo(ICX+9*S, ICY-8*S); ctx.lineTo(ICX+9*S, ICY-5*S); ctx.stroke();
        // body
        rr(ctx, ICX+2*S, ICY-4*S, 9*S, 11*S, 1.5*S); ctx.stroke();
        // lines inside
        ctx.beginPath(); ctx.moveTo(ICX+5.5*S, ICY-1*S); ctx.lineTo(ICX+5.5*S, ICY+5*S); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ICX+8*S,   ICY-1*S); ctx.lineTo(ICX+8*S,   ICY+5*S); ctx.stroke();
      } else if (item.icon === "flag") {
        // Flag (Laporkan) - filled pink
        ctx.fillStyle = DANGER;
        ctx.beginPath();
        ctx.moveTo(ICX, ICY-8*S);
        ctx.lineTo(ICX+12*S, ICY-3*S);
        ctx.lineTo(ICX, ICY+2*S);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = DANGER; ctx.lineWidth = 1.8*S;
        ctx.beginPath(); ctx.moveTo(ICX, ICY-8*S); ctx.lineTo(ICX, ICY+8*S); ctx.stroke();
      }

      // Label
      ctx.font = cf(17*S); ctx.fillStyle = item.danger ? DANGER : MENU_TX;
      ctx.fillText(item.label, MX + 58*S, IY + ITEM_H/2 + 6*S);
    }

    Y += MENU_H + 12*S;

    // ── FOOTER ────────────────────────────────────────────────
    const FY = Y;
    ctx.fillStyle = FOOT_BG; ctx.fillRect(CX, FY, CW, FOOT_H);
    ctx.fillStyle = HDR_DIV; ctx.fillRect(CX, FY, CW, 1);

    // Camera icon
    const CAX = CX + 16*S, CAY = FY + FOOT_H/2;
    ctx.strokeStyle = MENU_IC; ctx.lineWidth = 1.8*S; ctx.lineCap="round";
    rr(ctx, CAX, CAY-11*S, 26*S, 20*S, 5*S); ctx.stroke();
    ctx.beginPath(); ctx.arc(CAX+13*S, CAY-1*S, 6*S, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CAX+20*S, CAY-11*S); ctx.lineTo(CAX+23*S, CAY-14*S); ctx.stroke();

    // Input pill
    ctx.fillStyle = INP_BG;
    rr(ctx, CX+52*S, FY+14*S, CW-106*S, FOOT_H-28*S, 22*S); ctx.fill();
    ctx.font = cf(14*S); ctx.fillStyle = INP_PH;
    ctx.fillText("Kirim pesan...", CX+68*S, FY+FOOT_H/2+5*S);

    // Emoji face icon
    const R1 = CX + CW - 44*S, RY = FY + FOOT_H/2;
    ctx.strokeStyle = MENU_IC; ctx.lineWidth = 1.8*S;
    ctx.beginPath(); ctx.arc(R1, RY, 11*S, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = MENU_IC;
    ctx.beginPath(); ctx.arc(R1-4*S, RY-3*S, 1.8*S, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R1+4*S, RY-3*S, 1.8*S, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R1, RY+2*S, 5*S, 0, Math.PI); ctx.stroke();

    // Mic icon (with person/bell shape like TikTok)
    const R2 = CX + CW - 16*S;
    ctx.strokeStyle = MENU_IC; ctx.lineWidth = 1.8*S; ctx.lineCap="round";
    rr(ctx, R2-5*S, RY-11*S, 10*S, 12*S, 5*S); ctx.stroke();
    ctx.beginPath(); ctx.arc(R2, RY+3*S, 7*S, Math.PI, 0, false); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R2, RY+10*S); ctx.lineTo(R2, RY+15*S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R2-4*S, RY+15*S); ctx.lineTo(R2+4*S, RY+15*S); ctx.stroke();

    ctx.restore(); // end card clip

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
