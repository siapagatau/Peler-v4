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

// ── THEME CONFIGURATIONS ─────────────────────────────────────
function getThemeConfig(theme, accent) {
  const defaultAccent = "#ff6eb4";
  const userAccent = /^#[0-9A-F]{3,6}$/i.test(accent) ? accent : defaultAccent;

  switch (theme) {
    case "minimalis":
      return {
        showStars: false,
        bgGradient: ["#f5f5f5", "#e0e0e0", "#cfcfcf"],
        cardBg: "rgba(255,255,255,0.96)",
        cardBorder: "#cccccc",
        cardBorderWidth: 1,
        textPrimary: "#2c2c2c",
        textSecondary: "#6c6c6c",
        accent: "#3b82f6", // biru netral
        rankColors: {
          OWNER:   {bg:"#d32f2f", txt:"#fff"}, ADMIN:   {bg:"#f57c00", txt:"#fff"},
          VIP:     {bg:"#7c4dff", txt:"#fff"}, PREMIUM:{bg:"#e91e63",txt:"#fff"},
          GOLD:    {bg:"#ffc107", txt:"#3c2e00"}, MEMBER:{bg:"#616161",txt:"#fff"},
        },
        statCardStyle: (x, y, w, h) => ({
          bgGradient: ["#fafafa", "#eeeeee"],
          shadow: "rgba(0,0,0,0.08)",
          border: "#dddddd",
          labelColor: "#555",
          valueColor: "#222",
        }),
        expBarTrack: "#e0e0e0",
        expBarFill: ["#3b82f6", "#1e40af"],
        ribbon: {
          enabled: true,
          bg: "rgba(220,220,220,0.8)",
          text: "#444",
          textPattern: "* * *  K E E P  L E V E L I N G  U P !  * * *",
        },
        avatarGlow: false,
        avatarBorder: "#cccccc",
      };
    case "whatsapp":
      return {
        showStars: true,
        bgGradient: ["#dcf8c5", "#e2f0d9", "#c8e6c9"],
        cardBg: "rgba(255,255,255,0.94)",
        cardBorder: "#25D366",
        cardBorderWidth: 2.5,
        textPrimary: "#075e54",
        textSecondary: "#128c7e",
        accent: "#25D366",
        rankColors: {
          OWNER:   {bg:"#075e54", txt:"#fff"}, ADMIN:   {bg:"#128c7e", txt:"#fff"},
          VIP:     {bg:"#25D366", txt:"#075e54"}, PREMIUM:{bg:"#34b7f1",txt:"#fff"},
          GOLD:    {bg:"#ffc107", txt:"#075e54"}, MEMBER:{bg:"#9b9b9b",txt:"#fff"},
        },
        statCardStyle: (x, y, w, h) => ({
          bgGradient: ["#e5f5e0", "#d4edc9"],
          shadow: "rgba(37,211,102,0.25)",
          border: "#25D366",
          labelColor: "#075e54",
          valueColor: "#1b5e3f",
        }),
        expBarTrack: "#cce5cc",
        expBarFill: ["#25D366", "#128c7e"],
        ribbon: {
          enabled: true,
          bg: "linear-gradient(90deg, rgba(37,211,102,0.7), rgba(18,140,126,0.7))",
          text: "#fff",
          textPattern: "* * *  K E E P  C H A T T I N G !  * * *",
        },
        avatarGlow: true,
        avatarBorder: "#25D366",
      };
    case "profesional":
      return {
        showStars: false,
        bgGradient: ["#eef2f5", "#d9e2ec", "#cbd4dc"],
        cardBg: "rgba(255,255,255,0.98)",
        cardBorder: "#2c7da0",
        cardBorderWidth: 1.5,
        textPrimary: "#1e2a3a",
        textSecondary: "#5a6c7e",
        accent: "#2c7da0",
        rankColors: {
          OWNER:   {bg:"#c44536", txt:"#fff"}, ADMIN:   {bg:"#e68a2e", txt:"#fff"},
          VIP:     {bg:"#3b5e7b", txt:"#fff"}, PREMIUM:{bg:"#5a6c7e",txt:"#fff"},
          GOLD:    {bg:"#d4af37", txt:"#2c2c2c"}, MEMBER:{bg:"#8ea0b0",txt:"#fff"},
        },
        statCardStyle: (x, y, w, h) => ({
          bgGradient: ["#f8fafc", "#eef2f5"],
          shadow: "rgba(44,125,160,0.12)",
          border: "#cbd5e1",
          labelColor: "#2c7da0",
          valueColor: "#1e2a3a",
        }),
        expBarTrack: "#e2e8f0",
        expBarFill: ["#2c7da0", "#1e4a76"],
        ribbon: {
          enabled: true,
          bg: "rgba(44,125,160,0.75)",
          text: "#ffffff",
          textPattern: "•  P R O F E S S I O N A L   P R O F I L E  •",
        },
        avatarGlow: false,
        avatarBorder: "#2c7da0",
      };
    default: // vibrant / original
      return {
        showStars: true,
        bgGradient: ["#ffdaf0", "#e0eaff", "#d4f5e9"],
        cardBg: "rgba(255,255,255,0.88)",
        cardBorder: "rainbow",
        cardBorderWidth: 2.5,
        textPrimary: "#3a2050",
        textSecondary: "#6a4a8a",
        accent: userAccent,
        rankColors: {
          OWNER:   {bg:"#ff5e5e", txt:"#fff"}, ADMIN:   {bg:"#ff9f43", txt:"#fff"},
          VIP:     {bg:"#a29bfe", txt:"#fff"}, PREMIUM:{bg:"#fd79a8",txt:"#fff"},
          GOLD:    {bg:"#ffd32a", txt:"#4a3000"}, MEMBER:{bg:"#74b9ff",txt:"#fff"},
        },
        statCardStyle: (x, y, w, h) => ({
          bgGradient: ["#ff85c2", "#ffa8d8"], // akan di-override per stat
          shadow: "rgba(255,100,180,0.35)",
          border: "rgba(255,255,255,0.7)",
          labelColor: "rgba(255,255,255,0.92)",
          valueColor: "#fff",
        }),
        expBarTrack: "rgba(200,180,230,0.38)",
        expBarFill: ["#ff85c2", "#c485ff", "#85c8ff", "#7de8c0"],
        ribbon: {
          enabled: true,
          bg: "linear-gradient(90deg, rgba(255,150,210,0.65), rgba(200,160,255,0.65), rgba(150,200,255,0.65), rgba(150,240,210,0.65), rgba(255,230,150,0.65))",
          text: "rgba(60,20,60,0.75)",
          textPattern: "* * *  K E E P  L E V E L I N G  U P !  * * *",
        },
        avatarGlow: true,
        avatarBorder: "#fff",
      };
  }
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
      theme  = "vibrant",   // tambahan parameter
    } = req.query;

    const money    = parseInt(uang)  || 0;
    const lim      = parseInt(limit) || 0;
    const curXp    = Math.min(parseInt(xp)||0, parseInt(maxXp)||100);
    const maxXpVal = parseInt(maxXp) || 100;
    const xpPct    = Math.max(0, Math.min(100, (curXp / maxXpVal) * 100));

    // Ambil konfigurasi tema
    const cfg = getThemeConfig(theme, accent);

    const W_C = 820, H_C = 400;
    const canvas = createCanvas(W_C, H_C);
    const ctx    = canvas.getContext("2d");

    // ── BACKGROUND (utama) ─────────────────────────────────────
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
      g.addColorStop(0,   cfg.bgGradient[0]);
      g.addColorStop(0.5, cfg.bgGradient[1]);
      g.addColorStop(1,   cfg.bgGradient[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W_C, H_C);
    }

    // Blobs (hanya untuk tema vibrant, sisanya dihilangkan)
    if (theme === "vibrant" || theme === "whatsapp") {
      const blobColors = theme === "vibrant" 
        ? [["rgba(255,175,215,0.3)"], ["rgba(175,205,255,0.3)"], ["rgba(175,240,210,0.28)"], ["rgba(255,210,175,0.28)"]]
        : [["rgba(37,211,102,0.15)"], ["rgba(18,140,126,0.15)"], ["rgba(37,211,102,0.1)"], ["rgba(18,140,126,0.1)"]];
      [[0,0,130,blobColors[0]],[W_C,0,110,blobColors[1]],
       [W_C,H_C,140,blobColors[2]],[0,H_C,105,blobColors[3]]
      ].forEach(([bx,by,br,bc]) => {
        ctx.save();
        const rg = ctx.createRadialGradient(bx,by,0,bx,by,br);
        rg.addColorStop(0, bc); rg.addColorStop(1,"rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });
    }

    // ── CARD ────────────────────────────────────────────────────
    const cX=22, cY=18, cW=W_C-44, cH=H_C-36;

    ctx.save();
    ctx.shadowColor="rgba(0,0,0,0.08)"; ctx.shadowBlur=20; ctx.shadowOffsetY=4;
    ctx.fillStyle = cfg.cardBg;
    rr(ctx, cX, cY, cW, cH, 30, true, false);
    ctx.restore();

    // Border card
    ctx.save();
    if (cfg.cardBorder === "rainbow" && theme === "vibrant") {
      const bg2 = ctx.createLinearGradient(cX,cY,cX+cW,cY+cH);
      bg2.addColorStop(0,"#ff85c2"); bg2.addColorStop(0.33,"#85c8ff");
      bg2.addColorStop(0.66,"#7de8c0"); bg2.addColorStop(1,"#ffd96e");
      ctx.strokeStyle=bg2;
    } else {
      ctx.strokeStyle = cfg.cardBorder;
    }
    ctx.lineWidth = cfg.cardBorderWidth;
    ctx.globalAlpha = 0.7;
    rr(ctx, cX, cY, cW, cH, 30, false, true);
    ctx.restore();

    // ── AVATAR ──────────────────────────────────────────────
    const AV_CX = cX + 110;
    const AV_CY = cY + cH / 2;
    const AV_R  = 82;

    // Glow avatar
    if (cfg.avatarGlow) {
      ctx.save();
      const rg2 = ctx.createLinearGradient(AV_CX-AV_R, AV_CY-AV_R, AV_CX+AV_R, AV_CY+AV_R);
      rg2.addColorStop(0, cfg.accent); rg2.addColorStop(0.5, cfg.accent+"aa"); rg2.addColorStop(1, cfg.accent+"80");
      ctx.strokeStyle=rg2; ctx.lineWidth=6;
      ctx.shadowColor=cfg.accent+"99"; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+7, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = cfg.avatarBorder; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R+2, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    let avImg;
    try   { avImg = await loadImage(avatar); }
    catch { avImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png"); }
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(avImg, AV_CX-AV_R, AV_CY-AV_R, AV_R*2, AV_R*2);
    ctx.restore();

    // Stars around avatar (jika showStars aktif)
    if (cfg.showStars) {
      star(ctx, AV_CX - AV_R - 16, AV_CY - 28,      6, cfg.accent+"cc", 0.9);
      star(ctx, AV_CX + AV_R + 14, AV_CY - 38,      5, "#ffb3d9", 0.9);
      star(ctx, AV_CX + AV_R + 10, AV_CY + 34,      6, "#7de8c0", 0.85);
      star(ctx, AV_CX - AV_R - 12, AV_CY + 36,      5, "#85c8ff", 0.85);
      star(ctx, AV_CX,             AV_CY - AV_R - 20, 5, "#c485ff", 0.8);
    }

    // Level badge
    const lvTxt = `Lv. ${level}`;
    ctx.font = F(14);
    const lvW = ctx.measureText(lvTxt).width + 30;
    const lvX = AV_CX - lvW/2, lvY = AV_CY + AV_R + 12;
    ctx.save();
    ctx.shadowColor = cfg.accent+"80"; ctx.shadowBlur=8;
    ctx.fillStyle = cfg.accent;
    rr(ctx, lvX, lvY, lvW, 28, 14, true, false);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = "#ffffffc0"; ctx.lineWidth=1.5;
    rr(ctx, lvX, lvY, lvW, 28, 14, false, true); ctx.restore();
    ctx.fillStyle = "#ffffff"; ctx.font=F(14);
    ctx.textAlign="center"; ctx.fillText(lvTxt, AV_CX, lvY+19); ctx.textAlign="left";

    // ── RIGHT CONTENT ───────────────────────────────────────
    const RX = cX + 230;
    const RW = cW - 230 - 16;
    const TOTAL_H = 50 + 14 + 90 + 18 + 18 + 22 + 8 + 20;
    const cardMidY = cY + cH / 2;
    let ry = cardMidY - TOTAL_H / 2 - 8;

    // Name
    const nameText = name.length > 16 ? name.slice(0,14)+"..." : name;
    ctx.font = F(42);
    ctx.fillStyle = cfg.textPrimary;
    ctx.save(); ctx.shadowColor="rgba(0,0,0,0.05)"; ctx.shadowBlur=4;
    ctx.fillText(nameText, RX, ry + 42);
    ctx.restore();
    ry += 50 + 14;

    // Rank pill
    const rkLabel = rank.toUpperCase();
    ctx.font = F(13);
    const rkW = ctx.measureText(rkLabel).width + 28;
    const rankColor = cfg.rankColors[rkLabel] || {bg: cfg.accent, txt: "#fff"};
    const rkX = cX + cW - rkW - 20, rkY = cY + 20;
    ctx.save();
    ctx.shadowColor=rankColor.bg+"77"; ctx.shadowBlur=8;
    ctx.fillStyle=rankColor.bg; rr(ctx,rkX,rkY,rkW,30,15,true,false);
    ctx.restore();
    ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.5)"; ctx.lineWidth=1.5;
    rr(ctx,rkX,rkY,rkW,30,15,false,true); ctx.restore();
    if (cfg.showStars) {
      ctx.save(); ctx.fillStyle="rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.ellipse(rkX+rkW/2, rkY+8, rkW*0.38, 5, 0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle=rankColor.txt; ctx.font=F(13);
    ctx.textAlign="center"; ctx.fillText(rkLabel, rkX+rkW/2, rkY+20); ctx.textAlign="left";

    // Stat cards
    const ST_Y = ry;
    const ST_H = 90;
    const ST_GAP = 12;
    const ST_W = Math.floor((RW - ST_GAP * 2) / 3);
    const stats = [
      { label:"COINS", value:fmt(money), g: cfg.statCardStyle?.customGradients?.[0] || [cfg.accent, cfg.accent+"cc"] },
      { label:"LIMIT", value:fmt(lim),   g: [cfg.accent, cfg.accent+"aa"] },
      { label:"LEVEL", value:String(level), g: [cfg.accent+"dd", cfg.accent] }
    ];
    // Untuk tema vibrant, kita pakai gradient cantik
    if (theme === "vibrant") {
      stats[0].g = ["#ff85c2","#ffa8d8"];
      stats[1].g = ["#ffd085","#ffb87a"];
      stats[2].g = ["#a29bfe","#78b8ff"];
    }

    for (let i = 0; i < 3; i++) {
      const s  = stats[i];
      const sx = RX + i * (ST_W + ST_GAP);
      const sy = ST_Y;
      const cardStyle = cfg.statCardStyle(sx, sy, ST_W, ST_H);
      ctx.save();
      ctx.shadowColor=cardStyle.shadow; ctx.shadowBlur=12; ctx.shadowOffsetY=3;
      const sg = ctx.createLinearGradient(sx,sy,sx+ST_W,sy+ST_H);
      sg.addColorStop(0,s.g[0]); sg.addColorStop(1,s.g[1]);
      ctx.fillStyle=sg; rr(ctx,sx,sy,ST_W,ST_H,20,true,false);
      ctx.restore();
      if (cardStyle.border) {
        ctx.save(); ctx.strokeStyle=cardStyle.border; ctx.lineWidth=1.5;
        rr(ctx,sx,sy,ST_W,ST_H,20,false,true); ctx.restore();
      }
      if (cfg.showStars) {
        ctx.save(); ctx.fillStyle="rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.ellipse(sx+ST_W/2, sy+12, ST_W*0.4, 9, 0,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle=cardStyle.labelColor; ctx.font=F(14);
      ctx.fillText(s.label, sx+14, sy+27);
      ctx.fillStyle=cardStyle.valueColor; ctx.font=F(34);
      ctx.fillText(s.value, sx+14, sy+72);
    }

    // EXP Bar
    const EXP_Y = ST_Y + ST_H + 18;
    const BAR_H = 22;
    const BAR_W = RW;
    ctx.fillStyle = cfg.textSecondary; ctx.font=F(15);
    ctx.fillText("EXP", RX, EXP_Y + 15);
    ctx.fillStyle = cfg.textSecondary; ctx.font=F(13);
    ctx.textAlign="right";
    ctx.fillText(`${fmt(curXp)} / ${fmt(maxXpVal)}`, RX + BAR_W, EXP_Y + 15);
    ctx.textAlign="left";
    const BAR_Y = EXP_Y + 20;
    ctx.save(); ctx.fillStyle = cfg.expBarTrack;
    rr(ctx, RX, BAR_Y, BAR_W, BAR_H, BAR_H/2, true, false); ctx.restore();

    const fillW = Math.max((xpPct/100)*BAR_W, xpPct>0 ? BAR_H : 0);
    if (fillW > 0) {
      ctx.save();
      const fillGrad = ctx.createLinearGradient(RX, BAR_Y, RX+BAR_W, BAR_Y);
      if (Array.isArray(cfg.expBarFill)) {
        cfg.expBarFill.forEach((c, idx) => fillGrad.addColorStop(idx/(cfg.expBarFill.length-1), c));
      } else {
        fillGrad.addColorStop(0, cfg.expBarFill);
      }
      ctx.fillStyle=fillGrad; ctx.shadowColor=cfg.accent+"80"; ctx.shadowBlur=6;
      rr(ctx, RX, BAR_Y, fillW, BAR_H, BAR_H/2, true, false);
      ctx.restore();
      if (cfg.showStars) {
        ctx.save(); ctx.fillStyle="rgba(255,255,255,0.3)";
        rr(ctx, RX+2, BAR_Y+3, Math.max(fillW-4,0), BAR_H/2-3, (BAR_H/2-3)/2, true, false);
        ctx.restore();
      }
    }

    if (cfg.showStars) {
      ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.45)"; ctx.lineWidth=1.5;
      for (let i=1;i<10;i++) {
        const sx=RX+(BAR_W/10)*i;
        ctx.beginPath(); ctx.moveTo(sx,BAR_Y+4); ctx.lineTo(sx,BAR_Y+BAR_H-4); ctx.stroke();
      }
      ctx.restore();
    }

    const pctTxt = `${Math.round(xpPct)}%`;
    ctx.font = F(11);
    const ptW = ctx.measureText(pctTxt).width + 18;
    const ptX = RX + BAR_W - ptW;
    const ptY = BAR_Y + BAR_H + 8;
    ctx.save();
    ctx.fillStyle = cfg.textSecondary+"40"; rr(ctx,ptX,ptY,ptW,20,10,true,false);
    ctx.fillStyle = cfg.textSecondary; ctx.fillText(pctTxt, ptX+9, ptY+14); ctx.restore();

    // ── BOTTOM RIBBON ──────────────────────────────────────
    if (cfg.ribbon.enabled) {
      const RIB_H = 36;
      const RIB_Y = cY + cH - RIB_H;
      let ribFill;
      if (cfg.ribbon.bg.includes("linear-gradient")) {
        // parsing sederhana, kita buat gradient manual
        const ribG = ctx.createLinearGradient(cX, RIB_Y, cX+cW, RIB_Y);
        if (theme === "whatsapp") {
          ribG.addColorStop(0, "rgba(37,211,102,0.8)"); ribG.addColorStop(1, "rgba(18,140,126,0.8)");
        } else if (theme === "vibrant") {
          ribG.addColorStop(0, "rgba(255,150,210,0.65)"); ribG.addColorStop(0.25,"rgba(200,160,255,0.65)");
          ribG.addColorStop(0.5, "rgba(150,200,255,0.65)"); ribG.addColorStop(0.75,"rgba(150,240,210,0.65)");
          ribG.addColorStop(1, "rgba(255,230,150,0.65)");
        } else {
          ribG.addColorStop(0, cfg.ribbon.bg); ribG.addColorStop(1, cfg.ribbon.bg);
        }
        ribFill = ribG;
      } else {
        ribFill = cfg.ribbon.bg;
      }
      ctx.fillStyle = ribFill;
      ctx.beginPath();
      ctx.moveTo(cX, RIB_Y);
      ctx.lineTo(cX+cW, RIB_Y);
      ctx.lineTo(cX+cW, cY+cH-28); ctx.quadraticCurveTo(cX+cW, cY+cH, cX+cW-28, cY+cH);
      ctx.lineTo(cX+28, cY+cH);    ctx.quadraticCurveTo(cX, cY+cH, cX, cY+cH-28);
      ctx.lineTo(cX, RIB_Y); ctx.closePath(); ctx.fill();

      if (cfg.showStars) {
        for (let i=0;i<9;i++) star(ctx, cX+45+i*(cW-90)/8, RIB_Y+RIB_H/2, 3, "#ffffff", 0.5);
      }
      ctx.fillStyle = cfg.ribbon.text; ctx.font=F(13);
      ctx.textAlign="center";
      ctx.fillText(cfg.ribbon.textPattern, cX+cW/2, RIB_Y+23);
      ctx.textAlign="left";
    }

    // Corner stars (hanya jika showStars)
    if (cfg.showStars) {
      star(ctx, cX+16,      cY+16,      5, "#ff85c2", 0.6);
      star(ctx, cX+cW-16,   cY+16,      4, "#85c8ff", 0.6);
      star(ctx, cX+16,      cY+cH-16,   4, "#ffd96e", 0.6);
      star(ctx, cX+cW-16,   cY+cH-16,   5, "#7de8c0", 0.6);
    }

    res.setHeader("Content-Type","image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};