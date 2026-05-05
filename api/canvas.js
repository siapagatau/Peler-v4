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
      accent = "#ff6eb4",
      level  = "1",
      xp     = "0",
      maxXp  = "100",
    } = req.query;

    const money    = parseInt(uang)  || 0;
    const lim      = parseInt(limit) || 0;
    const curXp    = Math.min(parseInt(xp)||0, parseInt(maxXp)||100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPct    = Math.max(0, Math.min(100, (curXp / maxXpVal) * 100));
    if (!/^#[0-9A-F]{3,6}$/i.test(accent)) accent = "#ff6eb4";

    // palette
    const PINK = "#ff85c2", MINT = "#7de8c0", SKY = "#85c8ff",
          YEL  = "#ffd96e", LAV  = "#c485ff", PEA = "#ffb085", W = "#fff";

    const W_C = 820, H_C = 400;
    const canvas = createCanvas(W_C, H_C);
    const ctx    = canvas.getContext("2d");

    // ── BACKGROUND ─────────────────────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, W_C, H_C);
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.fillRect(0, 0, W_C, H_C);
      } catch { background = ""; }
    }
    if (!background) {
      const g = ctx.createLinearGradient(0, 0, W_C, H_C);
      g.addColorStop(0,   "#ffdaf0");
      g.addColorStop(0.5, "#e0eaff");
      g.addColorStop(1,   "#d4f5e9");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W_C, H_C);
    }

    // bg blobs
    [[0,0,130,"rgba(255,175,215,0.3)"],[W_C,0,110,"rgba(175,205,255,0.3)"],
     [W_C,H_C,140,"rgba(175,240,210,0.28)"],[0,H_C,105,"rgba(255,210,175,0.28)"]
    ].forEach(([bx,by,br,bc]) => {
      ctx.save();
      const rg = ctx.createRadialGradient(bx,by,0,bx,by,br);
      rg.addColorStop(0, bc); rg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });

    // ── CARD ────────────────────────────────────────────────────
    const cX=22, cY=18, cW=W_C-44, cH=H_C-36;

    ctx.save();
    ctx.shadowColor="rgba(150,90,200,0.2)"; ctx.shadowBlur=30; ctx.shadowOffsetY=7;
    ctx.fillStyle="rgba(255,255,255,0.88)";
    rr(ctx, cX, cY, cW, cH, 30, true, false);
    ctx.restore();

    // rainbow border
    ctx.save();
    const bg2 = ctx.createLinearGradient(cX,cY,cX+cW,cY+cH);
    bg2.addColorStop(0,PINK); bg2.addColorStop(0.33,SKY);
    bg2.addColorStop(0.66,MINT); bg2.addColorStop(1,YEL);
    ctx.strokeStyle=bg2; ctx.lineWidth=2.5; ctx.globalAlpha=0.55;
    rr(ctx, cX, cY, cW, cH, 30, false, true);
    ctx.restore();

    // ── AVATAR (left, vertically centered) ─────────────────────
    // Avatar column: x=cX to cX+220
    // Right content: x=cX+230
    const AV_CX = cX + 110;
    const AV_CY = cY + cH / 2;
    const AV_R  = 82;

    // glow
    ctx.save();
    const rg2 = ctx.createLinearGradient(AV_CX-AV_R, AV_CY-AV_R, AV_CX+AV_R, AV_CY+AV_R);
    rg2.addColorStop(0,PINK); rg2.addColorStop(0.5,LAV); rg2.addColorStop(1,SKY);
    ctx.strokeStyle=rg2; ctx.lineWidth=6;
    ctx.shadowColor="rgba(255,100,180,0.55)"; ctx.shadowBlur=18;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+7, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle=W; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+2, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(avImg, AV_CX-AV_R, AV_CY-AV_R, AV_R*2, AV_R*2);
    ctx.restore();

    // canvas sparkles around avatar
    star(ctx, AV_CX - AV_R - 16, AV_CY - 28,      6, YEL,  0.9);
    star(ctx, AV_CX + AV_R + 14, AV_CY - 38,      5, PINK, 0.9);
    star(ctx, AV_CX + AV_R + 10, AV_CY + 34,      6, MINT, 0.85);
    star(ctx, AV_CX - AV_R - 12, AV_CY + 36,      5, SKY,  0.85);
    star(ctx, AV_CX,             AV_CY - AV_R - 20, 5, LAV, 0.8);

    // level badge
    const lvTxt = `Lv. ${level}`;
    ctx.font = F(14);
    const lvW = ctx.measureText(lvTxt).width + 30;
    const lvX = AV_CX - lvW/2, lvY = AV_CY + AV_R + 12;

    ctx.save();
    ctx.shadowColor="rgba(255,190,50,0.6)"; ctx.shadowBlur=12;
    const lg = ctx.createLinearGradient(lvX, lvY, lvX+lvW, lvY+28);
    lg.addColorStop(0,"#ffe569"); lg.addColorStop(1,"#ffa94d");
    ctx.fillStyle=lg; rr(ctx,lvX,lvY,lvW,28,14,true,false);
    ctx.restore();
    ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=1.5;
    rr(ctx,lvX,lvY,lvW,28,14,false,true); ctx.restore();
    ctx.fillStyle="#4a2800"; ctx.font=F(14);
    ctx.textAlign="center"; ctx.fillText(lvTxt, AV_CX, lvY+19); ctx.textAlign="left";

    // ── RIGHT CONTENT ───────────────────────────────────────────
    const RX = cX + 230;
    const RW = cW - 230 - 16;

    // Total height of all right-side elements:
    // Name: 42px line height ~50
    // Gap: 14
    // Stat cards: 90
    // Gap: 18
    // EXP label row: 18
    // EXP bar: 22
    // Gap: 8
    // pct pill: 20
    // Total ~240px → start from card center minus half
    const TOTAL_H = 50 + 14 + 90 + 18 + 18 + 22 + 8 + 20;
    const cardMidY = cY + cH / 2;
    // Push up slightly so ribbon gap is accounted for
    let ry = cardMidY - TOTAL_H / 2 - 8;

    // -- NAME --
    const nameText = name.length > 16 ? name.slice(0,14)+"..." : name;
    ctx.font = F(42);
    ctx.save();
    ctx.fillStyle = "#3a2050";
    ctx.shadowColor="rgba(200,100,180,0.18)"; ctx.shadowBlur=8;
    ctx.fillText(nameText, RX, ry + 42);
    ctx.restore();
    ry += 50 + 14;

    // -- RANK PILL (top right of card) --
    const rkLabel = rank.toUpperCase();
    ctx.font = F(13);
    const rkW = ctx.measureText(rkLabel).width + 28;
    const RANK_COLORS = {
      OWNER:   {bg:"#ff5e5e", txt:W},   ADMIN: {bg:"#ff9f43", txt:W},
      VIP:     {bg:"#a29bfe", txt:W},   PREMIUM:{bg:"#fd79a8",txt:W},
      GOLD:    {bg:"#ffd32a", txt:"#4a3000"}, MEMBER:{bg:"#74b9ff",txt:W},
    };
    const rkC = RANK_COLORS[rkLabel] || {bg:PINK, txt:W};
    const rkX = cX + cW - rkW - 20, rkY = cY + 20;

    ctx.save();
    ctx.shadowColor=rkC.bg+"77"; ctx.shadowBlur=10;
    ctx.fillStyle=rkC.bg; rr(ctx,rkX,rkY,rkW,30,15,true,false);
    ctx.restore();
    ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.6)"; ctx.lineWidth=1.5;
    rr(ctx,rkX,rkY,rkW,30,15,false,true); ctx.restore();
    // shine
    ctx.save(); ctx.fillStyle="rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.ellipse(rkX+rkW/2, rkY+8, rkW*0.38, 5, 0,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle=rkC.txt; ctx.font=F(13);
    ctx.textAlign="center"; ctx.fillText(rkLabel, rkX+rkW/2, rkY+20); ctx.textAlign="left";

    // -- STAT CARDS --
    const ST_Y = ry;
    const ST_H = 90;
    const ST_GAP = 12;
    const ST_W = Math.floor((RW - ST_GAP * 2) / 3);

    const stats = [
      { label:"COINS", value:fmt(money), g:["#ff85c2","#ffa8d8"], sh:"rgba(255,100,180,0.35)" },
      { label:"LIMIT", value:fmt(lim),   g:["#ffd085","#ffb87a"], sh:"rgba(255,160,70,0.35)"  },
      { label:"LEVEL", value:String(level), g:["#a29bfe","#78b8ff"], sh:"rgba(130,100,255,0.3)"},
    ];

    for (let i = 0; i < 3; i++) {
      const s  = stats[i];
      const sx = RX + i * (ST_W + ST_GAP);
      const sy = ST_Y;

      ctx.save();
      ctx.shadowColor=s.sh; ctx.shadowBlur=14; ctx.shadowOffsetY=4;
      const sg = ctx.createLinearGradient(sx,sy,sx+ST_W,sy+ST_H);
      sg.addColorStop(0,s.g[0]); sg.addColorStop(1,s.g[1]);
      ctx.fillStyle=sg; rr(ctx,sx,sy,ST_W,ST_H,20,true,false);
      ctx.restore();

      ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=2;
      rr(ctx,sx,sy,ST_W,ST_H,20,false,true); ctx.restore();

      // top shine strip
      ctx.save(); ctx.fillStyle="rgba(255,255,255,0.28)";
      ctx.beginPath(); ctx.ellipse(sx+ST_W/2, sy+12, ST_W*0.4, 9, 0,0,Math.PI*2); ctx.fill(); ctx.restore();

      ctx.fillStyle="rgba(60,20,60,0.5)"; ctx.font=F(11);
      ctx.fillText(s.label, sx+14, sy+24);

      ctx.fillStyle=W; ctx.font=F(34);
      ctx.save(); ctx.shadowColor="rgba(0,0,0,0.15)"; ctx.shadowBlur=4;
      ctx.fillText(s.value, sx+14, sy+72); ctx.restore();
    }

    // -- EXP BAR --
    const EXP_Y = ST_Y + ST_H + 18;
    ry = EXP_Y; // keep ry in sync (unused below but safe)
    const BAR_H = 22;
    const BAR_W = RW;

    // label row
    ctx.fillStyle="#3a2050"; ctx.font=F(13);
    ctx.fillText("EXP", RX, EXP_Y + 14);
    ctx.fillStyle="#9980aa"; ctx.font=F(11);
    ctx.textAlign="right";
    ctx.fillText(`${fmt(curXp)} / ${fmt(maxXpVal)}`, RX + BAR_W, EXP_Y + 14);
    ctx.textAlign="left";

    const BAR_Y = EXP_Y + 20;

    // track
    ctx.save(); ctx.fillStyle="rgba(200,180,230,0.38)";
    rr(ctx, RX, BAR_Y, BAR_W, BAR_H, BAR_H/2, true, false); ctx.restore();

    // fill
    const fillW = Math.max((xpPct/100)*BAR_W, xpPct>0 ? BAR_H : 0);
    if (fillW > 0) {
      ctx.save();
      const xg = ctx.createLinearGradient(RX, BAR_Y, RX+BAR_W, BAR_Y);
      xg.addColorStop(0,"#ff85c2"); xg.addColorStop(0.4,"#c485ff");
      xg.addColorStop(0.8,"#85c8ff"); xg.addColorStop(1,"#7de8c0");
      ctx.fillStyle=xg; ctx.shadowColor="rgba(190,100,255,0.5)"; ctx.shadowBlur=8;
      rr(ctx, RX, BAR_Y, fillW, BAR_H, BAR_H/2, true, false); ctx.restore();
      // shine
      ctx.save(); ctx.fillStyle="rgba(255,255,255,0.3)";
      rr(ctx, RX+2, BAR_Y+3, Math.max(fillW-4,0), BAR_H/2-3, (BAR_H/2-3)/2, true, false); ctx.restore();
    }

    // ticks
    ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.45)"; ctx.lineWidth=1.5;
    for (let i=1;i<10;i++) {
      const sx=RX+(BAR_W/10)*i;
      ctx.beginPath(); ctx.moveTo(sx,BAR_Y+4); ctx.lineTo(sx,BAR_Y+BAR_H-4); ctx.stroke();
    }
    ctx.restore();

    // pct pill (right side of bar)
    const pctTxt = `${Math.round(xpPct)}%`;
    ctx.font = F(11);
    const ptW = ctx.measureText(pctTxt).width + 18;
    const ptX = RX + BAR_W - ptW;
    const ptY = BAR_Y + BAR_H + 8;
    ctx.save();
    ctx.fillStyle="rgba(190,150,240,0.22)"; rr(ctx,ptX,ptY,ptW,20,10,true,false);
    ctx.fillStyle=LAV; ctx.fillText(pctTxt, ptX+9, ptY+14); ctx.restore();

    // ── BOTTOM RIBBON ────────────────────────────────────────────
    const RIB_H = 36;
    const RIB_Y = cY + cH - RIB_H;
    const ribG  = ctx.createLinearGradient(cX, RIB_Y, cX+cW, RIB_Y);
    ribG.addColorStop(0,   "rgba(255,150,210,0.65)");
    ribG.addColorStop(0.25,"rgba(200,160,255,0.65)");
    ribG.addColorStop(0.5, "rgba(150,200,255,0.65)");
    ribG.addColorStop(0.75,"rgba(150,240,210,0.65)");
    ribG.addColorStop(1,   "rgba(255,230,150,0.65)");
    ctx.fillStyle=ribG;
    ctx.beginPath();
    ctx.moveTo(cX, RIB_Y);
    ctx.lineTo(cX+cW, RIB_Y);
    ctx.lineTo(cX+cW, cY+cH-28); ctx.quadraticCurveTo(cX+cW, cY+cH, cX+cW-28, cY+cH);
    ctx.lineTo(cX+28, cY+cH);    ctx.quadraticCurveTo(cX, cY+cH, cX, cY+cH-28);
    ctx.lineTo(cX, RIB_Y); ctx.closePath(); ctx.fill();

    // tiny stars in ribbon
    for (let i=0;i<9;i++) star(ctx, cX+45+i*(cW-90)/8, RIB_Y+RIB_H/2, 3, W, 0.5);

    ctx.save(); ctx.fillStyle="rgba(60,20,60,0.5)"; ctx.font=F(11);
    ctx.textAlign="center";
    ctx.fillText("* * *  K E E P  L E V E L I N G  U P !  * * *", cX+cW/2, RIB_Y+23);
    ctx.textAlign="left"; ctx.restore();

    // corner stars
    star(ctx, cX+16,      cY+16,      5, PINK, 0.6);
    star(ctx, cX+cW-16,   cY+16,      4, SKY,  0.6);
    star(ctx, cX+16,      cY+cH-16,   4, YEL,  0.6);
    star(ctx, cX+cW-16,   cY+cH-16,   5, MINT, 0.6);

    res.setHeader("Content-Type","image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
