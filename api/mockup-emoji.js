const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ────────────────────────────────────────────────────
let hasMonoFont  = false;
let hasEmojiFont = false;

// Try JetBrains Mono first
try {
  GlobalFonts.register(
    fs.readFileSync(path.join(process.cwd(), "fonts/JetBrainsMono-Regular.ttf")),
    "Mono"
  );
  hasMonoFont = true;
  console.log("[terminal-mockup] JetBrainsMono loaded");
} catch (_) {
  console.log("[terminal-mockup] JetBrainsMono not found, trying Inter...");
}

// Fallback to Inter (same as subtitle.js)
if (!hasMonoFont) {
  try {
    GlobalFonts.register(
      fs.readFileSync(path.join(process.cwd(), "fonts/Inter-Regular.ttf")),
      "Mono"
    );
    hasMonoFont = true;
    console.log("[terminal-mockup] Inter loaded as Mono fallback");
  } catch (_) {
    console.log("[terminal-mockup] Inter not found either");
  }
}

// Emoji font
try {
  GlobalFonts.register(
    fs.readFileSync(path.join(process.cwd(), "fonts/NotoColorEmoji.ttf")),
    "NotoColorEmoji"
  );
  hasEmojiFont = true;
  console.log("[terminal-mockup] NotoColorEmoji loaded");
} catch (_) {
  console.log("[terminal-mockup] NotoColorEmoji not found");
}

// ── PRETTY-PRINT JSON ────────────────────────────────────────
function prettyJson(text) {
  try { return JSON.stringify(JSON.parse(text.trim()), null, 3); }
  catch (_) { return text; }
}

// ── DETECT MODE ──────────────────────────────────────────────
function detectMode(text) {
  const t = text.trim();
  if ((t.startsWith("{") || t.startsWith("[")) && (t.endsWith("}") || t.endsWith("]"))) {
    try { JSON.parse(t); return "json"; } catch (_) {}
  }
  return "plain";
}

// ── WRAP LINE ────────────────────────────────────────────────
function wrapLine(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const out = []; let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// ── MAIN HANDLER ─────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      text     = '{\n  "status": "success",\n  "message": "Hello, World!"\n}',
      title    = "",
      linenums = "true",
      mode: modeHint = "auto",
    } = req.query;

    const showNums = linenums !== "false";

    // Normalise + detect + pretty
    let rawText = String(text).replace(/\\n/g, "\n");
    const mode  = modeHint !== "auto" ? modeHint : detectMode(rawText);
    if (mode === "json") rawText = prettyJson(rawText);

    const rawLines = rawText.split("\n");

    // ── DESIGN CONSTANTS (matching reference image) ──────────
    const FONT_SIZE  = 20;      // px — matches reference
    const LINE_H     = 34;      // px — generous line height
    const PAD_TOP    = 24;      // px above first line
    const PAD_BOT    = 28;      // px below last line
    const PAD_RIGHT  = 48;      // px right padding
    const TITLE_H    = 52;      // px title bar
    const NUM_W      = 52;      // px gutter for line numbers
    const NUM_PAD_R  = 16;      // px gap between number and code
    const CODE_PAD_L = 20;      // px left pad after gutter
    const OUTER_PAD  = 48;      // px space around window
    const CORNER_R   = 14;      // px window corner radius
    const MAX_LINES  = 80;

    // Colors — exactly matching reference
    const C_OUTER_BG = "#e8eaed";   // light grey outer bg
    const C_WIN_BG   = "#2b2c35";   // dark window
    const C_TITLE_BG = "#22232c";   // slightly darker title bar
    const C_TEXT     = "#e8e866";   // yellow — ALL code text
    const C_LINENUM  = "#9899a6";   // muted grey line numbers
    const C_DIVIDER  = "#3a3b47";   // subtle divider

    const fontFamily = hasEmojiFont ? "Mono, NotoColorEmoji, 'Courier New', monospace" : "Mono, 'Courier New', monospace";
    const fontStr    = `${FONT_SIZE}px ${fontFamily}`;
    const numFontStr = `${FONT_SIZE - 2}px ${fontFamily}`;

    // ── MEASURE: find longest line → window width ────────────
    const scratch = createCanvas(4000, 100);
    const sctx    = scratch.getContext("2d");
    sctx.font     = fontStr;

    const MAX_CODE_W = 900; // px max code content width

    let maxLineW = 0;
    for (const ln of rawLines) {
      const w = sctx.measureText(ln).width;
      if (w > maxLineW) maxLineW = w;
    }
    const codeContentW = Math.min(Math.ceil(maxLineW), MAX_CODE_W);

    // Window width = gutter + code + right padding
    const winW = (showNums ? NUM_W + NUM_PAD_R + CODE_PAD_L : CODE_PAD_L * 2)
               + codeContentW + PAD_RIGHT;

    // ── BUILD VISUAL LINES ───────────────────────────────────
    const codeStartX_rel = showNums
      ? NUM_W + NUM_PAD_R + CODE_PAD_L
      : CODE_PAD_L;

    const visualLines = [];
    for (let li = 0; li < rawLines.length; li++) {
      const raw  = rawLines[li];
      const segs = wrapLine(sctx, raw, codeContentW);

      for (let si = 0; si < segs.length; si++) {
        visualLines.push({
          text:    si === 0 ? raw   : "  " + segs[si],
          srcLine: si === 0 ? li+1 : null,
        });
      }

      if (visualLines.length >= MAX_LINES) {
        while (visualLines.length > MAX_LINES - 1) visualLines.pop();
        visualLines.push({ text: "···", srcLine: null, ellipsis: true });
        break;
      }
    }

    // ── CANVAS SIZE ──────────────────────────────────────────
    const codeH  = PAD_TOP + visualLines.length * LINE_H + PAD_BOT;
    const winH   = TITLE_H + codeH;
    const totalW = winW  + OUTER_PAD * 2;
    const totalH = winH  + OUTER_PAD * 2;

    const canvas = createCanvas(totalW, totalH);
    const ctx    = canvas.getContext("2d");

    // ── OUTER BACKGROUND ─────────────────────────────────────
    ctx.fillStyle = C_OUTER_BG;
    ctx.fillRect(0, 0, totalW, totalH);

    const WX = OUTER_PAD;
    const WY = OUTER_PAD;

    // ── WINDOW SHADOW ────────────────────────────────────────
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.28)";
    ctx.shadowBlur    = 32;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, WX, WY, winW, winH, CORNER_R);
    ctx.fillStyle = C_WIN_BG;
    ctx.fill();
    ctx.restore();

    // ── WINDOW BODY ──────────────────────────────────────────
    roundRect(ctx, WX, WY, winW, winH, CORNER_R);
    ctx.fillStyle = C_WIN_BG;
    ctx.fill();

    // ── TITLE BAR ────────────────────────────────────────────
    ctx.save();
    roundRect(ctx, WX, WY, winW, TITLE_H, CORNER_R);
    ctx.clip();
    ctx.fillStyle = C_TITLE_BG;
    ctx.fillRect(WX, WY, winW, TITLE_H);
    ctx.restore();

    // Divider line
    ctx.strokeStyle = C_DIVIDER;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(WX + 1, WY + TITLE_H);
    ctx.lineTo(WX + winW - 1, WY + TITLE_H);
    ctx.stroke();

    // Traffic lights
    const dotCY  = WY + TITLE_H / 2;
    const dotR   = 7;
    const dotGap = 20;
    const dotX0  = WX + 22;
    const DOTS   = [
      { cx: dotX0,            col: "#ff5f57", hi: "#ff8f8b" },
      { cx: dotX0 + dotGap,   col: "#febc2e", hi: "#ffd680" },
      { cx: dotX0 + dotGap*2, col: "#28c840", hi: "#7de88a" },
    ];
    for (const d of DOTS) {
      // Main circle
      ctx.beginPath();
      ctx.arc(d.cx, dotCY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = d.col;
      ctx.fill();
      // Highlight
      ctx.beginPath();
      ctx.arc(d.cx - 2.5, dotCY - 2.5, dotR * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fill();
    }

    // Title text (if provided)
    if (title) {
      ctx.font         = `13px Mono, 'Courier New', monospace`;
      ctx.fillStyle    = "#6b6d7c";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title.slice(0, 70), WX + winW / 2, dotCY);
    }

    // ── CODE AREA ────────────────────────────────────────────
    ctx.save();
    roundRect(ctx, WX, WY, winW, winH, CORNER_R);
    ctx.clip();

    ctx.font         = fontStr;
    ctx.textBaseline = "middle";

    const baseY    = WY + TITLE_H + PAD_TOP + LINE_H / 2;
    const codeX    = WX + codeStartX_rel;

    for (let i = 0; i < visualLines.length; i++) {
      const vl = visualLines[i];
      const y  = baseY + i * LINE_H;

      // Line number
      if (showNums && vl.srcLine !== null) {
        ctx.font      = numFontStr;
        ctx.fillStyle = C_LINENUM;
        ctx.textAlign = "right";
        ctx.fillText(String(vl.srcLine), WX + NUM_W, y);
        ctx.font      = fontStr;
        ctx.textAlign = "left";
      }

      // Code text — all yellow
      ctx.fillStyle = vl.ellipsis ? "#5a5b6a" : C_TEXT;
      ctx.textAlign = "left";
      ctx.fillText(vl.text, codeX, y, codeContentW + PAD_RIGHT);
    }

    ctx.restore();

    // ── OUTPUT ───────────────────────────────────────────────
    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[terminal-mockup]", err);
    res.status(500).json({ error: err.message });
  }
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,    y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}
