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

function drawDot(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, outerR, innerR, points, color, alpha = 1) {
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

    // ── PALETTE (matches profile card) ───────────────────────
    const GREEN_MAIN  = "#2e7d32";
    const GREEN_LIGHT = "#81c784";
    const GREEN_PALE  = "#c8e6c9";
    const GREEN_DARK  = "#1b5e20";
    const WHITE       = "#ffffff";
    const TEXT_DARK   = "#1e2a1e";
    const TEXT_GRAY   = "#4a5b4a";

    // ── CANVAS ────────────────────────────────────────────────
    const W = 620, H = 200;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // ── BACKGROUND: same soft green gradient as profile ──────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#e8f5e9");
    bg.addColorStop(1, "#f1f8e9");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // subtle corner blobs (same as profile)
    [[0, 0, 110], [W, 0, 90], [W, H, 110], [0, H, 90]].forEach(([bx, by, br]) => {
      ctx.save();
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, "rgba(129,199,132,0.12)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // ── CARD (white, shadow, green border — same as profile) ─
    const cX = 16, cY = 14, cW = W - 32, cH = H - 28;

    ctx.save();
    ctx.shadowColor   = "rgba(0,40,0,0.10)";
    ctx.shadowBlur    = 20;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle     = WHITE;
    rr(ctx, cX, cY, cW, cH, 22, true, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle  = GREEN_MAIN;
    ctx.lineWidth    = 1.5;
    ctx.globalAlpha  = 0.4;
    rr(ctx, cX, cY, cW, cH, 22, false, true);
    ctx.restore();

    // ── AVATAR (same style as profile: gradient ring + white stroke) ─
    const AV_CX = cX + 88, AV_CY = cY + cH / 2, AV_R = 58;

    ctx.save();
    const ring = ctx.createLinearGradient(AV_CX - AV_R, AV_CY - AV_R, AV_CX + AV_R, AV_CY + AV_R);
    ring.addColorStop(0, GREEN_PALE);
    ring.addColorStop(1, GREEN_LIGHT);
    ctx.strokeStyle = ring;
    ctx.lineWidth   = 4;
    ctx.shadowColor = "rgba(46,125,50,0.3)";
    ctx.shadowBlur  = 12;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(avImg, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
    ctx.restore();

    // same green dot sparkles as profile
    const sp = [[AV_CX - AV_R - 12, AV_CY - 20, 4], [AV_CX + AV_R + 10, AV_CY - 24, 3.5],
                [AV_CX + AV_R + 8, AV_CY + 22, 4],   [AV_CX - AV_R - 10, AV_CY + 26, 3],
                [AV_CX, AV_CY - AV_R - 14, 3.5]];
    sp.forEach(([x, y, r]) => drawDot(ctx, x, y, r, GREEN_LIGHT, 0.9));

    // ── VERTICAL DIVIDER (same as profile card style) ─────────
    const DIV_X = cX + 164;
    ctx.save();
    const dvG = ctx.createLinearGradient(DIV_X, cY + 14, DIV_X, cY + cH - 14);
    dvG.addColorStop(0,   "rgba(46,125,50,0)");
    dvG.addColorStop(0.3, "rgba(46,125,50,0.3)");
    dvG.addColorStop(0.7, "rgba(46,125,50,0.25)");
    dvG.addColorStop(1,   "rgba(46,125,50,0)");
    ctx.strokeStyle = dvG;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(DIV_X, cY + 14); ctx.lineTo(DIV_X, cY + cH - 14); ctx.stroke();
    ctx.restore();

    // ── RIGHT CONTENT ─────────────────────────────────────────
    const TX  = DIV_X + 22;
    const CY  = cY + cH / 2;

    // ── TITLE: "LEVEL UP!" — big, bold, green ─────────────────
    const titleTxt = "LEVEL UP!";
    ctx.save();
    ctx.font = F(38);
    ctx.shadowColor = "rgba(46,125,50,0.18)";
    ctx.shadowBlur  = 8;
    const titleGrad = ctx.createLinearGradient(TX, CY - 50, TX + 220, CY - 10);
    titleGrad.addColorStop(0, GREEN_MAIN);
    titleGrad.addColorStop(0.6, GREEN_LIGHT);
    titleGrad.addColorStop(1, GREEN_DARK);
    ctx.fillStyle = titleGrad;
    ctx.fillText(titleTxt, TX, CY - 18);
    ctx.restore();

    // thin separator below title (same pattern as profile's EXP separator line)
    ctx.save();
    ctx.strokeStyle = "rgba(46,125,50,0.15)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(TX, CY - 8); ctx.lineTo(TX + 330, CY - 8); ctx.stroke();
    ctx.restore();

    // ── NAME ──────────────────────────────────────────────────
    const nameText = name.length > 18 ? name.slice(0, 16) + "\u2026" : name;
    ctx.save();
    ctx.font      = F(15, false);
    ctx.fillStyle = TEXT_GRAY;
    ctx.fillText(nameText, TX, CY + 10);
    ctx.restore();

    // ── LEVEL TRANSITION: Lv.X → Lv.Y ────────────────────────
    const LV_Y = CY + 50;

    ctx.font = F(34);
    const oldStr = String(oldLvl);
    const newStr = String(newLvl);
    const oldW   = ctx.measureText(oldStr).width;
    const newW   = ctx.measureText(newStr).width;

    ctx.font = F(13, false);
    const prefW = ctx.measureText("Lv.").width;
    const ARR_W = 20, GAP = 8;

    let px = TX;

    // "Lv." old label (muted)
    ctx.save();
    ctx.font      = F(13, false);
    ctx.fillStyle = "rgba(74,91,74,0.5)";
    ctx.fillText("Lv.", px, LV_Y);
    ctx.restore();
    px += prefW + 2;

    // old number (muted gray-green)
    ctx.save();
    ctx.font      = F(34);
    ctx.fillStyle = "rgba(100,140,100,0.4)";
    ctx.fillText(oldStr, px, LV_Y);
    ctx.restore();
    px += oldW + GAP;

    // arrow (solid green, same feel as profile's green elements)
    const arrCY = LV_Y - 13;
    ctx.save();
    ctx.fillStyle   = GREEN_MAIN;
    ctx.shadowColor = "rgba(46,125,50,0.4)";
    ctx.shadowBlur  = 10;
    const aw = ARR_W, ah = 8;
    ctx.beginPath();
    ctx.moveTo(px,          arrCY - ah / 2);
    ctx.lineTo(px + aw - 6, arrCY - ah / 2);
    ctx.lineTo(px + aw - 6, arrCY - ah);
    ctx.lineTo(px + aw,     arrCY);
    ctx.lineTo(px + aw - 6, arrCY + ah);
    ctx.lineTo(px + aw - 6, arrCY + ah / 2);
    ctx.lineTo(px,          arrCY + ah / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    px += aw + GAP;

    // "Lv." new label (green)
    ctx.save();
    ctx.font        = F(13, false);
    ctx.fillStyle   = GREEN_MAIN;
    ctx.shadowColor = "rgba(46,125,50,0.3)";
    ctx.shadowBlur  = 6;
    ctx.fillText("Lv.", px, LV_Y);
    ctx.restore();
    px += prefW + 2;

    // new number (gradient, same as profile's gradient text highlight)
    ctx.save();
    ctx.font        = F(34);
    ctx.shadowColor = "rgba(46,125,50,0.25)";
    ctx.shadowBlur  = 14;
    const lvGrad = ctx.createLinearGradient(px, LV_Y - 34, px + newW, LV_Y);
    lvGrad.addColorStop(0,   GREEN_DARK);
    lvGrad.addColorStop(0.5, GREEN_MAIN);
    lvGrad.addColorStop(1,   GREEN_LIGHT);
    ctx.fillStyle = lvGrad;
    ctx.fillText(newStr, px, LV_Y);
    ctx.restore();

    // ── BOTTOM RIBBON (same as profile card) ─────────────────
    const RIB_H = 30;
    const RIB_Y = cY + cH - RIB_H;
    const ribG  = ctx.createLinearGradient(cX, RIB_Y, cX + cW, RIB_Y);
    ribG.addColorStop(0, GREEN_MAIN);
    ribG.addColorStop(1, GREEN_LIGHT);
    ctx.fillStyle = ribG;
    ctx.beginPath();
    ctx.moveTo(cX, RIB_Y);
    ctx.lineTo(cX + cW, RIB_Y);
    ctx.lineTo(cX + cW, cY + cH - 22);
    ctx.quadraticCurveTo(cX + cW, cY + cH, cX + cW - 22, cY + cH);
    ctx.lineTo(cX + 22, cY + cH);
    ctx.quadraticCurveTo(cX, cY + cH, cX, cY + cH - 22);
    ctx.lineTo(cX, RIB_Y);
    ctx.closePath();
    ctx.fill();

    // same dot pattern as profile ribbon
    for (let i = 0; i < 11; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(cX + 36 + i * (cW - 72) / 10, RIB_Y + RIB_H / 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = WHITE;
    ctx.font      = F(12);
    ctx.textAlign = "center";
    ctx.fillText("KEEP GROWING", cX + cW / 2, RIB_Y + 20);
    ctx.textAlign = "left";

    // corner accent dots (same as profile)
    ctx.fillStyle = GREEN_LIGHT;
    [[cX + 14, cY + 14], [cX + cW - 14, cY + 14],
     [cX + 14, cY + cH - 14], [cX + cW - 14, cY + cH - 14]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    });

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
