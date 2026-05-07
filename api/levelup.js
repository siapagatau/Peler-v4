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
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);    ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);        ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

function drawStar(ctx, cx, cy, outerR, innerR, points, color, alpha) {
  alpha = alpha !== undefined ? alpha : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    i === 0
      ? ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
      : ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── HANDLER ──────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      name     = "User",
      oldLevel = "1",
      newLevel = "2",
      avatar   = "https://cdn.discordapp.com/embed/avatars/0.png",
    } = req.query;

    const oldLvl = parseInt(oldLevel) || 1;
    const newLvl = parseInt(newLevel) || oldLvl + 1;

    // ── CANVAS (compact horizontal) ───────────────────────────
    const W = 560, H = 160;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // ── COLOURS ───────────────────────────────────────────────
    const GOLD     = "#ffd54f";
    const GREEN_HI = "#69f076";
    const WHITE    = "#ffffff";

    // ── BACKGROUND ────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   "#0d1f0d");
    bg.addColorStop(0.5, "#162916");
    bg.addColorStop(1,   "#0d1f0d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // center-right radial glow
    const glow = ctx.createRadialGradient(W * 0.65, H * 0.5, 0, W * 0.65, H * 0.5, H * 0.9);
    glow.addColorStop(0,   "rgba(46,125,50,0.3)");
    glow.addColorStop(0.6, "rgba(46,125,50,0.06)");
    glow.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── CARD BORDER ───────────────────────────────────────────
    ctx.save();
    const bdG = ctx.createLinearGradient(0, 0, W, H);
    bdG.addColorStop(0,   "rgba(105,240,118,0.75)");
    bdG.addColorStop(0.5, "rgba(255,213,79,0.55)");
    bdG.addColorStop(1,   "rgba(105,240,118,0.75)");
    ctx.strokeStyle = bdG;
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = GREEN_HI;
    ctx.shadowBlur  = 10;
    rr(ctx, 1, 1, W - 2, H - 2, 18, false, true);
    ctx.restore();

    // ── AVATAR ────────────────────────────────────────────────
    const AV_CX = 80, AV_CY = H / 2, AV_R = 56;

    // soft glow behind avatar
    const avGlow = ctx.createRadialGradient(AV_CX, AV_CY, 0, AV_CX, AV_CY, AV_R + 24);
    avGlow.addColorStop(0,   "rgba(105,240,118,0.18)");
    avGlow.addColorStop(0.7, "rgba(46,125,50,0.05)");
    avGlow.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = avGlow;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 24, 0, Math.PI * 2); ctx.fill();

    // gold-green ring
    ctx.save();
    const ringG = ctx.createLinearGradient(AV_CX - AV_R, AV_CY - AV_R, AV_CX + AV_R, AV_CY + AV_R);
    ringG.addColorStop(0,   GOLD);
    ringG.addColorStop(0.5, GREEN_HI);
    ringG.addColorStop(1,   GOLD);
    ctx.strokeStyle = ringG;
    ctx.lineWidth   = 3;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 14;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // white inner ring
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // avatar image
    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(avImg, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
    ctx.restore();

    // sparkles around avatar
    const sps = [
      [AV_CX - AV_R - 10, AV_CY - 22, 7,  GOLD,     0.9],
      [AV_CX + AV_R + 8,  AV_CY - 26, 6,  GREEN_HI, 0.8],
      [AV_CX + AV_R + 6,  AV_CY + 24, 7,  GOLD,     0.7],
      [AV_CX - AV_R - 8,  AV_CY + 26, 5,  GREEN_HI, 0.75],
      [AV_CX,             AV_CY - AV_R - 12, 5, GOLD, 0.85],
    ];
    sps.forEach(function(s) { drawStar(ctx, s[0], s[1], s[2], s[2] * 0.38, 4, s[3], s[4]); });

    // ── DIVIDER ───────────────────────────────────────────────
    const DIV_X = 153;
    ctx.save();
    const dvG = ctx.createLinearGradient(DIV_X, 18, DIV_X, H - 18);
    dvG.addColorStop(0,   "rgba(105,240,118,0)");
    dvG.addColorStop(0.3, "rgba(105,240,118,0.45)");
    dvG.addColorStop(0.7, "rgba(255,213,79,0.35)");
    dvG.addColorStop(1,   "rgba(105,240,118,0)");
    ctx.strokeStyle = dvG;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(DIV_X, 18); ctx.lineTo(DIV_X, H - 18); ctx.stroke();
    ctx.restore();

    // ── RIGHT: TEXT ───────────────────────────────────────────
    const TX = DIV_X + 22;
    const CY = H / 2;

    // "LEVEL UP" label (small caps spaced)
    ctx.save();
    ctx.font      = F(12, false);
    ctx.fillStyle = "rgba(165,214,167,0.7)";
    ctx.fillText("L E V E L   U P", TX, CY - 42);
    ctx.restore();

    // thin separator
    ctx.save();
    ctx.strokeStyle = "rgba(105,240,118,0.18)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(TX, CY - 32); ctx.lineTo(TX + 230, CY - 32); ctx.stroke();
    ctx.restore();

    // name
    const nameText = name.length > 16 ? name.slice(0, 14) + "\u2026" : name;
    ctx.save();
    ctx.font        = F(20);
    ctx.fillStyle   = WHITE;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur  = 6;
    ctx.fillText(nameText, TX, CY - 10);
    ctx.restore();

    // ── LEVEL TRANSITION: Lv.X → Lv.Y ────────────────────────
    const LV_Y = CY + 34;   // text baseline

    ctx.font = F(36);
    const oldStr = String(oldLvl);
    const newStr = String(newLvl);
    const oldW   = ctx.measureText(oldStr).width;
    const newW   = ctx.measureText(newStr).width;

    ctx.font = F(14, false);
    const prefW = ctx.measureText("Lv.").width;

    const ARR_W = 22, GAP = 10;
    let px = TX;

    // "Lv." old
    ctx.save();
    ctx.font      = F(14, false);
    ctx.fillStyle = "rgba(165,214,167,0.5)";
    ctx.fillText("Lv.", px, LV_Y);
    ctx.restore();
    px += prefW + 3;

    // old number (dim)
    ctx.save();
    ctx.font      = F(36);
    ctx.fillStyle = "rgba(200,230,201,0.45)";
    ctx.fillText(oldStr, px, LV_Y);
    ctx.restore();
    px += oldW + GAP;

    // arrow
    const arrCY = LV_Y - 15;
    ctx.save();
    ctx.fillStyle   = GOLD;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 14;
    const aw = ARR_W, ah = 9;
    ctx.beginPath();
    ctx.moveTo(px,          arrCY - ah / 2);
    ctx.lineTo(px + aw - 7, arrCY - ah / 2);
    ctx.lineTo(px + aw - 7, arrCY - ah);
    ctx.lineTo(px + aw,     arrCY);
    ctx.lineTo(px + aw - 7, arrCY + ah);
    ctx.lineTo(px + aw - 7, arrCY + ah / 2);
    ctx.lineTo(px,          arrCY + ah / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    px += aw + GAP;

    // "Lv." new
    ctx.save();
    ctx.font        = F(14, false);
    ctx.fillStyle   = GREEN_HI;
    ctx.shadowColor = GREEN_HI;
    ctx.shadowBlur  = 8;
    ctx.fillText("Lv.", px, LV_Y);
    ctx.restore();
    px += prefW + 3;

    // new number (bright gradient glow)
    ctx.save();
    ctx.font        = F(36);
    ctx.shadowColor = GREEN_HI;
    ctx.shadowBlur  = 24;
    const lvGrad = ctx.createLinearGradient(px, LV_Y - 36, px + newW, LV_Y);
    lvGrad.addColorStop(0,   WHITE);
    lvGrad.addColorStop(0.45, GREEN_HI);
    lvGrad.addColorStop(1,   GOLD);
    ctx.fillStyle = lvGrad;
    ctx.fillText(newStr, px, LV_Y);
    ctx.restore();

    // ── BOTTOM ACCENT LINE ────────────────────────────────────
    const lineY = H - 11;
    ctx.save();
    const lineG = ctx.createLinearGradient(24, lineY, W - 24, lineY);
    lineG.addColorStop(0,   "rgba(105,240,118,0)");
    lineG.addColorStop(0.3, "rgba(105,240,118,0.5)");
    lineG.addColorStop(0.5, "rgba(255,213,79,0.75)");
    lineG.addColorStop(0.7, "rgba(105,240,118,0.5)");
    lineG.addColorStop(1,   "rgba(105,240,118,0)");
    ctx.strokeStyle = lineG;
    ctx.lineWidth   = 1;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 6;
    ctx.beginPath(); ctx.moveTo(24, lineY); ctx.lineTo(W - 24, lineY); ctx.stroke();
    ctx.restore();

    drawStar(ctx, W / 2,      lineY, 4,   1.6, 4, GOLD,     0.9);
    drawStar(ctx, W / 2 - 55, lineY, 2.5, 1,   4, GREEN_HI, 0.6);
    drawStar(ctx, W / 2 + 55, lineY, 2.5, 1,   4, GREEN_HI, 0.6);

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
