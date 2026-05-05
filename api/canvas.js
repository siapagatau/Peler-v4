const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

// =========================
// LOAD FONT
// =========================
let hasEmojiFont = false;
try {
  const regular = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf"));
  const bold = fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf"));
  GlobalFonts.register(regular, "Inter");
  GlobalFonts.register(bold, "InterBold");
  try {
    const emoji = fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf"));
    GlobalFonts.register(emoji, "NotoColorEmoji");
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) {
  console.log("FONT ERROR:", e.message);
}

const getFont = (weight, size) => {
  const family = hasEmojiFont ? "'InterBold', 'NotoColorEmoji'" : "InterBold";
  return `${weight} ${size}px ${family}`;
};

// =========================
// HELPER: roundRect
// =========================
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// =========================
// HELPER: drawStar (sparkle kecil)
// =========================
function drawStar(ctx, cx, cy, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // 4-pointed star
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 - Math.PI / 4;
    const outerX = cx + Math.cos(angle) * size;
    const outerY = cy + Math.sin(angle) * size;
    const innerAngle = angle + Math.PI / 4;
    const innerX = cx + Math.cos(innerAngle) * (size * 0.35);
    const innerY = cy + Math.sin(innerAngle) * (size * 0.35);
    if (i === 0) {
      ctx.moveTo(outerX, outerY);
    } else {
      ctx.lineTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
    }
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// =========================
// HELPER: drawCloud bubble
// =========================
function drawBubble(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// =========================
// HELPER: formatNumber
// =========================
function formatNumber(num) {
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "") + "T";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toString();
}

// =========================
// MAIN HANDLER
// =========================
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (req.query.type !== "profile") return res.status(400).json({ error: 'Gunakan type="profile"' });

  try {
    let {
      name = "User",
      uang = "0",
      limit = "0",
      rank = "Member",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      accent = "#ff6eb4",
      level = "1",
      xp = "0",
      maxXp = "100"
    } = req.query;

    const money = parseInt(uang) || 0;
    const lim = parseInt(limit) || 0;
    const currentXp = Math.min(parseInt(xp) || 0, parseInt(maxXp) || 100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPercent = Math.max(0, Math.min(100, (currentXp / maxXpVal) * 100));
    if (!accent || !/^#([0-9A-F]{3,6})$/i.test(accent)) accent = "#ff6eb4";

    // ---- Pastel palette derived from accent ----
    // Fixed cute pastel game palette
    const PINK    = "#ff85c2";
    const PEACH   = "#ffb085";
    const MINT    = "#85e8c0";
    const SKY     = "#85c8ff";
    const YELLOW  = "#ffe085";
    const LAVENDER= "#c485ff";
    const WHITE   = "#ffffff";
    const DARK    = "#3a2d4a";   // soft dark purple for text
    const CARD_BG = "rgba(255,255,255,0.88)";

    const width = 820;
    const height = 460;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // =========================
    // 1. BACKGROUND — soft gradient pastel sky
    // =========================
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0,   "#ffd6f0");
    bgGrad.addColorStop(0.4, "#dce8ff");
    bgGrad.addColorStop(1,   "#d6f5e8");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Soft polka dots pattern
    const dots = [
      { x: 60,  y: 60,  r: 28, c: "rgba(255,182,220,0.4)" },
      { x: 740, y: 50,  r: 22, c: "rgba(182,213,255,0.4)" },
      { x: 780, y: 300, r: 35, c: "rgba(182,255,220,0.35)" },
      { x: 30,  y: 360, r: 30, c: "rgba(255,220,182,0.4)" },
      { x: 420, y: 15,  r: 18, c: "rgba(200,182,255,0.35)" },
      { x: 650, y: 420, r: 25, c: "rgba(255,240,182,0.4)" },
      { x: 150, y: 420, r: 20, c: "rgba(255,182,220,0.3)" },
    ];
    for (const d of dots) {
      ctx.save();
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sparkle decorations in background
    const sparkles = [
      { x: 90,  y: 120, s: 7,  c: PINK,   a: 0.6 },
      { x: 730, y: 90,  s: 5,  c: SKY,    a: 0.7 },
      { x: 760, y: 340, s: 8,  c: MINT,   a: 0.5 },
      { x: 50,  y: 280, s: 6,  c: YELLOW, a: 0.6 },
      { x: 500, y: 30,  s: 5,  c: LAVENDER,a:0.6 },
      { x: 700, y: 420, s: 7,  c: PEACH,  a: 0.5 },
      { x: 200, y: 45,  s: 4,  c: MINT,   a: 0.6 },
    ];
    for (const sp of sparkles) drawStar(ctx, sp.x, sp.y, sp.s, sp.c, sp.a);

    // =========================
    // 2. MAIN CARD
    // =========================
    const cX = 30, cY = 30, cW = width - 60, cH = height - 60;

    // Card shadow
    ctx.save();
    ctx.shadowColor = "rgba(180, 120, 200, 0.3)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = CARD_BG;
    roundRect(ctx, cX, cY, cW, cH, 32, true, false);
    ctx.restore();

    // Card border — dashed rainbow-ish
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    roundRect(ctx, cX, cY, cW, cH, 32, false, true);
    ctx.restore();

    // Inner thin colored border
    ctx.save();
    const borderGrad = ctx.createLinearGradient(cX, cY, cX + cW, cY + cH);
    borderGrad.addColorStop(0,   PINK);
    borderGrad.addColorStop(0.33, SKY);
    borderGrad.addColorStop(0.66, MINT);
    borderGrad.addColorStop(1,   YELLOW);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    roundRect(ctx, cX + 4, cY + 4, cW - 8, cH - 8, 29, false, true);
    ctx.restore();

    // =========================
    // 3. LEFT SECTION — avatar area with cute frame
    // =========================
    const avCX = cX + 50 + 55; // center of avatar
    const avCY = cY + 50 + 55;
    const avR  = 55;

    // Outer ring gradient
    ctx.save();
    const ringGrad = ctx.createLinearGradient(avCX - avR - 8, avCY - avR - 8, avCX + avR + 8, avCY + avR + 8);
    ringGrad.addColorStop(0, PINK);
    ringGrad.addColorStop(0.5, LAVENDER);
    ringGrad.addColorStop(1, SKY);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 6;
    ctx.shadowColor = "rgba(255, 100, 180, 0.4)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // White gap ring
    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Avatar clip
    let avatarImg;
    try { avatarImg = await loadImage(avatar); }
    catch { avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avCX - avR, avCY - avR, avR * 2, avR * 2);
    ctx.restore();

    // Small star decorations around avatar
    drawStar(ctx, avCX - avR - 12, avCY - 20, 5, YELLOW, 0.9);
    drawStar(ctx, avCX + avR + 10, avCY - 30, 4, PINK,   0.9);
    drawStar(ctx, avCX + avR + 5,  avCY + 30, 6, MINT,   0.8);
    drawStar(ctx, avCX - avR - 8,  avCY + 35, 4, SKY,    0.9);

    // Level badge — coin style at bottom of avatar
    const badgeX = avCX - 28;
    const badgeY = avCY + avR - 5;

    ctx.save();
    ctx.shadowColor = "rgba(255, 200, 60, 0.6)";
    ctx.shadowBlur = 10;
    const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + 56, badgeY + 26);
    badgeGrad.addColorStop(0, "#ffe569");
    badgeGrad.addColorStop(1, "#ff9f43");
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, badgeX, badgeY, 56, 26, 13, true, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 2;
    roundRect(ctx, badgeX, badgeY, 56, 26, 13, false, true);
    ctx.restore();

    ctx.fillStyle = "#3a2000";
    ctx.font = getFont("bold", 13);
    ctx.textAlign = "center";
    ctx.fillText(`✦ Lv.${level}`, badgeX + 28, badgeY + 18);
    ctx.textAlign = "left";

    // =========================
    // 4. NAME + RANK TAG
    // =========================
    const txtX = cX + 175;
    let curY = cY + 60;

    // Name
    ctx.save();
    ctx.font = getFont("bold", 30);
    ctx.fillStyle = DARK;
    ctx.shadowColor = "rgba(255,100,180,0.3)";
    ctx.shadowBlur = 6;
    const displayName = name.length > 18 ? name.slice(0, 16) + "…" : name;
    ctx.fillText(displayName, txtX, curY);
    ctx.restore();
    curY += 14;

    // Rank pill
    const rankLabel = rank.toUpperCase();
    ctx.font = getFont("bold", 12);
    const rkW = ctx.measureText(rankLabel).width + 28;

    // Pick rank color
    const rankColors = {
      OWNER:  { bg: "#ff6b6b", txt: "#fff" },
      ADMIN:  { bg: "#ff9f43", txt: "#fff" },
      VIP:    { bg: "#a29bfe", txt: "#fff" },
      MEMBER: { bg: "#74b9ff", txt: "#fff" },
    };
    const rk = rankColors[rankLabel] || { bg: PINK, txt: WHITE };

    ctx.save();
    ctx.shadowColor = rk.bg + "66";
    ctx.shadowBlur = 8;
    ctx.fillStyle = rk.bg;
    roundRect(ctx, txtX, curY, rkW, 22, 11, true, false);
    ctx.restore();

    ctx.fillStyle = rk.txt;
    ctx.font = getFont("bold", 11);
    ctx.fillText(rankLabel, txtX + 14, curY + 15);
    curY += 38;

    // =========================
    // 5. INFO STAT CARDS (Uang, Limit)
    // =========================
    const statCards = [
      { label: "💰 Coins",  value: formatNumber(money), grad: ["#ff85c2", "#ffb3de"], shadow: "rgba(255,100,180,0.3)" },
      { label: "🎫 Limit",  value: formatNumber(lim),   grad: ["#ffd085", "#ffb085"], shadow: "rgba(255,160,80,0.3)"  },
    ];

    const scW = 148, scH = 68, scGap = 14;
    for (let i = 0; i < statCards.length; i++) {
      const sc = statCards[i];
      const scX = txtX + i * (scW + scGap);
      const scY = curY;

      // Card
      ctx.save();
      ctx.shadowColor = sc.shadow;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      const scGrad = ctx.createLinearGradient(scX, scY, scX + scW, scY + scH);
      scGrad.addColorStop(0, sc.grad[0]);
      scGrad.addColorStop(1, sc.grad[1]);
      ctx.fillStyle = scGrad;
      roundRect(ctx, scX, scY, scW, scH, 18, true, false);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, scX, scY, scW, scH, 18, false, true);
      ctx.restore();

      // Label
      ctx.fillStyle = "rgba(60,20,60,0.6)";
      ctx.font = getFont("bold", 11);
      ctx.fillText(sc.label, scX + 12, scY + 22);

      // Value
      ctx.fillStyle = WHITE;
      ctx.font = getFont("bold", 24);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 4;
      ctx.fillText(sc.value, scX + 12, scY + 52);
      ctx.restore();
    }
    curY += scH + 20;

    // =========================
    // 6. XP PROGRESS BAR — cute segmented
    // =========================
    const barX = txtX;
    const barW = 490;
    const barH = 18;

    // Label row
    ctx.fillStyle = DARK;
    ctx.font = getFont("bold", 12);
    ctx.fillText("⚡ EXP", barX, curY);

    ctx.fillStyle = "#888";
    ctx.font = getFont("normal", 11);
    ctx.textAlign = "right";
    ctx.fillText(`${formatNumber(currentXp)} / ${formatNumber(maxXpVal)} XP`, barX + barW, curY);
    ctx.textAlign = "left";
    curY += 8;

    // Track
    ctx.save();
    ctx.fillStyle = "rgba(200,180,220,0.35)";
    roundRect(ctx, barX, curY, barW, barH, barH / 2, true, false);
    ctx.restore();

    // Fill
    const fillW = Math.max((xpPercent / 100) * barW, xpPercent > 0 ? barH : 0);
    if (fillW > 0) {
      ctx.save();
      const xpGrad = ctx.createLinearGradient(barX, curY, barX + barW, curY);
      xpGrad.addColorStop(0,   "#ff85c2");
      xpGrad.addColorStop(0.4, "#c485ff");
      xpGrad.addColorStop(0.8, "#85c8ff");
      xpGrad.addColorStop(1,   "#85e8c0");
      ctx.fillStyle = xpGrad;
      ctx.shadowColor = "rgba(200, 100, 255, 0.5)";
      ctx.shadowBlur = 8;
      roundRect(ctx, barX, curY, fillW, barH, barH / 2, true, false);
      ctx.restore();

      // Shine on bar
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(ctx, barX + 2, curY + 2, Math.max(fillW - 4, 0), barH / 2 - 2, (barH / 2 - 2) / 2, true, false);
      ctx.restore();
    }

    // Segments (tick marks)
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    const segs = 10;
    for (let i = 1; i < segs; i++) {
      const sx = barX + (barW / segs) * i;
      ctx.beginPath();
      ctx.moveTo(sx, curY + 3);
      ctx.lineTo(sx, curY + barH - 3);
      ctx.stroke();
    }
    ctx.restore();

    curY += barH + 10;

    // Percent pill
    ctx.save();
    ctx.fillStyle = "rgba(180,140,220,0.18)";
    const pctText = `${Math.round(xpPercent)}%`;
    ctx.font = getFont("bold", 10);
    const pctW = ctx.measureText(pctText).width + 16;
    roundRect(ctx, barX, curY, pctW, 18, 9, true, false);
    ctx.fillStyle = LAVENDER;
    ctx.fillText(pctText, barX + 8, curY + 13);
    ctx.restore();

    // =========================
    // 7. RIGHT DECORATION — cute character panel
    // =========================
    const panelX = cX + cW - 210;
    const panelY = cY + 20;
    const panelW = 185;
    const panelH = cH - 40;

    // Panel bg
    ctx.save();
    const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    panelGrad.addColorStop(0, "rgba(255,213,240,0.55)");
    panelGrad.addColorStop(1, "rgba(213,235,255,0.55)");
    ctx.fillStyle = panelGrad;
    roundRect(ctx, panelX, panelY, panelW, panelH, 24, true, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, panelX, panelY, panelW, panelH, 24, false, true);
    ctx.restore();

    // Cute deco stars inside panel
    const panelSparkles = [
      { x: panelX + 20,       y: panelY + 30,       s: 6, c: PINK    },
      { x: panelX + panelW - 25, y: panelY + 50,    s: 5, c: SKY     },
      { x: panelX + 35,       y: panelY + panelH - 40, s: 7, c: MINT },
      { x: panelX + panelW - 30, y: panelY + panelH - 50, s: 5, c: YELLOW },
      { x: panelX + panelW / 2,  y: panelY + 20,    s: 4, c: LAVENDER},
    ];
    for (const sp of panelSparkles) drawStar(ctx, sp.x, sp.y, sp.s, sp.c, 0.75);

    // Big emoji / character in center panel
    ctx.font = getFont("bold", 68);
    ctx.textAlign = "center";
    ctx.fillText("🌸", panelX + panelW / 2, panelY + panelH / 2 + 10);
    ctx.textAlign = "left";

    // Small hearts / stars pattern
    const decoEmojis = ["✨", "💫", "🌟", "⭐", "💖"];
    ctx.font = getFont("bold", 18);
    ctx.textAlign = "center";
    const emojiPositions = [
      [panelX + 30,            panelY + panelH / 2 - 30],
      [panelX + panelW - 30,   panelY + panelH / 2 - 30],
      [panelX + panelW / 2,    panelY + 55],
      [panelX + panelW / 2,    panelY + panelH - 35],
    ];
    for (let i = 0; i < emojiPositions.length; i++) {
      ctx.fillText(decoEmojis[i % decoEmojis.length], emojiPositions[i][0], emojiPositions[i][1]);
    }
    ctx.textAlign = "left";

    // =========================
    // 8. BOTTOM RIBBON
    // =========================
    const ribY = cY + cH - 36;
    const ribGrad = ctx.createLinearGradient(cX, ribY, cX + cW, ribY);
    ribGrad.addColorStop(0,    "rgba(255,150,210,0.7)");
    ribGrad.addColorStop(0.25, "rgba(200,160,255,0.7)");
    ribGrad.addColorStop(0.5,  "rgba(150,200,255,0.7)");
    ribGrad.addColorStop(0.75, "rgba(150,240,210,0.7)");
    ribGrad.addColorStop(1,    "rgba(255,230,150,0.7)");
    ctx.fillStyle = ribGrad;
    // rounded bottom only
    ctx.beginPath();
    ctx.moveTo(cX, ribY);
    ctx.lineTo(cX + cW, ribY);
    ctx.lineTo(cX + cW, cY + cH - 32);
    ctx.quadraticCurveTo(cX + cW, cY + cH, cX + cW - 32, cY + cH);
    ctx.lineTo(cX + 32, cY + cH);
    ctx.quadraticCurveTo(cX, cY + cH, cX, cY + cH - 32);
    ctx.lineTo(cX, ribY);
    ctx.closePath();
    ctx.fill();

    // Ribbon text
    ctx.save();
    ctx.fillStyle = "rgba(60,20,60,0.5)";
    ctx.font = getFont("bold", 11);
    ctx.textAlign = "center";
    ctx.fillText("✦ ✦ ✦  K E E P  L E V E L I N G  U P !  ✦ ✦ ✦", cX + cW / 2, ribY + 23);
    ctx.textAlign = "left";
    ctx.restore();

    // Final corner sparkles on card
    drawStar(ctx, cX + 20,      cY + 20,      6, PINK,    0.7);
    drawStar(ctx, cX + cW - 20, cY + 20,      5, SKY,     0.7);
    drawStar(ctx, cX + 20,      cY + cH - 20, 5, YELLOW,  0.7);
    drawStar(ctx, cX + cW - 20, cY + cH - 20, 6, MINT,    0.7);

    // =========================
    // SEND
    // =========================
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
