const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// =========================
// LOAD FONT
// =========================
let hasEmojiFont = false;
try {
  const regular = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf"));
  const bold    = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf"));
  GlobalFonts.register(regular, "Inter");
  GlobalFonts.register(bold,    "InterBold");
  try {
    const emoji = fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf"));
    GlobalFonts.register(emoji, "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) {
  console.log("FONT ERROR:", e.message);
}

const getFont = (weight, size) => {
  const family = hasEmojiFont ? "'InterBold','NotoColorEmoji'" : "InterBold";
  return `${weight} ${size}px ${family}`;
};

// =========================
// HELPERS
// =========================
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y,         x + rr, y);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}

// 4-point star drawn on canvas (no unicode)
function drawStar(ctx, cx, cy, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? size : size * 0.38;
    const px = cx + Math.cos(angle - Math.PI / 2) * r;
    const py = cy + Math.sin(angle - Math.PI / 2) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, "") + "T";
  if (num >= 1e9)  return (num / 1e9).toFixed(1).replace(/\.0$/, "")  + "B";
  if (num >= 1e6)  return (num / 1e6).toFixed(1).replace(/\.0$/, "")  + "M";
  if (num >= 1e3)  return (num / 1e3).toFixed(1).replace(/\.0$/, "")  + "K";
  return num.toString();
}

// =========================
// MAIN HANDLER
// =========================
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });
  if (req.query.type !== "profile") return res.status(400).json({ error: 'Gunakan type="profile"' });

  try {
    let {
      name       = "User",
      uang       = "0",
      limit      = "0",
      rank       = "Member",
      avatar     = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent     = "#ff6eb4",
      level      = "1",
      xp         = "0",
      maxXp      = "100",
      bio        = "No bio yet.",
      badge1     = "Active",
      badge2     = "Friendly",
      badge3     = "Top Player",
    } = req.query;

    const money     = parseInt(uang)  || 0;
    const lim       = parseInt(limit) || 0;
    const currentXp = Math.min(parseInt(xp) || 0, parseInt(maxXp) || 100);
    const maxXpVal  = parseInt(maxXp) || 100;
    const xpPercent = Math.max(0, Math.min(100, (currentXp / maxXpVal) * 100));
    if (!accent || !/^#([0-9A-F]{3,6})$/i.test(accent)) accent = "#ff6eb4";

    // Palette
    const PINK     = "#ff85c2";
    const MINT     = "#7de8c0";
    const SKY      = "#85c8ff";
    const YELLOW   = "#ffd96e";
    const LAVENDER = "#c485ff";
    const WHITE    = "#ffffff";
    const DARK     = "#3a2050";

    // Canvas
    const W = 820, H = 420;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // ── 1. BACKGROUND ──────────────────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, W, H);
      } catch { background = ""; }
    }
    if (!background) {
      const bgG = ctx.createLinearGradient(0, 0, W, H);
      bgG.addColorStop(0,   "#ffdaf0");
      bgG.addColorStop(0.5, "#e0eaff");
      bgG.addColorStop(1,   "#d4f5e9");
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);
    }

    // soft blobs
    const blobs = [
      { x: 0,   y: 0,   r: 140, c: "rgba(255,180,220,0.28)" },
      { x: W,   y: 0,   r: 120, c: "rgba(180,210,255,0.28)" },
      { x: W,   y: H,   r: 150, c: "rgba(180,245,215,0.25)" },
      { x: 0,   y: H,   r: 110, c: "rgba(255,215,180,0.28)" },
      { x: W/2, y: H/2, r: 200, c: "rgba(220,200,255,0.12)" },
    ];
    for (const b of blobs) {
      ctx.save();
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── 2. CARD ─────────────────────────────────────────────────
    const cX = 24, cY = 20, cW = W - 48, cH = H - 40;

    ctx.save();
    ctx.shadowColor   = "rgba(160,100,200,0.22)";
    ctx.shadowBlur    = 28;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle     = "rgba(255,255,255,0.86)";
    roundRect(ctx, cX, cY, cW, cH, 28, true, false);
    ctx.restore();

    // rainbow border
    ctx.save();
    const bGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    bGrad.addColorStop(0,    PINK);
    bGrad.addColorStop(0.33, SKY);
    bGrad.addColorStop(0.66, MINT);
    bGrad.addColorStop(1,    YELLOW);
    ctx.strokeStyle = bGrad;
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.6;
    roundRect(ctx, cX, cY, cW, cH, 28, false, true);
    ctx.restore();

    // ── 3. COLUMN LAYOUT ───────────────────────────────────────
    const COL1_W     = 200;
    const COL2_X     = cX + COL1_W + 20;
    const COL2_W     = cW - COL1_W - 20;
    const CONTENT_TOP = cY + 26;

    // ── 4. AVATAR ────────────────────────────────────────────────
    const avR  = 68;
    const avCX = cX + COL1_W / 2;
    const avCY = cY + cH / 2 - 16;

    // glow ring
    ctx.save();
    const ringG = ctx.createLinearGradient(avCX - avR, avCY - avR, avCX + avR, avCY + avR);
    ringG.addColorStop(0,   PINK);
    ringG.addColorStop(0.5, LAVENDER);
    ringG.addColorStop(1,   SKY);
    ctx.strokeStyle = ringG;
    ctx.lineWidth   = 5;
    ctx.shadowColor = "rgba(255,100,180,0.5)";
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // white gap
    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // avatar image
    let avatarImg;
    try   { avatarImg = await loadImage(avatar); }
    catch { avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avCX - avR, avCY - avR, avR * 2, avR * 2);
    ctx.restore();

    // canvas sparkles around avatar
    drawStar(ctx, avCX - avR - 14, avCY - 20,     5, YELLOW,   0.9);
    drawStar(ctx, avCX + avR + 12, avCY - 32,     4, PINK,     0.9);
    drawStar(ctx, avCX + avR + 8,  avCY + 28,     5, MINT,     0.85);
    drawStar(ctx, avCX - avR - 10, avCY + 30,     4, SKY,      0.85);
    drawStar(ctx, avCX,            avCY - avR - 18, 4, LAVENDER, 0.8);

    // Level badge under avatar
    const lvlText = `Lv. ${level}`;
    ctx.font = getFont("bold", 13);
    const lvlW = ctx.measureText(lvlText).width + 28;
    const lvlX = avCX - lvlW / 2;
    const lvlY = avCY + avR + 10;

    ctx.save();
    ctx.shadowColor = "rgba(255,190,50,0.55)";
    ctx.shadowBlur  = 10;
    const lvlG = ctx.createLinearGradient(lvlX, lvlY, lvlX + lvlW, lvlY + 24);
    lvlG.addColorStop(0, "#ffe569");
    lvlG.addColorStop(1, "#ffa94d");
    ctx.fillStyle = lvlG;
    roundRect(ctx, lvlX, lvlY, lvlW, 24, 12, true, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth   = 1.5;
    roundRect(ctx, lvlX, lvlY, lvlW, 24, 12, false, true);
    ctx.restore();

    ctx.fillStyle = "#4a2800";
    ctx.font      = getFont("bold", 13);
    ctx.textAlign = "center";
    ctx.fillText(lvlText, avCX, lvlY + 16);
    ctx.textAlign = "left";

    // ── 5. RIGHT COLUMN ──────────────────────────────────────────
    let ry = CONTENT_TOP;

    // Row A: Name + Rank pill
    const displayName = name.length > 18 ? name.slice(0, 16) + "..." : name;
    ctx.font      = getFont("bold", 30);
    ctx.fillStyle = DARK;
    ctx.save();
    ctx.shadowColor = "rgba(200,100,180,0.2)";
    ctx.shadowBlur  = 6;
    ctx.fillText(displayName, COL2_X, ry + 28);
    ctx.restore();

    const rankLabel = rank.toUpperCase();
    ctx.font = getFont("bold", 11);
    const rkW = ctx.measureText(rankLabel).width + 22;
    const rankColors = {
      OWNER:   { bg: "#ff5e5e", txt: WHITE },
      ADMIN:   { bg: "#ff9f43", txt: WHITE },
      VIP:     { bg: "#a29bfe", txt: WHITE },
      PREMIUM: { bg: "#fd79a8", txt: WHITE },
      GOLD:    { bg: "#ffd32a", txt: "#4a3000" },
      MEMBER:  { bg: "#74b9ff", txt: WHITE },
    };
    const rk  = rankColors[rankLabel] || { bg: PINK, txt: WHITE };
    const rkX = COL2_X + COL2_W - rkW - 16;
    const rkY = ry + 8;

    ctx.save();
    ctx.shadowColor = rk.bg + "66";
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = rk.bg;
    roundRect(ctx, rkX, rkY, rkW, 22, 11, true, false);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth   = 1.2;
    roundRect(ctx, rkX, rkY, rkW, 22, 11, false, true);
    ctx.restore();
    ctx.fillStyle = rk.txt;
    ctx.font      = getFont("bold", 11);
    ctx.textAlign = "center";
    ctx.fillText(rankLabel, rkX + rkW / 2, rkY + 15);
    ctx.textAlign = "left";

    ry += 44;

    // Row B: Stat Cards (Coins, Limit, Level)
    const statDefs = [
      { label: "Coins", value: formatNumber(money), g: ["#ff85c2","#ffb3de"], sh: "rgba(255,100,180,0.3)" },
      { label: "Limit", value: formatNumber(lim),   g: ["#ffd085","#ffb085"], sh: "rgba(255,160,80,0.3)"  },
      { label: "Level", value: String(level),        g: ["#a29bfe","#85c8ff"], sh: "rgba(130,100,255,0.3)"},
    ];
    const scH   = 62;
    const scGap = 10;
    const scW   = Math.floor((COL2_W - scGap * 2 - 16) / 3);

    for (let i = 0; i < statDefs.length; i++) {
      const sc  = statDefs[i];
      const scX = COL2_X + i * (scW + scGap);
      const scY = ry;

      ctx.save();
      ctx.shadowColor   = sc.sh;
      ctx.shadowBlur    = 10;
      ctx.shadowOffsetY = 3;
      const scG = ctx.createLinearGradient(scX, scY, scX + scW, scY + scH);
      scG.addColorStop(0, sc.g[0]);
      scG.addColorStop(1, sc.g[1]);
      ctx.fillStyle = scG;
      roundRect(ctx, scX, scY, scW, scH, 16, true, false);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth   = 1.5;
      roundRect(ctx, scX, scY, scW, scH, 16, false, true);
      ctx.restore();

      // shine
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.ellipse(scX + scW * 0.5, scY + 10, scW * 0.36, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(60,20,60,0.5)";
      ctx.font      = getFont("bold", 10);
      ctx.fillText(sc.label.toUpperCase(), scX + 10, scY + 18);

      ctx.fillStyle = WHITE;
      ctx.font      = getFont("bold", 22);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur  = 3;
      ctx.fillText(sc.value, scX + 10, scY + 48);
      ctx.restore();
    }

    ry += scH + 12;

    // Row C: EXP bar
    const barW = COL2_W - 16;
    const barH = 16;

    ctx.fillStyle = DARK;
    ctx.font      = getFont("bold", 11);
    ctx.fillText("EXP", COL2_X, ry + 11);

    const xpLabel = `${formatNumber(currentXp)} / ${formatNumber(maxXpVal)}`;
    ctx.font      = getFont("bold", 10);
    ctx.fillStyle = "#9980aa";
    ctx.textAlign = "right";
    ctx.fillText(xpLabel, COL2_X + barW, ry + 11);
    ctx.textAlign = "left";
    ry += 16;

    // track
    ctx.save();
    ctx.fillStyle = "rgba(200,180,230,0.35)";
    roundRect(ctx, COL2_X, ry, barW, barH, barH / 2, true, false);
    ctx.restore();

    // fill
    const fillW = Math.max((xpPercent / 100) * barW, xpPercent > 0 ? barH : 0);
    if (fillW > 0) {
      ctx.save();
      const xG = ctx.createLinearGradient(COL2_X, ry, COL2_X + barW, ry);
      xG.addColorStop(0,   "#ff85c2");
      xG.addColorStop(0.4, "#c485ff");
      xG.addColorStop(0.8, "#85c8ff");
      xG.addColorStop(1,   "#7de8c0");
      ctx.fillStyle   = xG;
      ctx.shadowColor = "rgba(190,100,255,0.45)";
      ctx.shadowBlur  = 7;
      roundRect(ctx, COL2_X, ry, fillW, barH, barH / 2, true, false);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      roundRect(ctx, COL2_X + 2, ry + 2, Math.max(fillW - 4, 0), barH / 2 - 2, (barH / 2 - 2) / 2, true, false);
      ctx.restore();
    }

    // ticks
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth   = 1.2;
    for (let i = 1; i < 10; i++) {
      const sx = COL2_X + (barW / 10) * i;
      ctx.beginPath(); ctx.moveTo(sx, ry + 3); ctx.lineTo(sx, ry + barH - 3); ctx.stroke();
    }
    ctx.restore();

    ry += barH + 6;

    // pct pill
    const pctStr = `${Math.round(xpPercent)}%`;
    ctx.font = getFont("bold", 10);
    const pctW = ctx.measureText(pctStr).width + 14;
    ctx.save();
    ctx.fillStyle = "rgba(190,150,240,0.2)";
    roundRect(ctx, COL2_X, ry, pctW, 17, 8, true, false);
    ctx.fillStyle = LAVENDER;
    ctx.fillText(pctStr, COL2_X + 7, ry + 12);
    ctx.restore();

    ry += 24;

    // Row D: Bio
    const bioText = (bio || "No bio yet.").slice(0, 60);
    ctx.fillStyle = "#8870a0";
    ctx.font      = getFont("normal", 11);
    const words = bioText.split(" ");
    let line1 = "", line2 = "", switched = false;
    for (const w of words) {
      const test = line1 ? line1 + " " + w : w;
      if (!switched && ctx.measureText(test).width < barW) {
        line1 = test;
      } else {
        switched = true;
        const t2 = line2 ? line2 + " " + w : w;
        if (ctx.measureText(t2).width < barW) line2 = t2;
      }
    }
    ctx.fillText(line1, COL2_X, ry + 12);
    if (line2) ctx.fillText(line2, COL2_X, ry + 26);
    ry += line2 ? 38 : 22;

    // Row E: Badge pills
    const badges      = [badge1, badge2, badge3].filter(Boolean);
    const badgeColors = [
      { bg: "rgba(255,133,194,0.18)", border: PINK,    txt: "#b0005e" },
      { bg: "rgba(133,200,255,0.18)", border: SKY,     txt: "#0050a0" },
      { bg: "rgba(125,232,192,0.18)", border: MINT,    txt: "#005838" },
    ];
    let bx = COL2_X;
    for (let i = 0; i < badges.length; i++) {
      const label = badges[i].slice(0, 14);
      ctx.font = getFont("bold", 10);
      const bw = ctx.measureText(label).width + 20;
      const bc = badgeColors[i % badgeColors.length];
      ctx.save();
      ctx.fillStyle = bc.bg;
      roundRect(ctx, bx, ry, bw, 22, 11, true, false);
      ctx.strokeStyle = bc.border;
      ctx.lineWidth   = 1.2;
      ctx.globalAlpha = 0.7;
      roundRect(ctx, bx, ry, bw, 22, 11, false, true);
      ctx.restore();
      ctx.fillStyle = bc.txt;
      ctx.font      = getFont("bold", 10);
      ctx.fillText(label, bx + 10, ry + 15);
      bx += bw + 8;
      if (bx > COL2_X + barW - 40) break;
    }

    // ── 6. BOTTOM RIBBON ─────────────────────────────────────────
    const ribH = 34;
    const ribY = cY + cH - ribH;
    const ribG = ctx.createLinearGradient(cX, ribY, cX + cW, ribY);
    ribG.addColorStop(0,    "rgba(255,150,210,0.65)");
    ribG.addColorStop(0.25, "rgba(200,160,255,0.65)");
    ribG.addColorStop(0.5,  "rgba(150,200,255,0.65)");
    ribG.addColorStop(0.75, "rgba(150,240,210,0.65)");
    ribG.addColorStop(1,    "rgba(255,230,150,0.65)");
    ctx.fillStyle = ribG;

    ctx.beginPath();
    ctx.moveTo(cX, ribY);
    ctx.lineTo(cX + cW, ribY);
    ctx.lineTo(cX + cW, cY + cH - 28);
    ctx.quadraticCurveTo(cX + cW, cY + cH, cX + cW - 28, cY + cH);
    ctx.lineTo(cX + 28, cY + cH);
    ctx.quadraticCurveTo(cX, cY + cH, cX, cY + cH - 28);
    ctx.lineTo(cX, ribY);
    ctx.closePath();
    ctx.fill();

    // sparkle dots in ribbon
    for (let i = 0; i < 7; i++) {
      const sx = cX + 55 + i * (cW - 110) / 6;
      drawStar(ctx, sx, ribY + ribH / 2, 3.5, WHITE, 0.55);
    }

    // ribbon text — ASCII only
    ctx.save();
    ctx.fillStyle = "rgba(60,20,60,0.55)";
    ctx.font      = getFont("bold", 11);
    ctx.textAlign = "center";
    ctx.fillText("* * *  K E E P  L E V E L I N G  U P !  * * *", cX + cW / 2, ribY + 22);
    ctx.textAlign = "left";
    ctx.restore();

    // corner sparkles (canvas drawn)
    drawStar(ctx, cX + 18,      cY + 18,      5, PINK,   0.65);
    drawStar(ctx, cX + cW - 18, cY + 18,      4, SKY,    0.65);
    drawStar(ctx, cX + 18,      cY + cH - 18, 4, YELLOW, 0.65);
    drawStar(ctx, cX + cW - 18, cY + cH - 18, 5, MINT,   0.65);

    // ── SEND ────────────────────────────────────────────────────
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
