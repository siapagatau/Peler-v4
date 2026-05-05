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

const F = (size, bold = true) =>
  `${bold ? "bold" : "normal"} ${size}px ${hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold"}`;

// ── HELPERS ──────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);          ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
  ctx.lineTo(x+w, y+h-r);        ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);          ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);            ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

function star(ctx, cx, cy, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a  = (i * Math.PI) / 4;
    const rv = i % 2 === 0 ? size : size * 0.38;
    const px = cx + Math.cos(a - Math.PI / 2) * rv;
    const py = cy + Math.sin(a - Math.PI / 2) * rv;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fmt(n) {
  if (n >= 1e12) return (n/1e12).toFixed(1).replace(/\.0$/,"")+"T";
  if (n >= 1e9)  return (n/1e9 ).toFixed(1).replace(/\.0$/,"")+"B";
  if (n >= 1e6)  return (n/1e6 ).toFixed(1).replace(/\.0$/,"")+"M";
  if (n >= 1e3)  return (n/1e3 ).toFixed(1).replace(/\.0$/,"")+"K";
  return String(n);
}

// ── HANDLER ──────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  if (req.query.type !== "profile") return res.status(400).json({ error: 'Gunakan type="profile"' });

  try {
    let {
      name   = "User",
      uang   = "0",
      limit  = "0",
      rank   = "Member",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent = "#2e7d32", // default green
      level  = "1",
      xp     = "0",
      maxXp  = "100",
    } = req.query;

    const money    = parseInt(uang)  || 0;
    const lim      = parseInt(limit) || 0;
    const curXp    = Math.min(parseInt(xp)||0, parseInt(maxXp)||100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPct    = Math.max(0, Math.min(100, (curXp / maxXpVal) * 100));
    if (!/^#[0-9A-F]{3,6}$/i.test(accent)) accent = "#2e7d32";

    // ── MINIMALIST GREEN PALETTE ──────────────────────────────
    const GREEN_MAIN = "#2e7d32";
    const GREEN_LIGHT = "#81c784";
    const GREEN_PALE = "#c8e6c9";
    const GREEN_DARK = "#1b5e20";
    const WHITE = "#ffffff";
    const SOFT_GRAY = "#f5f7f5";
    const TEXT_DARK = "#1e2a1e";
    const TEXT_GRAY = "#4a5b4a";

    const W_C = 820, H_C = 400;
    const canvas = createCanvas(W_C, H_C);
    const ctx    = canvas.getContext("2d");

    // ── BACKGROUND (soft, minimal) ────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, W_C, H_C);
        ctx.fillStyle = "rgba(240,248,240,0.65)"; // greenish overlay
        ctx.fillRect(0, 0, W_C, H_C);
      } catch { background = ""; }
    }
    if (!background) {
      const g = ctx.createLinearGradient(0, 0, W_C, H_C);
      g.addColorStop(0, "#e8f5e9");
      g.addColorStop(1, "#f1f8e9");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W_C, H_C);
    }

    // subtle organic blobs in pale green
    [[0,0,130,"rgba(129,199,132,0.12)"],[W_C,0,110,"rgba(165,214,167,0.12)"],
     [W_C,H_C,140,"rgba(200,230,201,0.1)"],[0,H_C,105,"rgba(185,215,186,0.1)"]
    ].forEach(([bx,by,br,bc]) => {
      ctx.save();
      const rg = ctx.createRadialGradient(bx,by,0,bx,by,br);
      rg.addColorStop(0, bc); rg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });

    // ── CARD (clean white, subtle shadow, green border accent) ──
    const cX=22, cY=18, cW=W_C-44, cH=H_C-36;

    ctx.save();
    ctx.shadowColor="rgba(0,40,0,0.08)"; ctx.shadowBlur=24; ctx.shadowOffsetY=6;
    ctx.fillStyle=WHITE;
    rr(ctx, cX, cY, cW, cH, 24, true, false);
    ctx.restore();

    // thin green border (minimalist)
    ctx.save();
    ctx.strokeStyle = GREEN_MAIN;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    rr(ctx, cX, cY, cW, cH, 24, false, true);
    ctx.restore();

    // ── AVATAR (left) with green glow ─────────────────────────
    const AV_CX = cX + 110;
    const AV_CY = cY + cH / 2;
    const AV_R  = 82;

    // green glow ring
    ctx.save();
    const rg2 = ctx.createLinearGradient(AV_CX-AV_R, AV_CY-AV_R, AV_CX+AV_R, AV_CY+AV_R);
    rg2.addColorStop(0, GREEN_PALE);
    rg2.addColorStop(1, GREEN_LIGHT);
    ctx.strokeStyle = rg2;
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(46,125,50,0.3)";
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+6, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // white stroke
    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+2, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(avImg, AV_CX-AV_R, AV_CY-AV_R, AV_R*2, AV_R*2);
    ctx.restore();

    // minimalist green sparkles around avatar (simple dots/leaf shapes)
    const greenSpark = (x, y, sz) => {
      ctx.fillStyle = GREEN_LIGHT;
      ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI*2); ctx.fill();
    };
    greenSpark(AV_CX - AV_R - 14, AV_CY - 28, 5);
    greenSpark(AV_CX + AV_R + 12, AV_CY - 34, 4);
    greenSpark(AV_CX + AV_R + 8,  AV_CY + 32, 5);
    greenSpark(AV_CX - AV_R - 10, AV_CY + 38, 4);
    greenSpark(AV_CX,             AV_CY - AV_R - 18, 4);

    // level badge (mint green)
    const lvTxt = `Lv. ${level}`;
    ctx.font = F(14);
    const lvW = ctx.measureText(lvTxt).width + 30;
    const lvX = AV_CX - lvW/2, lvY = AV_CY + AV_R + 12;

    ctx.save();
    ctx.shadowColor = "rgba(46,125,50,0.2)";
    ctx.shadowBlur = 8;
    const lg = ctx.createLinearGradient(lvX, lvY, lvX+lvW, lvY+28);
    lg.addColorStop(0, GREEN_LIGHT);
    lg.addColorStop(1, GREEN_MAIN);
    ctx.fillStyle = lg;
    rr(ctx, lvX, lvY, lvW, 28, 14, true, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    rr(ctx, lvX, lvY, lvW, 28, 14, false, true);
    ctx.restore();
    ctx.fillStyle = WHITE;
    ctx.font = F(14);
    ctx.textAlign = "center";
    ctx.fillText(lvTxt, AV_CX, lvY+19);
    ctx.textAlign = "left";

    // ── RIGHT CONTENT ─────────────────────────────────────────
    const RX = cX + 230;
    const RW = cW - 230 - 16;

    const TOTAL_H = 50 + 14 + 90 + 18 + 18 + 22 + 8 + 20;
    const cardMidY = cY + cH / 2;
    let ry = cardMidY - TOTAL_H / 2 - 8;

    // name
    const nameText = name.length > 16 ? name.slice(0,14)+"..." : name;
    ctx.font = F(42);
    ctx.fillStyle = TEXT_DARK;
    ctx.shadowColor = "rgba(0,0,0,0.05)";
    ctx.shadowBlur = 6;
    ctx.fillText(nameText, RX, ry + 42);
    ry += 50 + 14;

    // rank pill (using original rank colors but softened, or green if undefined)
    const rkLabel = rank.toUpperCase();
    ctx.font = F(13);
    const rkW = ctx.measureText(rkLabel).width + 28;
    const RANK_COLORS = {
      OWNER:   {bg:"#2e7d32", txt:WHITE},    // green themed
      ADMIN:   {bg:"#388e3c", txt:WHITE},
      VIP:     {bg:"#43a047", txt:WHITE},
      PREMIUM: {bg:"#66bb6a", txt:WHITE},
      GOLD:    {bg:"#a5d6a7", txt:"#1b5e20"},
      MEMBER:  {bg:"#81c784", txt:TEXT_DARK},
    };
    const rkC = RANK_COLORS[rkLabel] || {bg:GREEN_PALE, txt:TEXT_DARK};
    const rkX = cX + cW - rkW - 20, rkY = cY + 20;

    ctx.save();
    ctx.shadowColor = rkC.bg+"66";
    ctx.shadowBlur = 6;
    ctx.fillStyle = rkC.bg;
    rr(ctx, rkX, rkY, rkW, 30, 15, true, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    rr(ctx, rkX, rkY, rkW, 30, 15, false, true);
    ctx.restore();
    // subtle shine
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.ellipse(rkX+rkW/2, rkY+8, rkW*0.38, 5, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = rkC.txt;
    ctx.font = F(13);
    ctx.textAlign = "center";
    ctx.fillText(rkLabel, rkX+rkW/2, rkY+20);
    ctx.textAlign = "left";

    // ── STAT CARDS (green gradients, clean) ───────────────────
    const ST_Y = ry;
    const ST_H = 90;
    const ST_GAP = 12;
    const ST_W = Math.floor((RW - ST_GAP * 2) / 3);

    const stats = [
      { label:"COINS", value:fmt(money), g:[GREEN_LIGHT, GREEN_MAIN] },
      { label:"LIMIT", value:fmt(lim),   g:["#81c784", "#4caf50"] },
      { label:"LEVEL", value:String(level), g:["#a5d6a7", "#66bb6a"] },
    ];

    for (let i = 0; i < 3; i++) {
      const s  = stats[i];
      const sx = RX + i * (ST_W + ST_GAP);
      const sy = ST_Y;

      ctx.save();
      ctx.shadowColor = "rgba(46,125,50,0.15)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      const sg = ctx.createLinearGradient(sx, sy, sx+ST_W, sy+ST_H);
      sg.addColorStop(0, s.g[0]);
      sg.addColorStop(1, s.g[1]);
      ctx.fillStyle = sg;
      rr(ctx, sx, sy, ST_W, ST_H, 16, true, false);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;
      rr(ctx, sx, sy, ST_W, ST_H, 16, false, true);
      ctx.restore();

      // subtle top highlight
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath(); ctx.ellipse(sx+ST_W/2, sy+10, ST_W*0.4, 7, 0,0,Math.PI*2); ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = F(14);
      ctx.fillText(s.label, sx+14, sy+27);

      ctx.fillStyle = WHITE;
      ctx.font = F(34);
      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 3;
      ctx.fillText(s.value, sx+14, sy+72);
    }

    // ── EXP BAR (green track & fill) ──────────────────────────
    const EXP_Y = ST_Y + ST_H + 18;
    const BAR_H = 22;
    const BAR_W = RW;

    ctx.fillStyle = TEXT_DARK;
    ctx.font = F(15);
    ctx.fillText("EXP", RX, EXP_Y + 15);
    ctx.fillStyle = TEXT_GRAY;
    ctx.font = F(13);
    ctx.textAlign = "right";
    ctx.fillText(`${fmt(curXp)} / ${fmt(maxXpVal)}`, RX + BAR_W, EXP_Y + 15);
    ctx.textAlign = "left";

    const BAR_Y = EXP_Y + 20;

    // track (light gray-green)
    ctx.save();
    ctx.fillStyle = "#e0e8e0";
    rr(ctx, RX, BAR_Y, BAR_W, BAR_H, BAR_H/2, true, false);
    ctx.restore();

    const fillW = Math.max((xpPct/100)*BAR_W, xpPct>0 ? BAR_H : 0);
    if (fillW > 0) {
      ctx.save();
      const xg = ctx.createLinearGradient(RX, BAR_Y, RX+BAR_W, BAR_Y);
      xg.addColorStop(0, GREEN_LIGHT);
      xg.addColorStop(1, GREEN_DARK);
      ctx.fillStyle = xg;
      ctx.shadowColor = "rgba(46,125,50,0.3)";
      ctx.shadowBlur = 5;
      rr(ctx, RX, BAR_Y, fillW, BAR_H, BAR_H/2, true, false);
      ctx.restore();
      // minimalist shine
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      rr(ctx, RX+2, BAR_Y+3, Math.max(fillW-4,0), BAR_H/2-3, (BAR_H/2-3)/2, true, false);
      ctx.restore();
    }

    // subtle ticks
    ctx.save();
    ctx.strokeStyle = "rgba(100,130,100,0.3)";
    ctx.lineWidth = 1.2;
    for (let i=1;i<10;i++) {
      const sx=RX+(BAR_W/10)*i;
      ctx.beginPath(); ctx.moveTo(sx,BAR_Y+5); ctx.lineTo(sx,BAR_Y+BAR_H-5); ctx.stroke();
    }
    ctx.restore();

    // percentage pill
    const pctTxt = `${Math.round(xpPct)}%`;
    ctx.font = F(11);
    const ptW = ctx.measureText(pctTxt).width + 18;
    const ptX = RX + BAR_W - ptW;
    const ptY = BAR_Y + BAR_H + 8;
    ctx.save();
    ctx.fillStyle = GREEN_PALE;
    rr(ctx, ptX, ptY, ptW, 20, 10, true, false);
    ctx.fillStyle = GREEN_DARK;
    ctx.fillText(pctTxt, ptX+9, ptY+14);
    ctx.restore();

    // ── BOTTOM RIBBON (green solid with light text) ────────────
    const RIB_H = 36;
    const RIB_Y = cY + cH - RIB_H;
    const ribG = ctx.createLinearGradient(cX, RIB_Y, cX+cW, RIB_Y);
    ribG.addColorStop(0, GREEN_MAIN);
    ribG.addColorStop(1, GREEN_LIGHT);
    ctx.fillStyle = ribG;
    ctx.beginPath();
    ctx.moveTo(cX, RIB_Y);
    ctx.lineTo(cX+cW, RIB_Y);
    ctx.lineTo(cX+cW, cY+cH-28);
    ctx.quadraticCurveTo(cX+cW, cY+cH, cX+cW-28, cY+cH);
    ctx.lineTo(cX+28, cY+cH);
    ctx.quadraticCurveTo(cX, cY+cH, cX, cY+cH-28);
    ctx.lineTo(cX, RIB_Y);
    ctx.closePath();
    ctx.fill();

    // minimalist dots instead of stars
    for (let i=0;i<9;i++) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(cX+45+i*(cW-90)/8, RIB_Y+RIB_H/2, 2.5, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.fillStyle = WHITE;
    ctx.font = F(13);
    ctx.textAlign = "center";
    ctx.fillText("K E E P  G R O W I N G", cX+cW/2, RIB_Y+23);
    ctx.textAlign = "left";

    // corner accents (simple dots)
    ctx.fillStyle = GREEN_LIGHT;
    ctx.beginPath(); ctx.arc(cX+18, cY+18, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cX+cW-18, cY+18, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cX+18, cY+cH-18, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cX+cW-18, cY+cH-18, 4, 0, Math.PI*2); ctx.fill();

    res.setHeader("Content-Type","image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};