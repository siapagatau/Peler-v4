const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

let hasEmojiFont = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  try {
    GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")), "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

const ef = (size) => `${size}px ${hasEmojiFont ? "NotoColorEmoji,sans-serif" : "sans-serif"}`;
const cf = (size) => `${size}px ${hasEmojiFont ? "Inter,NotoColorEmoji" : "Inter,sans-serif"}`;
const bf = (size) => `bold ${size}px ${hasEmojiFont ? "InterBold,NotoColorEmoji" : "InterBold,sans-serif"}`;

function rr(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

function rrTL(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x+w, y,   x+w, y+h, tr);
  ctx.arcTo(x+w, y+h, x,   y+h, br);
  ctx.arcTo(x,   y+h, x,   y,   bl);
  ctx.arcTo(x,   y,   x+w, y,   tl);
  ctx.closePath();
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const hard of String(text).replace(/\\n/g,"\n").split("\n")) {
    const words = hard.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur+" "+w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}

async function drawAvatar(ctx, url, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  let ok = false;
  if (url) { try { const img = await loadImage(url); ctx.drawImage(img, cx-r, cy-r, r*2, r*2); ok=true; } catch(_){} }
  if (!ok) {
    ctx.fillStyle = "#c8c8d4"; ctx.fillRect(cx-r, cy-r, r*2, r*2);
    ctx.fillStyle = "#9898b0";
    ctx.beginPath(); ctx.arc(cx, cy-r*.12, r*.38, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy+r*.60, r*.50, r*.34, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

async function handleTTQC(req, res) {
  const {
    name="User", message="Halo!", avatar="", theme="light",
    verified="false", likes="", pinned="false", time="now",
  } = req.query;

  const dark = theme==="dark";
  const C = {
    bg:       dark ? "#111111" : "#eeeef3",
    white:    dark ? "#1e1e1e" : "#ffffff",
    bubble:   dark ? "#272727" : "#ffffff",
    sentBg:   dark ? "#6060e0" : "#d8d8ee",   // ghost sent bubbles
    recvBg:   dark ? "#333333" : "#d8d8e8",   // ghost recv bubbles
    name:     dark ? "#ffffff" : "#111111",
    msg:      dark ? "#e8e8e8" : "#111111",
    sub:      dark ? "#777777" : "#888899",
    div:      dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
    inputBg:  dark ? "#2a2a2a" : "#eeeeee",
    danger:   "#fe2c55",
    icon:     dark ? "#cccccc" : "#444455",
    itemText: dark ? "#ffffff" : "#111111",
    menuBg:   dark ? "#232323" : "#ffffff",
    menuShadow: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.14)",
    pillBg:   dark ? "#2a2a2a" : "#ffffff",
  };

  // ── Measure message bubble ──────────────────────────────────
  const W = 400;
  const FONT_SIZE = 17;
  const LINE_H    = 26;
  const AVT_R     = 22;
  const GAP       = 10;
  const BX        = 16 + AVT_R*2 + GAP;   // bubble left edge
  const BMAX      = W - BX - 20;           // max bubble width
  const BPADX     = 14, BPADY = 11;

  const tmp = createCanvas(800,10);
  const tc  = tmp.getContext("2d");
  tc.font   = cf(FONT_SIZE);
  const msgLines = wrapText(tc, message, BMAX - BPADX*2);
  const textW    = msgLines.reduce((m,l)=>Math.max(m,tc.measureText(l).width),0);
  const bW       = Math.min(BMAX, Math.max(textW + BPADX*2, 80));
  const bH       = BPADY + msgLines.length*LINE_H + BPADY;

  // ── Fixed layout heights (matched from screenshot) ──────────
  const H_HEADER  = 62;
  const H_GHOST   = 158;
  const H_REACT   = 62;    // emoji pill row (with some padding)
  const H_BUBBLE  = Math.max(bH + 16, 60);   // bubble + vertical padding
  const H_TIME    = 28;    // "now" label
  const ITEM_H    = 52;
  const N_ITEMS   = 6;     // Balas Teruskan Salin Terjemahkan Hapus Laporkan
  const H_MENU    = N_ITEMS * ITEM_H;
  const H_EMFOOT  = 54;    // emoji shortcut + streak pet
  const H_INPUT   = 62;

  const H = H_HEADER + H_GHOST + H_REACT + H_BUBBLE + H_TIME + H_MENU + 12 + H_EMFOOT + H_INPUT;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── BG ──────────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let Y = 0;

  // ══════════════════════════════════════════════════════════════
  // 1. HEADER
  // ══════════════════════════════════════════════════════════════
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_HEADER);

  // back "<"
  ctx.save();
  ctx.strokeStyle = C.name; ctx.lineWidth = 2.5; ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(26, Y+H_HEADER/2-8);
  ctx.lineTo(14, Y+H_HEADER/2);
  ctx.lineTo(26, Y+H_HEADER/2+8);
  ctx.stroke();
  ctx.restore();

  // avatar
  await drawAvatar(ctx, avatar, 52, Y+H_HEADER/2, 22);

  // name
  ctx.font      = bf(17);
  ctx.fillStyle = C.name;
  const dname   = name.length>20 ? name.slice(0,19)+"…" : name;
  ctx.fillText(dname, 82, Y+H_HEADER/2+6);

  // verified
  if (verified==="true") {
    const nx = 82 + ctx.measureText(dname).width + 8;
    const ny = Y+H_HEADER/2;
    ctx.save();
    ctx.fillStyle = "#20d5ec";
    ctx.beginPath(); ctx.arc(nx+9, ny, 9, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath();
    ctx.moveTo(nx+5,ny); ctx.lineTo(nx+8,ny+3.5); ctx.lineTo(nx+14,ny-3.5);
    ctx.stroke();
    ctx.restore();
  }

  // ⋮ dots
  ctx.fillStyle = C.icon;
  [Y+H_HEADER/2-8, Y+H_HEADER/2, Y+H_HEADER/2+8].forEach(dy => {
    ctx.beginPath(); ctx.arc(W-20, dy, 2.2, 0, Math.PI*2); ctx.fill();
  });

  // header divider
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y+H_HEADER-1, W, 1);

  Y += H_HEADER;

  // ══════════════════════════════════════════════════════════════
  // 2. GHOST CHAT AREA
  // ══════════════════════════════════════════════════════════════
  // 5 bubbles matching screenshot layout:
  // row1: recv left (small avatar circle + short bubble)
  // row2: sent right (medium bubble)
  // row3: sent right (small bubble)
  // row4: recv left (avatar + bubble, partially visible)
  const ghosts = [
    // {side, avt, x, y, w, h}
    { side:"recv", avt:true,  x:52,       y:Y+10,  w:160, h:30 },
    { side:"sent", avt:false, x:W-130-16, y:Y+10,  w:130, h:30 },
    { side:"sent", avt:false, x:W-100-16, y:Y+52,  w:100, h:30 },
    { side:"sent", avt:false, x:W-80-16,  y:Y+94,  w:80,  h:30 },
    { side:"recv", avt:true,  x:52,       y:Y+52,  w:140, h:30 },
    { side:"recv", avt:true,  x:52,       y:Y+102, w:110, h:30 },
  ];

  for (const g of ghosts) {
    ctx.save();
    ctx.globalAlpha = dark ? 0.30 : 0.45;
    ctx.fillStyle   = g.side==="sent" ? C.sentBg : C.recvBg;
    rr(ctx, g.x, g.y, g.w, g.h, 15, true, false);
    ctx.restore();

    if (g.avt) {
      ctx.save();
      ctx.globalAlpha = dark ? 0.25 : 0.38;
      ctx.fillStyle   = dark ? "#555" : "#c0c0cc";
      ctx.beginPath(); ctx.arc(16+AVT_R, g.y+g.h/2, AVT_R, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // Fade out gradient bottom
  const fg = ctx.createLinearGradient(0, Y+H_GHOST*0.5, 0, Y+H_GHOST);
  fg.addColorStop(0, dark ? "rgba(17,17,17,0)" : "rgba(238,238,243,0)");
  fg.addColorStop(1, dark ? "rgba(17,17,17,0.9)" : "rgba(238,238,243,0.9)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, Y, W, H_GHOST);

  Y += H_GHOST;

  // ══════════════════════════════════════════════════════════════
  // 3. EMOJI REACTION PILL
  // ══════════════════════════════════════════════════════════════
  const PX=16, PW=W-32, PH=50, PY=Y+6;
  ctx.save();
  ctx.shadowColor="#00000022"; ctx.shadowBlur=16; ctx.shadowOffsetY=3;
  ctx.fillStyle = C.pillBg;
  rr(ctx, PX, PY, PW, PH, 25, true, false);
  ctx.restore();

  const emojis = ["❤️","😂","😭","👍","😡","🤔"];
  const slot   = PW / emojis.length;
  ctx.font     = ef(28);
  ctx.textAlign = "center";
  for (let i=0; i<emojis.length; i++) {
    ctx.fillText(emojis[i], PX + slot*i + slot/2, PY + PH/2 + 10);
  }
  ctx.textAlign = "left";

  Y += H_REACT;

  // ══════════════════════════════════════════════════════════════
  // 4. AVATAR + MESSAGE BUBBLE
  // ══════════════════════════════════════════════════════════════
  const ROW_Y  = Y + 6;
  const ACX    = 16 + AVT_R;
  const ACY    = ROW_Y + AVT_R;

  await drawAvatar(ctx, avatar, ACX, ACY, AVT_R);

  const BXX = ACX + AVT_R + GAP;
  const BYY = ROW_Y;

  // bubble shadow
  ctx.save();
  ctx.shadowColor   = dark?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.08)";
  ctx.shadowBlur    = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle     = C.bubble;
  rrTL(ctx, BXX, BYY, bW, bH, 4, 18, 18, 18);
  ctx.fill();
  ctx.restore();

  // text
  let ty = BYY + BPADY + FONT_SIZE;
  ctx.font = cf(FONT_SIZE);
  ctx.fillStyle = C.msg;
  for (const line of msgLines) {
    ctx.fillText(line, BXX+BPADX, ty);
    ty += LINE_H;
  }

  // pinned
  if (pinned==="true") {
    ctx.save();
    ctx.fillStyle = dark?"#2e2e2e":"#f0f0f5";
    rr(ctx, BXX+bW-65, BYY+7, 58, 20, 10, true, false);
    ctx.font=cf(11); ctx.fillStyle=C.sub;
    ctx.fillText("📌 pinned", BXX+bW-62, BYY+20);
    ctx.restore();
  }

  Y += H_BUBBLE;

  // ══════════════════════════════════════════════════════════════
  // 5. TIMESTAMP "now"
  // ══════════════════════════════════════════════════════════════
  ctx.font = cf(13);
  ctx.fillStyle = C.sub;
  const timeStr = time + (likes ? `  ❤️ ${likes}` : "");
  ctx.fillText(timeStr, BXX, Y+18);

  Y += H_TIME;

  // ══════════════════════════════════════════════════════════════
  // 6. CONTEXT MENU
  // ══════════════════════════════════════════════════════════════
  const MX=16, MY=Y+4, MW=W-32, MH=H_MENU;

  ctx.save();
  ctx.shadowColor   = C.menuShadow;
  ctx.shadowBlur    = 20; ctx.shadowOffsetY = 4;
  ctx.fillStyle     = C.menuBg;
  rr(ctx, MX, MY, MW, MH, 14, true, false);
  ctx.restore();

  const items = [
    { label:"Balas",          danger:false, icon: drawIconReply },
    { label:"Teruskan",       danger:false, icon: drawIconForward },
    { label:"Salin",          danger:false, icon: drawIconCopy },
    { label:"Terjemahkan",    danger:false, icon: drawIconTranslate },
    { label:"Hapus untuk saya", danger:false, icon: drawIconTrash },
    { label:"Laporkan",       danger:true,  icon: drawIconFlag },
  ];

  for (let i=0; i<items.length; i++) {
    const it  = items[i];
    const IY  = MY + i*ITEM_H;
    const ICX = MX+26, ICY = IY+ITEM_H/2;

    if (i>0) {
      ctx.fillStyle = C.div;
      ctx.fillRect(MX+14, IY, MW-28, 1);
    }

    it.icon(ctx, ICX, ICY, it.danger, C);

    ctx.font = cf(17);
    ctx.fillStyle = it.danger ? C.danger : C.itemText;
    ctx.fillText(it.label, MX+54, IY+ITEM_H/2+6);
  }

  Y = MY + MH + 8;

  // ══════════════════════════════════════════════════════════════
  // 7. EMOJI SHORTCUT ROW (blurred/faint)
  // ══════════════════════════════════════════════════════════════
  // BG — inherits page bg, slight divider on top
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y, W, 1);

  // Slight overlay so emoji row feels "below" menu
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle   = dark ? "#111111" : "#eeeef3";
  ctx.fillRect(0, Y+1, W, H_EMFOOT-1);
  ctx.restore();

  const shortcuts = ["❤️","😂","👍","👍"];
  const SS = 32, SS_START = 14, SS_SLOT = 48;
  ctx.font = ef(SS);
  ctx.textAlign = "center";
  for (let i=0; i<shortcuts.length; i++) {
    ctx.save();
    ctx.globalAlpha = dark ? 0.55 : 0.50;
    ctx.fillText(shortcuts[i], SS_START + SS_SLOT*i + SS_SLOT/2, Y+H_EMFOOT/2+11);
    ctx.restore();
  }
  ctx.textAlign = "left";

  // Streak Pet pill
  const SPX = SS_START + SS_SLOT*shortcuts.length + 6;
  const SPW = 112, SPH = 36, SPY = Y + H_EMFOOT/2 - SPH/2;
  ctx.save();
  ctx.globalAlpha = dark ? 0.55 : 0.50;
  ctx.fillStyle   = dark?"#2a2a2a":"#e0e0ec";
  rr(ctx, SPX, SPY, SPW, SPH, 18, true, false);
  // dot icon
  ctx.fillStyle   = dark?"#8888bb":"#8080b0";
  ctx.beginPath(); ctx.arc(SPX+20, Y+H_EMFOOT/2, 12, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = dark?0.55:0.50;
  ctx.font = bf(13);
  ctx.fillStyle = dark?"#e0e0e0":"#333355";
  ctx.fillText("Streak Pet", SPX+36, Y+H_EMFOOT/2+5);
  ctx.restore();

  // Play/story icon (right)
  const PIX = W-48, PIY = Y + H_EMFOOT/2;
  ctx.save();
  ctx.globalAlpha = dark?0.55:0.50;
  ctx.fillStyle   = dark?"#2a2a2a":"#e0e0ec";
  rr(ctx, PIX-2, PIY-17, 34, 34, 8, true, false);
  ctx.fillStyle   = dark?"#aaaacc":"#6060a0";
  ctx.beginPath();
  ctx.moveTo(PIX+5,  PIY-7);
  ctx.lineTo(PIX+5,  PIY+7);
  ctx.lineTo(PIX+18, PIY);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  Y += H_EMFOOT;

  // ══════════════════════════════════════════════════════════════
  // 8. INPUT BAR
  // ══════════════════════════════════════════════════════════════
  ctx.fillStyle = C.white;
  ctx.fillRect(0, Y, W, H_INPUT);
  ctx.fillStyle = C.div;
  ctx.fillRect(0, Y, W, 1);

  // Camera icon
  const CX=28, CY=Y+H_INPUT/2;
  ctx.save();
  ctx.strokeStyle=C.icon; ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineJoin="round";
  rr(ctx, CX-13, CY-10, 26, 20, 5, false, true);
  ctx.beginPath(); ctx.arc(CX, CY, 5.5, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX+8,CY-8); ctx.lineTo(CX+12,CY-13); ctx.stroke();
  ctx.restore();

  // Input box
  const IX=56, IH=H_INPUT-20, IW=W-56-66, IY=Y+10;
  ctx.save();
  ctx.fillStyle = C.inputBg;
  rr(ctx, IX, IY, IW, IH, IH/2, true, false);
  ctx.restore();
  ctx.font=cf(15); ctx.fillStyle=C.sub;
  ctx.fillText("Kirim pesan...", IX+18, Y+H_INPUT/2+5);

  // Sticker icon (face)
  const SIX=W-52, SIY=Y+H_INPUT/2;
  ctx.save();
  ctx.strokeStyle=C.icon; ctx.lineWidth=2; ctx.lineCap="round";
  rr(ctx, SIX-13, SIY-13, 26, 26, 9, false, true);
  ctx.beginPath(); ctx.arc(SIX-3, SIY-4, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=C.icon;
  ctx.beginPath(); ctx.arc(SIX-3, SIY-4, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.arc(SIX, SIY+2, 5, 0.15*Math.PI, 0.85*Math.PI, false);
  ctx.stroke();
  ctx.restore();

  // Person+lock icon (right of sticker)
  const PLX=W-20, PLY=Y+H_INPUT/2;
  ctx.save();
  ctx.strokeStyle=C.icon; ctx.lineWidth=1.8; ctx.lineCap="round";
  ctx.beginPath(); ctx.arc(PLX, PLY-6, 6, Math.PI, 0, false);
  ctx.lineTo(PLX+6, PLY+2); ctx.lineTo(PLX-6, PLY+2); ctx.closePath(); ctx.stroke();
  // lock
  ctx.fillStyle=C.icon;
  rr(ctx, PLX-4, PLY+4, 8, 7, 1.5, false, true);
  ctx.beginPath(); ctx.arc(PLX, PLY+5, 2.5, Math.PI, 0, false);
  ctx.lineTo(PLX+2.5, PLY+5); ctx.stroke();
  ctx.restore();

  // Done
  res.setHeader("Content-Type","image/png");
  res.send(canvas.toBuffer("image/png"));
}

// ── ICON HELPERS ─────────────────────────────────────────────
function drawIconReply(ctx,cx,cy,_,C) {
  ctx.save(); ctx.strokeStyle=C.icon; ctx.lineWidth=2.2; ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(cx+14,cy-7); ctx.lineTo(cx+2,cy); ctx.lineTo(cx+14,cy+7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+2,cy); ctx.quadraticCurveTo(cx+14,cy-1,cx+14,cy-8);
  ctx.stroke();
  ctx.restore();
}
function drawIconForward(ctx,cx,cy,_,C) {
  ctx.save(); ctx.strokeStyle=C.icon; ctx.lineWidth=2.2; ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(cx+1,cy-7); ctx.lineTo(cx+13,cy); ctx.lineTo(cx+1,cy+7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+13,cy); ctx.quadraticCurveTo(cx+1,cy-1,cx+1,cy-8);
  ctx.stroke();
  ctx.restore();
}
function drawIconCopy(ctx,cx,cy,_,C) {
  ctx.save(); ctx.strokeStyle=C.icon; ctx.lineWidth=1.8; ctx.lineCap="round"; ctx.lineJoin="round";
  rr(ctx,cx+1,cy-6,10,11,2,false,true);
  rr(ctx,cx+4,cy-10,10,11,2,false,true);
  ctx.restore();
}
function drawIconTranslate(ctx,cx,cy,_,C) {
  ctx.save(); ctx.strokeStyle=C.icon; ctx.lineWidth=1.8; ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.beginPath();
  ctx.moveTo(cx,cy-7); ctx.lineTo(cx+13,cy-7);
  ctx.moveTo(cx+6,cy-7); ctx.lineTo(cx+4,cy-1);
  ctx.moveTo(cx+1,cy-1); ctx.lineTo(cx+11,cy-1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+3,cy-1); ctx.lineTo(cx+7,cy+7);
  ctx.moveTo(cx+11,cy-1); ctx.lineTo(cx+7,cy+7);
  ctx.moveTo(cx+4,cy+3); ctx.lineTo(cx+10,cy+3);
  ctx.stroke();
  ctx.restore();
}
function drawIconTrash(ctx,cx,cy,danger,C) {
  ctx.save();
  ctx.strokeStyle=danger?C.danger:C.icon; ctx.lineWidth=1.8; ctx.lineCap="round"; ctx.lineJoin="round";
  rr(ctx,cx+2,cy-4,10,11,2,false,true);
  ctx.beginPath();
  ctx.moveTo(cx,cy-4); ctx.lineTo(cx+14,cy-4);
  ctx.moveTo(cx+4,cy-4); ctx.lineTo(cx+4,cy-8); ctx.lineTo(cx+10,cy-8); ctx.lineTo(cx+10,cy-4);
  ctx.stroke();
  ctx.restore();
}
function drawIconFlag(ctx,cx,cy,_,C) {
  ctx.save();
  ctx.strokeStyle=C.danger; ctx.fillStyle=C.danger; ctx.lineWidth=1.8; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(cx,cy-8); ctx.lineTo(cx,cy+8); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx,cy-8); ctx.lineTo(cx+13,cy-4); ctx.lineTo(cx,cy+1); ctx.closePath(); ctx.fill();
  ctx.restore();
}


module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin","*");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="GET")     return res.status(405).json({error:"Method not allowed"});
  try { return await handleTTQC(req,res); }
  catch(err) { console.error(err); res.status(500).json({error:err.message}); }
};
