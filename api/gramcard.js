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

// Font khusus emoji (untuk ❤️)
const FE = (size) =>
  `${size}px ${hasEmojiFont ? "'NotoColorEmoji','InterBold'" : "InterBold"}`;

// ── SHARED HELPERS ────────────────────────────────────────────
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

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e12) return (n/1e12).toFixed(1).replace(/\.0$/,"")+"T";
  if (n >= 1e9)  return (n/1e9 ).toFixed(1).replace(/\.0$/,"")+"B";
  if (n >= 1e6)  return (n/1e6 ).toFixed(1).replace(/\.0$/,"")+"M";
  if (n >= 1e3)  return (n/1e3 ).toFixed(1).replace(/\.0$/,"")+"K";
  return String(n);
}

// hex (#rgb or #rrggbb) → "r,g,b" for building rgba() strings
function hexToRgbStr(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `${r},${g},${b}`;
}

async function drawRoundAvatar(ctx, avatarUrl, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  let drawn = false;
  if (avatarUrl) {
    try {
      const img  = await loadImage(avatarUrl);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
      drawn = true;
    } catch (_) {}
  }

  if (!drawn) {
    ctx.fillStyle = "#2a2a35";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#44444f";
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 0.52, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx, sy, sw, sh;
  if (ir > tr) {
    sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0;
  } else {
    sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function blurDraw(ctx, img, x, y, w, h, quality = 18) {
  const sw = Math.max(8, Math.round(w / quality));
  const sh = Math.max(8, Math.round(h / quality));
  const tmp  = createCanvas(sw, sh);
  const tctx = tmp.getContext("2d");
  drawCover(tctx, img, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
}

// ── VERIFIED BADGE (centang biru) ──────────────────────────────
function drawVerifiedBadge(ctx, cx, cy, r) {
  ctx.save();

  // Lingkaran biru
  ctx.fillStyle = "#1d9bf0";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Centang putih
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth   = r * 0.32;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy);
  ctx.lineTo(cx - r * 0.08, cy + r * 0.38);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.38);
  ctx.stroke();

  ctx.restore();
}

// ── ICONS (iOS-style: unified stroke weight, rounded caps/joins) ─
// Semua icon dibangun dalam bounding box yang sama relatif ke `s`
// supaya "visual weight" konsisten satu sama lain (ala SF Symbols).
const STROKE_RATIO = 0.135; // rasio lineWidth/`s` yang dipakai SEMUA icon

function setStroke(ctx, s, color) {
  ctx.lineWidth   = s * STROKE_RATIO;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";
  ctx.strokeStyle = color;
}

// ❤️ Like — heart vector, jadi nyatu dengan icon lain (bisa diwarnai)
function iconLike(ctx, cx, cy, s, color, active) {
  ctx.save();
  ctx.fillStyle = active ? "#ef4444" : "transparent";
  setStroke(ctx, s, active ? "#ef4444" : color);

  const w = s * 1.9, top = cy - s * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx, top + s * 0.32);
  ctx.bezierCurveTo(
    cx - w * 0.18, top - s * 0.28,
    cx - w * 0.52, top - s * 0.05,
    cx - w * 0.52, top + s * 0.42
  );
  ctx.bezierCurveTo(
    cx - w * 0.52, top + s * 0.82,
    cx - w * 0.18, top + s * 1.05,
    cx, top + s * 1.45
  );
  ctx.bezierCurveTo(
    cx + w * 0.18, top + s * 1.05,
    cx + w * 0.52, top + s * 0.82,
    cx + w * 0.52, top + s * 0.42
  );
  ctx.bezierCurveTo(
    cx + w * 0.52, top - s * 0.05,
    cx + w * 0.18, top - s * 0.28,
    cx, top + s * 0.32
  );
  ctx.closePath();
  if (active) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 💬 Comment — rounded speech bubble with tail
function iconComment(ctx, cx, cy, s, color) {
  ctx.save();
  setStroke(ctx, s, color);
  const w = s * 1.7, h = s * 1.25;
  const x = cx - w / 2, y = cy - h / 2 - s * 0.08;
  rr(ctx, x, y, w, h, s * 0.42, false, true);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, y + h);
  ctx.lineTo(cx - s * 0.68, y + h + s * 0.42);
  ctx.lineTo(cx - s * 0.1, y + h);
  ctx.stroke();
  ctx.restore();
}

// 🔁 Repost — two-arrow loop, same stroke weight as the rest
function iconRepost(ctx, cx, cy, s, color) {
  ctx.save();
  setStroke(ctx, s, color);
  const w = s * 1.5, h = s * 1.1;
  ctx.beginPath();
  ctx.moveTo(cx - w/2, cy + h*0.1);
  ctx.lineTo(cx - w/2, cy - h*0.35);
  ctx.lineTo(cx + w/2 - s*0.2, cy - h*0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w/2 - s*0.55, cy - h*0.75);
  ctx.lineTo(cx + w/2, cy - h*0.35);
  ctx.lineTo(cx + w/2 - s*0.55, cy + h*0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w/2, cy - h*0.1);
  ctx.lineTo(cx + w/2, cy + h*0.35);
  ctx.lineTo(cx - w/2 + s*0.2, cy + h*0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w/2 + s*0.55, cy + h*0.75);
  ctx.lineTo(cx - w/2, cy + h*0.35);
  ctx.lineTo(cx - w/2 + s*0.55, cy - h*0.05);
  ctx.stroke();
  ctx.restore();
}

// ↗️ Share — clean outward arrow (iOS "share" glyph style)
function iconShare(ctx, cx, cy, s, color) {
  ctx.save();
  setStroke(ctx, s, color);
  ctx.beginPath();
  ctx.moveTo(cx - s*0.8, cy - s*0.55);
  ctx.lineTo(cx + s*0.8, cy);
  ctx.lineTo(cx - s*0.8, cy + s*0.55);
  ctx.lineTo(cx - s*0.32, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// 🚩 Report — flag glyph (clearer affordance than a bare exclamation)
function iconReport(ctx, cx, cy, s, color) {
  ctx.save();
  setStroke(ctx, s, color);
  const poleX = cx - s * 0.55;
  const top = cy - s * 0.85, bottom = cy + s * 0.85;

  // pole
  ctx.beginPath();
  ctx.moveTo(poleX, top);
  ctx.lineTo(poleX, bottom);
  ctx.stroke();

  // flag flap
  ctx.beginPath();
  ctx.moveTo(poleX, top + s * 0.05);
  ctx.lineTo(poleX + s * 1.15, top + s * 0.4);
  ctx.lineTo(poleX, top + s * 0.75);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

const ICONS = {
  like:    (ctx, x, y, s, c, active) => iconLike(ctx, x, y, s, c, active),
  comment: (ctx, x, y, s, c) => iconComment(ctx, x, y, s, c),
  repost:  (ctx, x, y, s, c) => iconRepost(ctx, x, y, s, c),
  share:   (ctx, x, y, s, c) => iconShare(ctx, x, y, s, c),
  report:  (ctx, x, y, s, c) => iconReport(ctx, x, y, s, c),
};

const LABELS = { like: "Like", comment: "Comment", repost: "Repost", share: "Share", report: "Report" };

// ── HANDLER: storygram ───────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      avatar      = "",
      avatarColor = "#22d3ee",
      media       = "",
      mediaColor  = "#22c55e",
      background  = "",
      username    = "",
      verified    = "false",   // ← BARU: tampilkan centang biru?
      liked       = "false",
      menu        = "like,comment,repost,share,report",
      likes = "", comments = "", reposts = "", shares = "",
      width  = "900",
      height = "1430",
    } = req.query;

    if (!/^#[0-9A-F]{3,6}$/i.test(avatarColor)) avatarColor = "#22d3ee";
    if (!/^#[0-9A-F]{3,6}$/i.test(mediaColor))   mediaColor  = "#22c55e";

    const isLiked    = String(liked).toLowerCase()    === "true";
    const isVerified = String(verified).toLowerCase() === "true";

    const W = Math.max(400, parseInt(width)  || 900);
    const H = Math.max(600, parseInt(height) || 1430);

    const menuItems = String(menu)
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(s => ICONS[s]);

    const counts = { like: likes, comment: comments, repost: reposts, share: shares };

    const BG_DARK    = "#0a0a0d";
    const CARD_BG    = "#101014";
    const TEXT_WHITE = "#f5f5f7";
    const DANGER     = "#ef4444";

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // ── Background ────────────────────────────────────────
    if (background) {
      try {
        const bg = await loadImage(background);
        blurDraw(ctx, bg, 0, 0, W, H, 22);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, W, H);
      } catch { background = ""; }
    }
    if (!background) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#000000");
      g.addColorStop(1, BG_DARK);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Ambient accent glow — ties the whole frame to avatarColor so each
    // render feels branded rather than a generic dark backdrop.
    const accentRgb = hexToRgbStr(avatarColor);
    ctx.save();
    const glow1 = ctx.createRadialGradient(W * 0.12, H * 0.05, 0, W * 0.12, H * 0.05, W * 0.75);
    glow1.addColorStop(0, `rgba(${accentRgb},0.16)`);
    glow1.addColorStop(1, `rgba(${accentRgb},0)`);
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(W * 0.92, H * 0.95, 0, W * 0.92, H * 0.95, W * 0.7);
    glow2.addColorStop(0, `rgba(${accentRgb},0.10)`);
    glow2.addColorStop(1, `rgba(${accentRgb},0)`);
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── Story card ──────────────────────────────────────────
    const PAD    = Math.round(W * 0.033);
    const cX = PAD, cY = PAD;
    const cW = W - PAD * 2;
    const cH = Math.round(H * 0.58);

    // ── Header: 15% dari tinggi card, cukup lapang atas-bawah ──
    const HEAD_H = Math.round(cH * 0.15);
    const RADIUS = Math.round(cW * 0.032);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur  = 44;
    ctx.shadowOffsetY = 18;
    const cardGrad = ctx.createLinearGradient(cX, cY, cX, cY + cH);
    cardGrad.addColorStop(0, "#17171f");
    cardGrad.addColorStop(1, "#0e0e13");
    ctx.fillStyle = cardGrad;
    rr(ctx, cX, cY, cW, cH, RADIUS, true, false);
    ctx.restore();

    // Hairline highlight along the top edge — reads as a glass/premium bevel
    ctx.save();
    rr(ctx, cX, cY, cW, cH, RADIUS, false, false);
    ctx.clip();
    const bevel = ctx.createLinearGradient(0, cY, 0, cY + Math.round(cH * 0.04));
    bevel.addColorStop(0, "rgba(255,255,255,0.16)");
    bevel.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bevel;
    ctx.fillRect(cX, cY, cW, Math.round(cH * 0.04));
    ctx.restore();

    ctx.save();
    rr(ctx, cX, cY, cW, cH, RADIUS, false, false);
    ctx.clip();

    // Header bg sedikit lebih gelap / berbeda
    const hg = ctx.createLinearGradient(0, cY, 0, cY + HEAD_H);
    hg.addColorStop(0, "#16161c");
    hg.addColorStop(1, CARD_BG);
    ctx.fillStyle = hg;
    ctx.fillRect(cX, cY, cW, HEAD_H);

    // Garis bawah header
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cX, cY + HEAD_H);
    ctx.lineTo(cX + cW, cY + HEAD_H);
    ctx.stroke();

    const mediaY = cY + HEAD_H;
    const mediaH = cH - HEAD_H;
    if (media) {
      try {
        const img = await loadImage(media);
        drawCover(ctx, img, cX, mediaY, cW, mediaH);
      } catch {
        ctx.fillStyle = mediaColor;
        ctx.fillRect(cX, mediaY, cW, mediaH);
      }
    } else {
      ctx.fillStyle = mediaColor;
      ctx.fillRect(cX, mediaY, cW, mediaH);
    }
    ctx.restore();

    // ── Avatar: radius 32% HEAD_H → ada ~34% ruang atas & bawah ──
    const AV_R  = Math.round(HEAD_H * 0.32);
    const AV_CX = cX + AV_R + Math.round(HEAD_H * 0.30);
    const AV_CY = cY + Math.round(HEAD_H * 0.50);

    // Signature ring — gradient sweep (not flat) plus a soft ambient halo,
    // so the avatar reads as the one "alive" element on the card.
    ctx.save();
    ctx.shadowColor = avatarColor + "aa";
    ctx.shadowBlur  = 22;
    const ringGrad = ctx.createLinearGradient(
      AV_CX - AV_R, AV_CY - AV_R, AV_CX + AV_R, AV_CY + AV_R
    );
    ringGrad.addColorStop(0, avatarColor);
    ringGrad.addColorStop(1, "#ffffff");
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = Math.max(3, Math.round(AV_R * 0.1));
    ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    await drawRoundAvatar(ctx, avatar, AV_CX, AV_CY, AV_R);

    // ── Username + verified badge ──────────────────────────
    const FONT_NAME = Math.round(AV_R * 0.70);
    const textX = AV_CX + AV_R + Math.round(AV_R * 0.75);  // jarak lebih lapang dari avatar
    const textY = AV_CY;

    if (username) {
      const dispName = username.length > 22 ? username.slice(0, 21) + "…" : username;
      ctx.font = F(FONT_NAME);
      ctx.fillStyle    = TEXT_WHITE;
      ctx.textBaseline = "middle";
      ctx.shadowColor  = "rgba(0,0,0,0.4)";
      ctx.shadowBlur   = 6;
      ctx.shadowOffsetY = 1;

      // Ukur lebar teks untuk posisi badge
      const tw = ctx.measureText(dispName).width;
      ctx.fillText(dispName, textX, textY);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      if (isVerified) {
        const BADGE_R = Math.round(FONT_NAME * 0.52);
        const badgeCX = textX + tw + BADGE_R + Math.round(FONT_NAME * 0.28);
        const badgeCY = textY;
        drawVerifiedBadge(ctx, badgeCX, badgeCY, BADGE_R);
      }

      ctx.textBaseline = "alphabetic";
    } else if (isVerified) {
      // Jika tidak ada username, badge di samping avatar saja
      const BADGE_R = Math.round(AV_R * 0.32);
      drawVerifiedBadge(ctx, AV_CX + AV_R * 0.72, AV_CY + AV_R * 0.72, BADGE_R);
    }

    // Border card
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    rr(ctx, cX, cY, cW, cH, RADIUS, false, true);
    ctx.restore();

    // ── Action menu (frosted glass, iOS-style) ─────────────
    if (menuItems.length) {
      const ROW_H  = Math.round(H * 0.062);
      const ICON_S = Math.round(ROW_H * 0.30);
      const FONT_S = Math.round(ROW_H * 0.40);
      const MPAD_X = Math.round(ROW_H * 0.42);
      const MPAD_Y = Math.round(ROW_H * 0.36);
      const menuW  = Math.round(W * 0.43);
      const menuH  = MPAD_Y * 2 + menuItems.length * ROW_H;
      const menuX  = cX;
      const menuY  = cY + cH + Math.round(H * 0.028);
      const menuR  = 24;

      // Drop shadow, separate layer so it isn't clipped with the glass fill
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur  = 32;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = "rgba(0,0,0,0.01)"; // shadow-caster only
      rr(ctx, menuX, menuY, menuW, menuH, menuR, true, false);
      ctx.restore();

      // Frosted glass body: vertical gradient + translucent border + a
      // soft accent tint pulled from avatarColor so it echoes the avatar.
      ctx.save();
      rr(ctx, menuX, menuY, menuW, menuH, menuR, false, false);
      ctx.clip();
      const glassGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
      glassGrad.addColorStop(0, "rgba(40,40,48,0.82)");
      glassGrad.addColorStop(1, "rgba(22,22,28,0.88)");
      ctx.fillStyle = glassGrad;
      ctx.fillRect(menuX, menuY, menuW, menuH);
      const accentTint = ctx.createLinearGradient(menuX, menuY, menuX + menuW, menuY);
      accentTint.addColorStop(0, `rgba(${accentRgb},0.10)`);
      accentTint.addColorStop(1, `rgba(${accentRgb},0)`);
      ctx.fillStyle = accentTint;
      ctx.fillRect(menuX, menuY, menuW, menuH);
      // top hairline highlight, like the main card bevel
      const menuBevel = ctx.createLinearGradient(0, menuY, 0, menuY + Math.round(menuH * 0.06));
      menuBevel.addColorStop(0, "rgba(255,255,255,0.14)");
      menuBevel.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = menuBevel;
      ctx.fillRect(menuX, menuY, menuW, Math.round(menuH * 0.06));
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1.5;
      rr(ctx, menuX, menuY, menuW, menuH, menuR, false, true);
      ctx.restore();

      let iy = menuY + MPAD_Y;
      menuItems.forEach((key, idx) => {
        const isReport = key === "report";
        const isLike   = key === "like";
        const likeActive = isLike && isLiked;
        const color = isReport ? DANGER : (likeActive ? "#ef4444" : TEXT_WHITE);
        const rowCY  = iy + ROW_H / 2;
        const iconCX = menuX + MPAD_X + ICON_S * 0.55;

        ICONS[key](ctx, iconCX, rowCY, ICON_S, color, likeActive);

        const label = LABELS[key];
        const cnt = counts[key];
        const hasCount = cnt !== "" && cnt !== undefined && cnt !== null && !isNaN(parseInt(cnt));

        ctx.font = F(FONT_S);
        ctx.fillStyle    = color;
        ctx.textBaseline = "middle";
        ctx.fillText(label, iconCX + ICON_S * 1.55, rowCY);

        if (hasCount) {
          const labelW = ctx.measureText(label).width;
          ctx.font = F(Math.round(FONT_S * 0.92), false);
          ctx.fillStyle = isReport
            ? "rgba(239,68,68,0.65)"
            : (likeActive ? "rgba(239,68,68,0.75)" : "rgba(245,245,247,0.5)");
          ctx.fillText(
            fmt(parseInt(cnt)),
            iconCX + ICON_S * 1.55 + labelW + FONT_S * 0.45,
            rowCY
          );
        }
        ctx.textBaseline = "alphabetic";

        // Separator tipis ala iOS context menu (skip baris terakhir)
        if (idx < menuItems.length - 1) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(menuX + Math.round(menuW * 0.06), iy + ROW_H);
          ctx.lineTo(menuX + menuW - Math.round(menuW * 0.06), iy + ROW_H);
          ctx.stroke();
          ctx.restore();
        }

        iy += ROW_H;
      });
    }

    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
