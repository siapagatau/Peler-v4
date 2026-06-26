const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ──────────────────────────────────────────────────────────────────
let hasEmoji = false;
try {
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")), "Inter");
  GlobalFonts.register(fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Bold.ttf")),    "InterBold");
  try {
    GlobalFonts.register(
      fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")),
      "NotoColorEmoji"
    );
    hasEmoji = true;
  } catch (_) {}
} catch (e) { console.log("FONT ERROR:", e.message); }

const FN  = (sz) => `normal ${sz}px ${hasEmoji ? "'Inter','NotoColorEmoji'" : "Inter,sans-serif"}`;
const FB  = (sz) => `bold ${sz}px ${hasEmoji ? "'InterBold','NotoColorEmoji'" : "InterBold,sans-serif"}`;
const FI  = (sz) => `italic normal ${sz}px ${hasEmoji ? "'Inter','NotoColorEmoji'" : "Inter,sans-serif"}`;

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
      // Kata terlalu panjang? Pecah per karakter
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

// Cheap blur via scale-down + scale-up
function drawBlur(ctx, img, x, y, w, h) {
  const factor = 20;
  const sw = Math.max(4, Math.round(w / factor));
  const sh = Math.max(4, Math.round(h / factor));
  const tmp = createCanvas(sw, sh);
  drawCover(tmp.getContext("2d"), img, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
}

async function drawAvatar(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) {
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    // Elegant fallback: gradient silhouette
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, "#2e2e3a"); g.addColorStop(1, "#1a1a24");
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.48, r * 0.30, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── ICONS (hairline, refined) ──────────────────────────────────────────────
function icoHeart(ctx, cx, cy, s, filled, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.14; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const top = cy - s * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.6);
  ctx.bezierCurveTo(cx - s, cy - s * 0.1, cx - s * 0.5, top - s * 0.5, cx, top + s * 0.08);
  ctx.bezierCurveTo(cx + s * 0.5, top - s * 0.5, cx + s, cy - s * 0.1, cx, cy + s * 0.6);
  ctx.closePath();
  filled ? ctx.fill() : ctx.stroke();
  ctx.restore();
}

function icoComment(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.13; ctx.lineJoin = "round"; ctx.lineCap = "round";
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
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.14;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const w = s * 1.4, h = s * 1.0;
  // top arrow
  ctx.beginPath();
  ctx.moveTo(cx - w/2 + s*0.3, cy - h*0.6);
  ctx.lineTo(cx + w/2, cy - h*0.6);
  ctx.lineTo(cx + w/2, cy + h*0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w/2 - s*0.4, cy - h*0.6 - s*0.35);
  ctx.lineTo(cx + w/2, cy - h*0.6);
  ctx.lineTo(cx + w/2 - s*0.4, cy - h*0.6 + s*0.35);
  ctx.stroke();
  // bottom arrow
  ctx.beginPath();
  ctx.moveTo(cx + w/2 - s*0.3, cy + h*0.6);
  ctx.lineTo(cx - w/2, cy + h*0.6);
  ctx.lineTo(cx - w/2, cy - h*0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w/2 + s*0.4, cy + h*0.6 - s*0.35);
  ctx.lineTo(cx - w/2, cy + h*0.6);
  ctx.lineTo(cx - w/2 + s*0.4, cy + h*0.6 + s*0.35);
  ctx.stroke();
  ctx.restore();
}

function icoShare(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.13; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // arrow up
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.9);
  ctx.lineTo(cx, cy + s * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.38);
  ctx.lineTo(cx, cy - s * 0.9);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.38);
  ctx.stroke();
  // base tray
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.78, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.78, cy + s * 0.9);
  ctx.lineTo(cx + s * 0.78, cy + s * 0.9);
  ctx.lineTo(cx + s * 0.78, cy + s * 0.1);
  ctx.stroke();
  ctx.restore();
}

function icoReport(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = s * 0.14; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.88, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.42); ctx.lineTo(cx, cy + s * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.44, s * 0.10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const ICON_FNS = { like: icoHeart, comment: icoComment, repost: icoRepost, share: icoShare, report: icoReport };
const ICON_LABELS = { like: "Suka", comment: "Komentar", repost: "Teruskan", share: "Bagikan", report: "Laporkan" };

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      avatar      = "",
      accentColor = "#818cf8",   // indigo-400 — ring avatar
      media       = "",
      background  = "",
      username    = "",
      handle      = "",
      timeAgo     = "baru saja",
      liked       = "false",
      menu        = "like,comment,repost,share,report",
      likes       = "", comments = "", reposts = "", shares = "",
      progress    = "2",         // story segment aktif (0-based)
      segments    = "5",         // total segmen progress bar
      caption     = "",          // teks caption di tengah bawah card
    } = req.query || {};

    if (!/^#[0-9A-F]{3,8}$/i.test(accentColor)) accentColor = "#818cf8";
    const isLiked = String(liked).toLowerCase() === "true";
    const menuKeys = String(menu).split(",").map(s => s.trim().toLowerCase()).filter(k => ICON_FNS[k]);
    const counts = { like: likes, comment: comments, repost: reposts, share: shares };
    const activeSegment  = Math.max(0, parseInt(progress)  || 2);
    const totalSegments  = Math.max(1, parseInt(segments)  || 5);

    // ── Canvas ─────────────────────────────────────────────────────────────
    const W     = 420;
    const SCALE = 2;
    // Layout heights (logical)
    const CARD_H      = 560;    // story card (tall portrait)
    const BELOW_GAP   = 18;
    const MENU_ROW_H  = 52;
    const MENU_PAD_Y  = 14;
    const MENU_H      = menuKeys.length ? MENU_PAD_Y * 2 + menuKeys.length * MENU_ROW_H : 0;
    const CANVAS_PAD  = 24;
    const H = CANVAS_PAD + CARD_H + BELOW_GAP + MENU_H + CANVAS_PAD;

    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx    = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    // ── 1. Canvas background — deep dark void ──────────────────────────────
    const bgImg = await loadSafe(background);
    if (bgImg) {
      drawBlur(ctx, bgImg, 0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, 0, W, H);
    } else {
      // Subtle radial: not pure black, not gradient cliché
      ctx.fillStyle = "#0d0d12";
      ctx.fillRect(0, 0, W, H);
      // Faint ambient glow from accent
      const glow = ctx.createRadialGradient(W * 0.5, CANVAS_PAD + CARD_H * 0.5, 0, W * 0.5, CANVAS_PAD + CARD_H * 0.5, W * 0.8);
      glow.addColorStop(0, accentColor + "12");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Story card ──────────────────────────────────────────────────────
    const CARD_X = CANVAS_PAD;
    const CARD_Y = CANVAS_PAD;
    const CARD_W = W - CANVAS_PAD * 2;
    const CARD_R = 22;

    // Drop shadow under card
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur  = 48;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = "#000";
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
    ctx.fill();
    ctx.restore();

    // Clip to card for all media
    ctx.save();
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
    ctx.clip();

    // Media fill
    const mediaImg = await loadSafe(media);
    if (mediaImg) {
      drawCover(ctx, mediaImg, CARD_X, CARD_Y, CARD_W, CARD_H);
    } else {
      // Placeholder: dark gradient with faint noise texture
      const ph = ctx.createLinearGradient(CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H);
      ph.addColorStop(0, "#1a1a2e");
      ph.addColorStop(0.5, "#16213e");
      ph.addColorStop(1, "#0f3460");
      ctx.fillStyle = ph;
      ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
      // Subtle center glow
      const cg = ctx.createRadialGradient(
        CARD_X + CARD_W / 2, CARD_Y + CARD_H * 0.45, 0,
        CARD_X + CARD_W / 2, CARD_Y + CARD_H * 0.45, CARD_W * 0.55
      );
      cg.addColorStop(0, accentColor + "28");
      cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);
    }

    // Vignette: top fade (untuk progress bar readability)
    const vigTop = ctx.createLinearGradient(0, CARD_Y, 0, CARD_Y + CARD_H * 0.28);
    vigTop.addColorStop(0, "rgba(0,0,0,0.72)");
    vigTop.addColorStop(1, "transparent");
    ctx.fillStyle = vigTop;
    ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H * 0.28);

    // Vignette: bottom fade (untuk overlay teks)
    const vigBot = ctx.createLinearGradient(0, CARD_Y + CARD_H * 0.52, 0, CARD_Y + CARD_H);
    vigBot.addColorStop(0, "transparent");
    vigBot.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = vigBot;
    ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);

    ctx.restore(); // end card clip

    // Thin card border — glass edge
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth   = 1;
    rr(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
    ctx.stroke();
    ctx.restore();

    // ── 3. Progress bars (top of card) ─────────────────────────────────────
    const PB_TOP    = CARD_Y + 16;
    const PB_H      = 3;
    const PB_GAP    = 5;
    const PB_SIDE   = CARD_X + 14;
    const PB_TOTAL_W = CARD_W - 28;
    const segW = (PB_TOTAL_W - PB_GAP * (totalSegments - 1)) / totalSegments;

    for (let i = 0; i < totalSegments; i++) {
      const sx = PB_SIDE + i * (segW + PB_GAP);
      ctx.save();
      // Track
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      rr(ctx, sx, PB_TOP, segW, PB_H, PB_H / 2);
      ctx.fill();
      // Fill
      if (i < activeSegment) {
        // fully completed
        ctx.fillStyle = "#ffffff";
        rr(ctx, sx, PB_TOP, segW, PB_H, PB_H / 2);
        ctx.fill();
      } else if (i === activeSegment) {
        // aktif: ~55% terisi
        ctx.fillStyle = "#ffffff";
        rr(ctx, sx, PB_TOP, segW * 0.55, PB_H, PB_H / 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── 4. Avatar + username overlay (bottom of card) ──────────────────────
    const AV_R  = 24;
    const AV_CX = CARD_X + 20 + AV_R;
    const AV_CY = CARD_Y + CARD_H - 52;
    const avatarImg = await loadSafe(avatar);

    // Avatar ring — accent glow
    ctx.save();
    ctx.shadowColor = accentColor + "bb";
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    await drawAvatar(ctx, avatarImg, AV_CX, AV_CY, AV_R);

    // Username & handle
    if (username) {
      const maxDispLen = 22;
      const dn = username.length > maxDispLen ? username.slice(0, maxDispLen - 1) + "…" : username;
      const TX = AV_CX + AV_R + 13;
      const TY_name = AV_CY - 8;
      const TY_sub  = AV_CY + 11;

      ctx.font = FB(15);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(dn, TX, TY_name);

      if (handle || timeAgo) {
        const sub = [handle ? `@${handle}` : "", timeAgo].filter(Boolean).join("  ·  ");
        ctx.font = FN(12);
        ctx.fillStyle = "rgba(255,255,255,0.58)";
        ctx.fillText(sub, TX, TY_sub);
      }
    }

    // ── 4b. Caption overlay (center-bottom of card, above avatar row) ─────────
    if (caption && caption.trim()) {
      const CAP_FONT_SZ = 16;
      const CAP_LH      = 24;
      const CAP_PAD_X   = 20;
      const CAP_PAD_Y   = 12;
      const CAP_MAX_W   = CARD_W - 48;

      // Measure wrapped lines — max 4 baris supaya tidak nabrak progress bar
      ctx.font = FI(CAP_FONT_SZ);
      const capLines = wrapText(ctx, caption.trim(), CAP_MAX_W - CAP_PAD_X * 2).slice(0, 4);
      const capTextH = capLines.length * CAP_LH;
      const capBoxH  = capTextH + CAP_PAD_Y * 2;
      const capBoxW  = Math.min(
        CAP_MAX_W,
        Math.max(...capLines.map(l => ctx.measureText(l).width)) + CAP_PAD_X * 2
      );

      // Vertically: just above avatar row, with a gap
      const capBoxY = AV_CY - AV_R - 14 - capBoxH;
      // Horizontally: centered in card
      const capBoxX = CARD_X + (CARD_W - capBoxW) / 2;

      // Frosted pill background
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      rr(ctx, capBoxX, capBoxY, capBoxW, capBoxH, 12);
      ctx.fill();
      // Ultra-thin border for glass feel
      ctx.strokeStyle = "rgba(255,255,255,0.13)";
      ctx.lineWidth = 1;
      rr(ctx, capBoxX, capBoxY, capBoxW, capBoxH, 12);
      ctx.stroke();
      ctx.restore();

      // Caption text — italic, centered, white with slight glow for legibility
      ctx.save();
      ctx.font = FI(CAP_FONT_SZ);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur  = 6;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      for (let i = 0; i < capLines.length; i++) {
        ctx.fillText(capLines[i], capBoxX + capBoxW / 2, capBoxY + CAP_PAD_Y + i * CAP_LH);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    }

    // Mute icon (top-right in card)
    const MUTE_X = CARD_X + CARD_W - 48;
    const MUTE_Y = CARD_Y + 14;
    const MUTE_R = 18;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath(); ctx.arc(MUTE_X, MUTE_Y + MUTE_R, MUTE_R, 0, Math.PI * 2); ctx.fill();
    // Speaker icon (mute)
    ctx.strokeStyle = "rgba(255,255,255,0.80)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const mx = MUTE_X - 5, my = MUTE_Y + MUTE_R;
    ctx.beginPath();
    ctx.moveTo(mx - 5, my - 3); ctx.lineTo(mx, my - 3);
    ctx.lineTo(mx + 5, my - 7); ctx.lineTo(mx + 5, my + 7);
    ctx.lineTo(mx, my + 3); ctx.lineTo(mx - 5, my + 3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + 9, my - 4); ctx.lineTo(mx + 14, my + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + 14, my - 4); ctx.lineTo(mx + 9, my + 4); ctx.stroke();
    ctx.restore();

    // ── 5. Action menu — floating glass panel ──────────────────────────────
    if (menuKeys.length > 0) {
      const MENU_X = CARD_X;
      const MENU_W = CARD_W;
      const MENU_Y = CARD_Y + CARD_H + BELOW_GAP;
      const MENU_R = 18;
      const ICON_S = 11;
      const LABEL_SIZE = 14;
      const COUNT_SIZE = 13;
      const ICON_CX = MENU_X + 22 + ICON_S;

      // Glass panel
      ctx.save();
      ctx.fillStyle = "rgba(18,18,26,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur  = 28;
      ctx.shadowOffsetY = 8;
      rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, MENU_R);
      ctx.fill();
      ctx.restore();

      // Glass border
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      rr(ctx, MENU_X, MENU_Y, MENU_W, MENU_H, MENU_R);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < menuKeys.length; i++) {
        const key    = menuKeys[i];
        const isRep  = key === "report";
        const color  = isLiked && key === "like" ? "#f87171" : isRep ? "#f87171" : "#f5f5f7";
        const rowY   = MENU_Y + MENU_PAD_Y + i * MENU_ROW_H;
        const rowCY  = rowY + MENU_ROW_H / 2;

        // Divider (not first row)
        if (i > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.055)";
          ctx.fillRect(MENU_X + 16, rowY, MENU_W - 32, 1);
        }

        // Active like row: subtle tinted background
        if (key === "like" && isLiked) {
          ctx.save();
          ctx.fillStyle = "rgba(239,68,68,0.08)";
          if (i === 0) {
            rr(ctx, MENU_X + 1, rowY, MENU_W - 2, MENU_ROW_H, MENU_R);
          } else if (i === menuKeys.length - 1) {
            ctx.fillRect(MENU_X + 1, rowY, MENU_W - 2, MENU_ROW_H);
            // bottom corners rounded
          } else {
            ctx.fillRect(MENU_X + 1, rowY, MENU_W - 2, MENU_ROW_H);
          }
          ctx.fill();
          ctx.restore();
        }

        // Icon
        ICON_FNS[key](ctx, ICON_CX, rowCY, ICON_S, color, key === "like" && isLiked);

        // Label
        ctx.font = FN(LABEL_SIZE);
        ctx.fillStyle = color;
        ctx.textBaseline = "middle";
        const LABEL_X = ICON_CX + ICON_S * 2.1;
        ctx.fillText(ICON_LABELS[key], LABEL_X, rowCY);
        ctx.textBaseline = "alphabetic";

        // Count (right-aligned)
        const cnt = counts[key];
        if (cnt !== "" && cnt !== undefined && !isNaN(parseInt(cnt))) {
          const countStr = fmt(parseInt(cnt));
          ctx.font = FN(COUNT_SIZE);
          ctx.fillStyle = isRep ? "#f87171" : "rgba(255,255,255,0.38)";
          ctx.textBaseline = "middle";
          const cw = ctx.measureText(countStr).width;
          ctx.fillText(countStr, MENU_X + MENU_W - 22 - cw, rowCY);
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
