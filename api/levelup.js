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

function drawStar(ctx, cx, cy, outerR, innerR, points, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBurst(ctx, cx, cy, maxR, rays, color, alpha = 0.15) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const innerR = maxR * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
    ctx.lineTo(cx + Math.cos(angle) * maxR,   cy + Math.sin(angle) * maxR);
    ctx.stroke();
  }
  ctx.restore();
}

// ── HANDLER ──────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  if (req.query.type !== "levelup") return res.status(400).json({ error: 'Gunakan type="levelup"' });

  try {
    let {
      name      = "User",
      oldLevel  = "1",
      newLevel  = "2",
      rank      = "Member",
      avatar    = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      xp        = "0",       // total XP setelah naik level
      reward    = "",        // reward text opsional, e.g. "+500 coins"
    } = req.query;

    const oldLvl = parseInt(oldLevel) || 1;
    const newLvl = parseInt(newLevel) || oldLvl + 1;
    const totalXp = parseInt(xp) || 0;

    // ── PALETTE ───────────────────────────────────────────────
    const GREEN_MAIN  = "#2e7d32";
    const GREEN_LIGHT = "#81c784";
    const GREEN_PALE  = "#c8e6c9";
    const GREEN_DARK  = "#1b5e20";
    const GREEN_GLOW  = "#a5d6a7";
    const GOLD        = "#ffd54f";
    const GOLD_DARK   = "#ff8f00";
    const WHITE       = "#ffffff";
    const TEXT_DARK   = "#1e2a1e";
    const TEXT_GRAY   = "#4a5b4a";

    const W_C = 820, H_C = 420;
    const canvas = createCanvas(W_C, H_C);
    const ctx    = canvas.getContext("2d");

    // ── BACKGROUND ────────────────────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, W_C, H_C);
        ctx.fillStyle = "rgba(20,50,20,0.72)";
        ctx.fillRect(0, 0, W_C, H_C);
      } catch { background = ""; }
    }
    if (!background) {
      // dark dramatic green gradient for level up feel
      const g = ctx.createLinearGradient(0, 0, W_C, H_C);
      g.addColorStop(0, "#0a1f0a");
      g.addColorStop(0.5, "#0d2b0d");
      g.addColorStop(1, "#0a1a0a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W_C, H_C);
    }

    // ambient glow at center
    const centerGlow = ctx.createRadialGradient(W_C/2, H_C/2, 0, W_C/2, H_C/2, 300);
    centerGlow.addColorStop(0, "rgba(46,125,50,0.22)");
    centerGlow.addColorStop(0.5, "rgba(46,125,50,0.08)");
    centerGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, W_C, H_C);

    // corner glow accents
    [[0,0],[W_C,0],[0,H_C],[W_C,H_C]].forEach(([bx,by]) => {
      const rg = ctx.createRadialGradient(bx,by,0,bx,by,160);
      rg.addColorStop(0, "rgba(129,199,132,0.07)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0,0,W_C,H_C);
    });

    // ── CARD ──────────────────────────────────────────────────
    const cX=22, cY=18, cW=W_C-44, cH=H_C-36;

    ctx.save();
    ctx.shadowColor = "rgba(46,125,50,0.4)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "rgba(15,35,15,0.85)";
    rr(ctx, cX, cY, cW, cH, 24, true, false);
    ctx.restore();

    // glowing green border
    ctx.save();
    const borderGrad = ctx.createLinearGradient(cX, cY, cX+cW, cY+cH);
    borderGrad.addColorStop(0, "rgba(129,199,132,0.8)");
    borderGrad.addColorStop(0.5, "rgba(255,213,79,0.6)");
    borderGrad.addColorStop(1, "rgba(129,199,132,0.8)");
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = GREEN_LIGHT;
    ctx.shadowBlur = 12;
    rr(ctx, cX, cY, cW, cH, 24, false, true);
    ctx.restore();

    // ── BURST RAYS (center-right area) ───────────────────────
    const BURST_CX = W_C / 2 + 60;
    const BURST_CY = H_C / 2;
    drawBurst(ctx, BURST_CX, BURST_CY, 380, 24, GREEN_LIGHT, 0.07);
    drawBurst(ctx, BURST_CX, BURST_CY, 300, 16, GOLD, 0.05);

    // ── AVATAR (left) ─────────────────────────────────────────
    const AV_CX = cX + 120;
    const AV_CY = cY + cH / 2 - 10;
    const AV_R  = 85;

    // outer glow rings
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.strokeStyle = i === 1 ? GREEN_LIGHT : GREEN_MAIN;
      ctx.lineWidth = i === 1 ? 3 : 1.5;
      ctx.globalAlpha = 0.2 / i;
      ctx.shadowColor = GREEN_LIGHT;
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 6 + i*10, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // gold sparkle ring
    ctx.save();
    const ringGrad = ctx.createLinearGradient(AV_CX-AV_R, AV_CY-AV_R, AV_CX+AV_R, AV_CY+AV_R);
    ringGrad.addColorStop(0, GOLD);
    ringGrad.addColorStop(0.5, GREEN_LIGHT);
    ringGrad.addColorStop(1, GOLD);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 4;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+5, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // white inner ring
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+1, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // avatar image
    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(avImg, AV_CX-AV_R, AV_CY-AV_R, AV_R*2, AV_R*2);
    ctx.restore();

    // scattered sparkle stars around avatar
    const sparks = [
      [AV_CX - AV_R - 20, AV_CY - 30, 10, GOLD, 0.9],
      [AV_CX + AV_R + 16, AV_CY - 40, 8,  GREEN_LIGHT, 0.85],
      [AV_CX + AV_R + 12, AV_CY + 35, 9,  GOLD, 0.75],
      [AV_CX - AV_R - 14, AV_CY + 42, 7,  GREEN_GLOW, 0.8],
      [AV_CX - 10,        AV_CY - AV_R - 22, 8, GOLD, 0.9],
      [AV_CX + 22,        AV_CY - AV_R - 14, 6, GREEN_LIGHT, 0.7],
      [AV_CX - 30,        AV_CY + AV_R + 16, 7, GOLD, 0.65],
    ];
    sparks.forEach(([sx, sy, sz, sc, sa]) => {
      drawStar(ctx, sx, sy, sz, sz*0.4, 4, sc, sa);
    });

    // ── RIGHT CONTENT ─────────────────────────────────────────
    const RX = cX + 250;
    const RW = cW - 250 - 20;
    const midY = cY + cH / 2;

    // "LEVEL UP!" header with glow
    ctx.save();
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 28;
    ctx.font = F(58);
    const luGrad = ctx.createLinearGradient(RX, midY-110, RX+RW, midY-60);
    luGrad.addColorStop(0, GOLD);
    luGrad.addColorStop(0.5, WHITE);
    luGrad.addColorStop(1, GOLD_DARK);
    ctx.fillStyle = luGrad;
    ctx.fillText("LEVEL  UP!", RX, midY - 68);
    ctx.restore();

    // name
    const nameText = name.length > 18 ? name.slice(0,16)+"…" : name;
    ctx.save();
    ctx.font = F(26);
    ctx.fillStyle = "rgba(200,230,201,0.95)";
    ctx.fillText(nameText, RX, midY - 32);
    ctx.restore();

    // ── LEVEL TRANSITION DISPLAY ──────────────────────────────
    const LT_Y = midY;
    const BOX_W = 100, BOX_H = 90, BOX_R = 16;
    const GAP_X = 22;
    const ARROW_W = 44;
    const totalRowW = BOX_W + ARROW_W + BOX_W;
    const ltX = RX;

    // OLD LEVEL box (dim)
    ctx.save();
    ctx.globalAlpha = 0.55;
    const oldBoxG = ctx.createLinearGradient(ltX, LT_Y, ltX+BOX_W, LT_Y+BOX_H);
    oldBoxG.addColorStop(0, "#2e4a2e");
    oldBoxG.addColorStop(1, "#1b3a1b");
    ctx.fillStyle = oldBoxG;
    rr(ctx, ltX, LT_Y, BOX_W, BOX_H, BOX_R, true, false);
    ctx.strokeStyle = "rgba(129,199,132,0.4)";
    ctx.lineWidth = 1.2;
    rr(ctx, ltX, LT_Y, BOX_W, BOX_H, BOX_R, false, true);
    ctx.restore();
    ctx.save();
    ctx.font = F(11);
    ctx.fillStyle = "rgba(165,214,167,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("SEBELUM", ltX + BOX_W/2, LT_Y + 18);
    ctx.font = F(40);
    ctx.fillStyle = "rgba(200,230,201,0.7)";
    ctx.shadowColor = GREEN_LIGHT;
    ctx.shadowBlur = 6;
    ctx.fillText(String(oldLvl), ltX + BOX_W/2, LT_Y + 68);
    ctx.restore();

    // ARROW
    const arrowCX = ltX + BOX_W + ARROW_W/2;
    const arrowCY = LT_Y + BOX_H/2;
    ctx.save();
    ctx.fillStyle = GOLD;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 14;
    const aw = 18, ah = 12;
    ctx.beginPath();
    ctx.moveTo(arrowCX - aw/2, arrowCY - ah/2);
    ctx.lineTo(arrowCX + aw/2 - 7, arrowCY - ah/2);
    ctx.lineTo(arrowCX + aw/2 - 7, arrowCY - ah);
    ctx.lineTo(arrowCX + aw/2, arrowCY);
    ctx.lineTo(arrowCX + aw/2 - 7, arrowCY + ah);
    ctx.lineTo(arrowCX + aw/2 - 7, arrowCY + ah/2);
    ctx.lineTo(arrowCX - aw/2, arrowCY + ah/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // NEW LEVEL box (bright, glowing)
    const newBoxX = ltX + BOX_W + ARROW_W;
    ctx.save();
    ctx.shadowColor = GREEN_LIGHT;
    ctx.shadowBlur = 22;
    const newBoxG = ctx.createLinearGradient(newBoxX, LT_Y, newBoxX+BOX_W, LT_Y+BOX_H);
    newBoxG.addColorStop(0, GREEN_MAIN);
    newBoxG.addColorStop(1, "#1b5e20");
    ctx.fillStyle = newBoxG;
    rr(ctx, newBoxX, LT_Y, BOX_W, BOX_H, BOX_R, true, false);
    const newBorderG = ctx.createLinearGradient(newBoxX, LT_Y, newBoxX+BOX_W, LT_Y+BOX_H);
    newBorderG.addColorStop(0, GOLD);
    newBorderG.addColorStop(1, GREEN_LIGHT);
    ctx.strokeStyle = newBorderG;
    ctx.lineWidth = 2;
    rr(ctx, newBoxX, LT_Y, BOX_W, BOX_H, BOX_R, false, true);
    ctx.restore();
    // shine on new level box
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.ellipse(newBoxX+BOX_W/2, LT_Y+12, BOX_W*0.38, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.font = F(11);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8;
    ctx.fillText("SEKARANG", newBoxX + BOX_W/2, LT_Y + 18);
    ctx.font = F(40);
    ctx.fillStyle = WHITE;
    ctx.shadowColor = GREEN_LIGHT;
    ctx.shadowBlur = 20;
    ctx.fillText(String(newLvl), newBoxX + BOX_W/2, LT_Y + 68);
    ctx.restore();

    // ── XP & REWARD ROW ───────────────────────────────────────
    const INFO_Y = LT_Y + BOX_H + 18;

    // XP pill
    if (totalXp > 0) {
      const xpTxt = `Total XP: ${totalXp.toLocaleString()}`;
      ctx.font = F(13, false);
      const xpW = ctx.measureText(xpTxt).width + 26;
      ctx.save();
      ctx.fillStyle = "rgba(46,125,50,0.5)";
      rr(ctx, ltX, INFO_Y, xpW, 28, 14, true, false);
      ctx.strokeStyle = "rgba(129,199,132,0.5)";
      ctx.lineWidth = 1;
      rr(ctx, ltX, INFO_Y, xpW, 28, 14, false, true);
      ctx.fillStyle = GREEN_PALE;
      ctx.font = F(13, false);
      ctx.fillText(xpTxt, ltX + 13, INFO_Y + 19);
      ctx.restore();
    }

    // reward pill
    if (reward) {
      const rwdTxt = `🎁 ${reward}`;
      ctx.font = F(13);
      const rwdW = ctx.measureText(rwdTxt).width + 26;
      const rwdX = ltX + (totalXp > 0 ? (ctx.measureText(`Total XP: ${totalXp.toLocaleString()}`).width + 26 + 10) : 0);
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10;
      const rwdG = ctx.createLinearGradient(rwdX, INFO_Y, rwdX+rwdW, INFO_Y+28);
      rwdG.addColorStop(0, GOLD_DARK);
      rwdG.addColorStop(1, GOLD);
      ctx.fillStyle = rwdG;
      rr(ctx, rwdX, INFO_Y, rwdW, 28, 14, true, false);
      ctx.fillStyle = TEXT_DARK;
      ctx.font = F(13);
      ctx.fillText(rwdTxt, rwdX + 13, INFO_Y + 19);
      ctx.restore();
    }

    // ── RANK BADGE (top right) ─────────────────────────────────
    const rkLabel = rank.toUpperCase();
    ctx.font = F(13);
    const rkW = ctx.measureText(rkLabel).width + 28;
    const RANK_COLORS = {
      OWNER:   { bg:"#2e7d32", txt:WHITE },
      ADMIN:   { bg:"#388e3c", txt:WHITE },
      VIP:     { bg:"#43a047", txt:WHITE },
      PREMIUM: { bg:"#66bb6a", txt:WHITE },
      GOLD:    { bg:"#ffd54f", txt:"#1b5e20" },
      MEMBER:  { bg:"#81c784", txt:TEXT_DARK },
    };
    const rkC = RANK_COLORS[rkLabel] || { bg:GREEN_PALE, txt:TEXT_DARK };
    const rkX = cX + cW - rkW - 20, rkY = cY + 20;
    ctx.save();
    ctx.shadowColor = rkC.bg + "88";
    ctx.shadowBlur = 8;
    ctx.fillStyle = rkC.bg;
    rr(ctx, rkX, rkY, rkW, 30, 15, true, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    rr(ctx, rkX, rkY, rkW, 30, 15, false, true);
    ctx.restore();
    ctx.fillStyle = rkC.txt;
    ctx.font = F(13);
    ctx.textAlign = "center";
    ctx.fillText(rkLabel, rkX+rkW/2, rkY+20);
    ctx.textAlign = "left";

    // ── BOTTOM RIBBON ─────────────────────────────────────────
    const RIB_H = 36;
    const RIB_Y = cY + cH - RIB_H;
    const ribG = ctx.createLinearGradient(cX, RIB_Y, cX+cW, RIB_Y);
    ribG.addColorStop(0, GREEN_DARK);
    ribG.addColorStop(0.5, GREEN_MAIN);
    ribG.addColorStop(1, GREEN_DARK);
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

    // ribbon separator line
    ctx.save();
    ctx.strokeStyle = "rgba(255,213,79,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cX+16, RIB_Y+0.5); ctx.lineTo(cX+cW-16, RIB_Y+0.5); ctx.stroke();
    ctx.restore();

    // ribbon stars & text
    const ribMidX = cX + cW / 2;
    drawStar(ctx, ribMidX - 140, RIB_Y+18, 6, 2.5, 4, GOLD, 0.8);
    drawStar(ctx, ribMidX + 140, RIB_Y+18, 6, 2.5, 4, GOLD, 0.8);
    drawStar(ctx, ribMidX - 100, RIB_Y+18, 4, 1.5, 4, GREEN_LIGHT, 0.6);
    drawStar(ctx, ribMidX + 100, RIB_Y+18, 4, 1.5, 4, GREEN_LIGHT, 0.6);

    ctx.save();
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8;
    ctx.fillStyle = GOLD;
    ctx.font = F(14);
    ctx.textAlign = "center";
    ctx.fillText("CONGRATULATIONS", ribMidX, RIB_Y + 23);
    ctx.restore();

    // corner dots
    [[cX+18, cY+18],[cX+cW-18, cY+18]].forEach(([dx,dy]) => {
      drawStar(ctx, dx, dy, 6, 2.5, 4, GOLD, 0.7);
    });
    ctx.fillStyle = "rgba(129,199,132,0.5)";
    ctx.beginPath(); ctx.arc(cX+18, cY+cH-18, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cX+cW-18, cY+cH-18, 4, 0, Math.PI*2); ctx.fill();

    res.setHeader("Content-Type","image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
