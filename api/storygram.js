const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS (sama persis dengan iqc) ──────────────────────────────────────
let hasEmojiFont = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-SemiBold.ttf")), "InterSemiBold");
  try {
    GlobalFonts.register(
      fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")),
      "NotoColorEmoji"
    );
    hasEmojiFont = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

// ── SATU-SATUNYA FUNGSI FONT (sama dengan iqc) ─────────────────────────
function chatFont(size, weight = 'normal') {
  const family = hasEmojiFont ? "'Inter', 'NotoColorEmoji'" : "Inter";
  return `${weight} ${size}px ${family}`;
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

async function loadSafe(url) {
  if (!url) return null;
  try { return await loadImage(url); } catch { return null; }
}

function wrapText(ctx, text, maxW) {
  const out = [];
  for (const hard of String(text).replace(/\\n/g, "\n").split("\n")) {
    const words = hard.split(" ");
    let cur = "";
    for (const word of words) {
      if (ctx.measureText(word).width > maxW) {
        if (cur) { out.push(cur); cur = ""; }
        let part = "";
        for (const ch of word) {
          const test = part + ch;
          if (ctx.measureText(test).width > maxW && part) {
            out.push(part); part = ch;
          } else { part = test; }
        }
        cur = part;
        continue;
      }
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) out.push(cur);
  }
  return out.filter(l => l.length > 0);
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, tr = w / h;
  let sx, sy, sw, sh;
  if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
  else         { sw = img.width;  sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawBlur(ctx, img, x, y, w, h, factor = 20) {
  const sw = Math.max(4, Math.round(w / factor));
  const sh = Math.max(4, Math.round(h / factor));
  const tmp = createCanvas(sw, sh);
  drawCover(tmp.getContext("2d"), img, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
}

function drawNoise(ctx, x, y, w, h, opacity = 0.035) {
  const n = createCanvas(96, 96);
  const nctx = n.getContext("2d");
  const imgData = nctx.createImageData(96, 96);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v; imgData.data[i + 3] = 255;
  }
  nctx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(n, 0, 0, 96, 96, x, y, w, h);
  ctx.restore();
}

async function drawAvatar(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) {
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, "#34354a"); g.addColorStop(1, "#1a1a24");
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.48, r * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── ICONS ──────────────────────────────────────────────────────────────────
function icoHeart(ctx, cx, cy, s, color, filled) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.15; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const top = cy - s * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.62);
  ctx.bezierCurveTo(cx - s, cy - s * 0.1, cx - s * 0.5, top - s * 0.5, cx, top + s * 0.08);
  ctx.bezierCurveTo(cx + s * 0.5, top - s * 0.5, cx + s, cy - s * 0.1, cx, cy + s * 0.62);
  ctx.closePath();
  filled ? ctx.fill() : ctx.stroke();
  ctx.restore();
}

function icoComment(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.14; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const w = s * 1.65, h = s * 1.3;
  const x = cx - w / 2, y = cy - h / 2 - s * 0.06;
  rr(ctx, x, y, w, h, s * 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, y + h);
  ctx.lineTo(cx - s * 0.6, y + h + s * 0.42);
  ctx.lineTo(cx + s * 0.08, y + h);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function icoRepost(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.15;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const w = s * 1.4, h = s * 1.0;
  ctx.beginPath();
  ctx.moveTo(cx - w/2 + s*0.3, cy - h*0.6); ctx.lineTo(cx + w/2, cy - h*0.6); ctx.lineTo(cx + w/2, cy + h*0.12); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w/2 - s*0.4, cy - h*0.6 - s*0.35); ctx.lineTo(cx + w/2, cy - h*0.6); ctx.lineTo(cx + w/2 - s*0.4, cy - h*0.6 + s*0.35); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w/2 - s*0.3, cy + h*0.6); ctx.lineTo(cx - w/2, cy + h*0.6); ctx.lineTo(cx - w/2, cy - h*0.12); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w/2 + s*0.4, cy + h*0.6 - s*0.35); ctx.lineTo(cx - w/2, cy + h*0.6); ctx.lineTo(cx - w/2 + s*0.4, cy + h*0.6 + s*0.35); ctx.stroke();
  ctx.restore();
}

function icoShare(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.14; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.9); ctx.lineTo(cx, cy + s * 0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.38); ctx.lineTo(cx, cy - s * 0.9); ctx.lineTo(cx + s * 0.5, cy - s * 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.78, cy + s * 0.1); ctx.lineTo(cx - s * 0.78, cy + s * 0.9); ctx.lineTo(cx + s * 0.78, cy + s * 0.9); ctx.lineTo(cx + s * 0.78, cy + s * 0.1); ctx.stroke();
  ctx.restore();
}

function icoReport(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.15; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.88, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.42); ctx.lineTo(cx, cy + s * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.44, s * 0.10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const ICON_FNS    = { like: icoHeart, comment: icoComment, repost: icoRepost, share: icoShare, report: icoReport };
const ICON_LABELS = { like: "Suka", comment: "Komentar", repost: "Teruskan", share: "Bagikan", report: "Laporkan" };

// ── COLOR HELPERS ─────────────────────────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  const num = parseInt(hex.slice(0, 6), 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const l = (c) => Math.min(255, Math.round(c + (255 - c) * amt));
  return `rgb(${l(r)},${l(g)},${l(b)})`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      avatar      = "",
      accentColor = "#818cf8",
      media       = "",
      background  = "",
      username    = "",
      handle      = "",
      timeAgo     = "baru saja",
      liked       = "false",
      menu        = "like,comment,repost,share,report",
      likes       = "", comments = "", reposts = "", shares = "",
      progress    = "2",
      segments    = "5",
      caption     = "",
    } = req.query || {};

    if (!/^#[0-9A-F]{3,8}$/i.test(accentColor)) accentColor = "#818cf8";
    const isLiked  = String(liked).toLowerCase() === "true";
    const menuKeys = String(menu).split(",").map(s => s.trim().toLowerCase()).filter(k => ICON_FNS[k]);
    const counts   = { like: likes, comment: comments, repost: reposts, share: shares };
    const activeSegment = Math.max(0, parseInt(progress) || 2);
    const totalSegments = Math.max(1, parseInt(segments) || 5);
    const accentLight = lighten(accentColor, 0.35);

    // ── Canvas ────────────────────────────────────────────────────────────
    const W     = 420;
    const SCALE = 2;
    const CARD_H      = 560;
    const BELOW_GAP   = 18;
    const MENU_ROW_H  = 54;
    const MENU_PAD_Y  = 12;
    const MENU_H      = menuKeys.length ? MENU_PAD_Y * 2 + menuKeys.length * MENU_ROW_H : 0;
    const CANVAS_PAD  = 24;
    const H = CANVAS_PAD + CARD_H + BELOW_GAP + MENU_H + CANVAS_PAD;

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx    = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // ── 1. Canvas background ──────────────────────────────────────────────
    const bgImg = await loadSafe(background);
    if (bgImg) {
      drawBlur(ctx, bgImg, 0, 0, W, H, 24);
      ctx.fillStyle = "rgba(6,6,10,0.66)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      const glow1 = ctx.createRadialGradient(W * 0.18, CARD_H * 0.15, 0, W * 0.18, CARD_H * 0.15, W * 1.1);
      glow1.addColorStop(0, rgba(accentColor, 0.16));
      glow1.addColorStop(1, "transparent");
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, W, H);
      const glow2 = ctx.createRadialGradient(W * 0.85, CARD_H * 0.9, 0, W * 0.85, CARD_H * 0.9, W * 0.95);
      glow2.addColorStop(0, "rgba(255,255,255,0.05)");
      glow2.addColorStop(1, "transparent");
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, W, H);
    }
    drawNoise(ctx, 0, 0, W, H, 0.025);

    // ── 2. Story card ─────────────────────────────────────────────────────
    const CARD_X = CANVAS_PAD;
    const CARD_Y = CANVAS_PAD;
    const CARD_W = W - CANVAS_PAD * 2;
    const CARD_R = 24;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
    ctx.fillStyle = "#000";
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#000";
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R); ctx.fill();
    ctx.restore();

    ctx.save();
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
    ctx.clip();

    const mediaImg = await loadSafe(media);
    if (mediaImg) {
      drawCover(ctx, mediaImg, CARD_X, CARD_Y, CARD_W, CARD_H);
    } else {
      const ph = ctx.createLinearGradient(CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H);
      ph.addColorStop(0, "#15151f"); ph.addColorStop(0.55, rgba(accentColor, 0.22)); ph.addColorStop(1, "#0c0c14");
      ctx.fillStyle = ph; ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
      const cg = ctx.createRadialGradient(CARD_X+CARD_W/2, CARD_Y+CARD_H*0.42, 0, CARD_X+CARD_W/2, CARD_Y+CARD_H*0.42, CARD_W*0.6);
      cg.addColorStop(0, rgba(accentColor, 0.30)); cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg; ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
      drawNoise(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 0.05);
    }

    const vigTop = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + CARD_H * 0.26);
    vigTop.addColorStop(0, "rgba(0,0,0,0.65)"); vigTop.addColorStop(1, "transparent");
    ctx.fillStyle = vigTop; ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H * 0.26);

    const vigBot = ctx.createLinearGradient(0, CARD_Y + CARD_H * 0.46, 0, CARD_Y + CARD_H);
    vigBot.addColorStop(0, "transparent"); vigBot.addColorStop(0.55, "rgba(0,0,0,0.40)"); vigBot.addColorStop(1, "rgba(0,0,0,0.86)");
    ctx.fillStyle = vigBot; ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
    rr(ctx, CARD_X+0.5, CARD_Y+0.5, CARD_W-1, CARD_H-1, CARD_R); ctx.stroke();
    ctx.restore();
    ctx.save();
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R); ctx.clip();
    const topHL = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + 90);
    topHL.addColorStop(0, "rgba(255,255,255,0.10)"); topHL.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = topHL; ctx.fillRect(CARD_X, CARD_Y, CARD_W, 90);
    ctx.restore();

    // ── 3. Progress bars ──────────────────────────────────────────────────
    const PB_TOP = CARD_Y + 16, PB_H = 3, PB_GAP = 5;
    const PB_SIDE = CARD_X + 14, PB_TOTAL_W = CARD_W - 28;
    const segW = (PB_TOTAL_W - PB_GAP * (totalSegments - 1)) / totalSegments;

    for (let i = 0; i < totalSegments; i++) {
      const sx = PB_SIDE + i * (segW + PB_GAP);
      ctx.fillStyle = "rgba(255,255,255,0.24)";
      rr(ctx, sx, PB_TOP, segW, PB_H, PB_H / 2); ctx.fill();
      if (i < activeSegment) {
        ctx.fillStyle = "#ffffff";
        rr(ctx, sx, PB_TOP, segW, PB_H, PB_H / 2); ctx.fill();
      } else if (i === activeSegment) {
        ctx.save(); ctx.shadowColor = "rgba(255,255,255,0.7)"; ctx.shadowBlur = 4;
        ctx.fillStyle = "#ffffff";
        rr(ctx, sx, PB_TOP, segW * 0.55, PB_H, PB_H / 2); ctx.fill();
        ctx.restore();
      }
    }

    // ── 4. Avatar + username overlay ──────────────────────────────────────
    const AV_R  = 24;
    const AV_CX = CARD_X + 20 + AV_R;
    const AV_CY = CARD_Y + CARD_H - 52;
    const avatarImg = await loadSafe(avatar);

    ctx.save();
    ctx.shadowColor = rgba(accentColor, 0.55); ctx.shadowBlur = 16;
    const ringGrad = ctx.createLinearGradient(AV_CX-AV_R, AV_CY-AV_R, AV_CX+AV_R, AV_CY+AV_R);
    ringGrad.addColorStop(0, accentLight); ringGrad.addColorStop(1, accentColor);
    ctx.strokeStyle = ringGrad; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(10,10,14,0.55)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    await drawAvatar(ctx, avatarImg, AV_CX, AV_CY, AV_R);

    if (username) {
      const maxDispLen = 22;
      const dn = username.length > maxDispLen ? username.slice(0, maxDispLen - 1) + "…" : username;
      const TX = AV_CX + AV_R + 14;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
      ctx.font = chatFont(15.5, 'bold');
      ctx.fillStyle = "#ffffff";
      ctx.fillText(dn, TX, AV_CY - 8);
      ctx.restore();
      if (handle || timeAgo) {
        const sub = [handle ? `@${handle}` : "", timeAgo].filter(Boolean).join("  ·  ");
        ctx.font = chatFont(12);
        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.fillText(sub, TX, AV_CY + 12);
      }
    }

    // ── 4b. Caption ───────────────────────────────────────────────────────
    if (caption && caption.trim()) {
      const CAP_FONT_SZ = 15;
      const CAP_LH      = 22.5;
      const CAP_MAX_W   = CARD_W - 56;
      const CAP_X       = CARD_X + 20;

      const rawCaption = caption.replace(/\\n/g, "\n").trim();
      if (rawCaption) {
        ctx.font = chatFont(CAP_FONT_SZ);
        const capLines = wrapText(ctx, rawCaption, CAP_MAX_W).slice(0, 4);
        const capTotalH = capLines.length * CAP_LH;
        const capBaseY  = AV_CY - AV_R - 15;
        const capStartY = capBaseY - capTotalH + CAP_LH;

        ctx.save();
        ctx.font = chatFont(CAP_FONT_SZ);
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle    = "rgba(255,255,255,0.96)";

        for (let i = 0; i < capLines.length; i++) {
          const ly = capStartY + i * CAP_LH;
          ctx.shadowColor = "rgba(0,0,0,0.80)";
          ctx.shadowBlur  = 14;
          ctx.shadowOffsetY = 1;
          ctx.fillText(capLines[i], CAP_X, ly);
          ctx.shadowBlur = 4;
          ctx.fillText(capLines[i], CAP_X, ly);
        }
        ctx.restore();
      }
    }

    // ── Mute icon ──────────────────────────────────────────────────────────
    const MUTE_R  = 17;
    const MUTE_CX = CARD_X + CARD_W - 14 - MUTE_R;
    const MUTE_CY = CARD_Y + 44 + MUTE_R;

    ctx.save();
    ctx.fillStyle = "rgba(20,20,28,0.42)";
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(MUTE_CX, MUTE_CY, MUTE_R, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const mx = MUTE_CX - 4.5, my = MUTE_CY;
    ctx.beginPath();
    ctx.moveTo(mx-5, my-3); ctx.lineTo(mx, my-3); ctx.lineTo(mx+5, my-7);
    ctx.lineTo(mx+5, my+7); ctx.lineTo(mx, my+3); ctx.lineTo(mx-5, my+3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx+9, my-4); ctx.lineTo(mx+14, my+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx+14, my-4); ctx.lineTo(mx+9, my+4); ctx.stroke();
    ctx.restore();

    // ── 5. Action menu ────────────────────────────────────────────────────
    if (menuKeys.length > 0) {
      const MENU_X = CARD_X, MENU_W = CARD_W;
      const MENU_Y = CARD_Y + CARD_H + BELOW_GAP;
      const MENU_R = 20, ICON_S = 11.5, LABEL_SIZE = 14.5, COUNT_SIZE = 13;
      const ICON_CX = MENU_X + 24 + ICON_S;

      ctx.save();
      ctx.fillStyle = "rgba(16,16,23,0.90)";
      ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 32; ctx.shadowOffsetY = 10;
      rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, MENU_R); ctx.fill();
      ctx.restore();

      ctx.save();
      rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, MENU_R); ctx.clip();
      const sheen = ctx.createLinearGradient(0, MENU_Y, 0, MENU_Y + 40);
      sheen.addColorStop(0, "rgba(255,255,255,0.06)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen; ctx.fillRect(MENU_X, MENU_Y, MENU_W, 40);
      const likeIdx = menuKeys.indexOf("like");
      if (likeIdx !== -1 && isLiked) {
        const rowY = MENU_Y + MENU_PAD_Y + likeIdx * MENU_ROW_H;
        ctx.fillStyle = "rgba(248,113,113,0.07)";
        ctx.fillRect(MENU_X, rowY, MENU_W, MENU_ROW_H);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
      rr(ctx, MENU_X+0.5, MENU_Y+0.5, MENU_W-1, MENU_H-1, MENU_R); ctx.stroke();
      ctx.restore();

      for (let i = 0; i < menuKeys.length; i++) {
        const key   = menuKeys[i];
        const isRep = key === "report";
        const color = isLiked && key === "like" ? "#fb7185" : isRep ? "#fb7185" : "#f5f5f7";
        const rowY  = MENU_Y + MENU_PAD_Y + i * MENU_ROW_H;
        const rowCY = rowY + MENU_ROW_H / 2;

        if (i > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(MENU_X + 20, rowY, MENU_W - 40, 1);
        }

        ICON_FNS[key](ctx, ICON_CX, rowCY, ICON_S, color, key === "like" && isLiked);

        ctx.font = chatFont(LABEL_SIZE, '600');
        ctx.fillStyle = color; ctx.textBaseline = "middle";
        ctx.fillText(ICON_LABELS[key], ICON_CX + ICON_S * 2.15, rowCY + 0.5);
        ctx.textBaseline = "alphabetic";

        const cnt = counts[key];
        if (cnt !== "" && cnt !== undefined && !isNaN(parseInt(cnt))) {
          const countStr = fmt(parseInt(cnt));
          ctx.font = chatFont(COUNT_SIZE);
          ctx.fillStyle = isRep ? "#fb7185" : "rgba(255,255,255,0.40)";
          ctx.textBaseline = "middle";
          const cw = ctx.measureText(countStr).width;
          ctx.fillText(countStr, MENU_X + MENU_W - 24 - cw, rowCY + 0.5);
          ctx.textBaseline = "alphabetic";
        }
      }
    }

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};