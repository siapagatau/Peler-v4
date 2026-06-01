const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const fs   = require("fs");
const path = require("path");

// ── FONTS ────────────────────────────────────────────────────
try {
  GlobalFonts.register(
    fs.readFileSync(path.join(process.cwd(), "fonts/JetBrainsMono-Regular.ttf")),
    "JetBrainsMono"
  );
  GlobalFonts.register(
    fs.readFileSync(path.join(process.cwd(), "fonts/JetBrainsMono-Bold.ttf")),
    "JetBrainsMonoBold"
  );
} catch (_) {
  // fallback: font system default, will still render
}

// ── THEME ────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:          "#1e1e2e",   // Catppuccin Mocha base
    titleBar:    "#181825",
    border:      "#313244",
    lineNum:     "#45475a",
    text:        "#cdd6f4",
    key:         "#f9e2af",   // yellow
    string:      "#a6e3a1",   // green
    number:      "#fab387",   // peach
    boolean:     "#89dceb",   // sky
    nullColor:   "#f38ba8",   // red
    colon:       "#6c7086",
    brace:       "#cba6f7",   // mauve
    bracket:     "#89b4fa",   // blue
    prompt:      "#89b4fa",   // blue
    promptAt:    "#a6e3a1",   // green
    comment:     "#6c7086",
    shadow:      "rgba(0,0,0,0.6)",
    outerBg:     "#11111b",
  },
  light: {
    bg:          "#fafafa",
    titleBar:    "#ebebeb",
    border:      "#d0d0d0",
    lineNum:     "#aaaaaa",
    text:        "#383a42",
    key:         "#c18401",
    string:      "#50a14f",
    number:      "#986801",
    boolean:     "#0184bc",
    nullColor:   "#e45649",
    colon:       "#a0a1a7",
    brace:       "#a626a4",
    bracket:     "#4078f2",
    prompt:      "#4078f2",
    promptAt:    "#50a14f",
    comment:     "#a0a1a7",
    shadow:      "rgba(0,0,0,0.15)",
    outerBg:     "#e5e5e5",
  },
};

// ── HELPERS ──────────────────────────────────────────────────
const MAX_LINES   = 60;   // hard cap: truncate beyond this
const ELLIPSIS    = "...";

/**
 * Wrap a single logical line into visual lines that fit maxWidth.
 * Returns array of strings.
 */
function wrapLine(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const result = [];
  let cur = "";

  for (const char of text) {
    const test = cur + char;
    if (ctx.measureText(test).width > maxWidth && cur) {
      result.push(cur);
      cur = char;
    } else {
      cur = test;
    }
  }
  if (cur) result.push(cur);
  return result;
}

/**
 * Detect content type from text: "json" | "code" | "plain"
 */
function detectMode(text) {
  const t = text.trim();
  if ((t.startsWith("{") || t.startsWith("[")) && (t.endsWith("}") || t.endsWith("]"))) {
    try { JSON.parse(t); return "json"; } catch (_) {}
  }
  if (/^\s*[$#>]/.test(t) || t.includes("$ ") || t.includes("# ")) return "code";
  return "plain";
}

// ── TOKENISER ────────────────────────────────────────────────
/**
 * Tokenise a single JSON source line into [{text, color}]
 */
function tokeniseJsonLine(line, theme) {
  const tokens = [];
  const T = (text, color) => tokens.push({ text, color });

  // leading whitespace
  const indent = line.match(/^(\s*)/)[1];
  if (indent) T(indent, theme.text);

  const rest = line.slice(indent.length);

  // closing brace/bracket
  if (/^[}\]],?$/.test(rest)) {
    const ch = rest[0];
    T(ch, ch === "}" ? theme.brace : theme.bracket);
    if (rest.endsWith(",")) T(",", theme.colon);
    return tokens;
  }

  // key: value
  const kvMatch = rest.match(/^("(?:[^"\\]|\\.)*")\s*:\s*(.*)/);
  if (kvMatch) {
    T(kvMatch[1], theme.key);
    T(": ", theme.colon);
    tokeniseValue(kvMatch[2], theme, tokens);
    return tokens;
  }

  // bare value line (array items, opening braces, etc.)
  tokeniseValue(rest, theme, tokens);
  return tokens;
}

function tokeniseValue(raw, theme, tokens) {
  const T = (text, color) => tokens.push({ text, color });
  const v = raw.trim();

  if (v === "{" || v === "{,") {
    T("{", theme.brace); if (v.endsWith(",")) T(",", theme.colon);
  } else if (v === "[" || v === "[,") {
    T("[", theme.bracket); if (v.endsWith(",")) T(",", theme.colon);
  } else if (v.startsWith('"')) {
    // string — strip trailing comma
    const comma = v.endsWith(",");
    const str   = comma ? v.slice(0, -1) : v;
    T(str, theme.string);
    if (comma) T(",", theme.colon);
  } else if (v === "true" || v === "false" || v.replace(",","") === "true" || v.replace(",","") === "false") {
    const comma = v.endsWith(",");
    T(comma ? v.slice(0,-1) : v, theme.boolean);
    if (comma) T(",", theme.colon);
  } else if (v === "null" || v.replace(",","") === "null") {
    const comma = v.endsWith(",");
    T(comma ? v.slice(0,-1) : v, theme.nullColor);
    if (comma) T(",", theme.colon);
  } else if (/^-?\d/.test(v)) {
    const comma = v.endsWith(",");
    T(comma ? v.slice(0,-1) : v, theme.number);
    if (comma) T(",", theme.colon);
  } else {
    T(raw, theme.text);
  }
}

/**
 * Tokenise a "code/shell" line
 */
function tokeniseCodeLine(line, theme) {
  const tokens = [];
  const T = (text, color) => tokens.push({ text, color });

  const promptMatch = line.match(/^(\s*)([$#>]\s?)(.*)/);
  if (promptMatch) {
    if (promptMatch[1]) T(promptMatch[1], theme.text);
    T(promptMatch[2], theme.prompt);
    T(promptMatch[3], theme.text);
    return tokens;
  }

  // comment
  if (line.trimStart().startsWith("#")) {
    T(line, theme.comment);
    return tokens;
  }

  T(line, theme.text);
  return tokens;
}

// ── DRAW TOKENS ──────────────────────────────────────────────
function drawTokens(ctx, tokens, x, y, font, boldFont) {
  ctx.font = font;
  for (const { text, color } of tokens) {
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    x += ctx.measureText(text).width;
  }
}

// ── ROUNDED RECT ─────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
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

// ── MAIN HANDLER ─────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      text     = '{\n  "status": "success",\n  "message": "Hello, World!"\n}',
      title    = "terminal — zsh",
      theme: themeName = "dark",
      width: rawWidth  = "900",
      linenums = "true",
      mode: modeOverride = "auto",
    } = req.query;

    const theme     = THEMES[themeName] ?? THEMES.dark;
    const showNums  = linenums !== "false";
    const imgWidth  = Math.min(Math.max(parseInt(rawWidth) || 900, 400), 2400);

    // ── METRICS ─────────────────────────────────────────────
    const SCALE       = 2;                          // retina
    const W           = imgWidth * SCALE;
    const fontSize    = Math.max(20, Math.floor(imgWidth * 0.022)) * SCALE;
    const lineHeight  = Math.floor(fontSize * 1.55);
    const padX        = Math.floor(fontSize * 1.1);
    const padY        = Math.floor(fontSize * 0.7);
    const titleH      = Math.floor(fontSize * 1.8);
    const numColW     = showNums ? Math.floor(fontSize * 2.2) : 0;
    const codeX       = padX + numColW;
    const maxCodeW    = W - codeX - padX;
    const cornerR     = Math.floor(16 * SCALE);
    const outerPad    = Math.floor(40 * SCALE);

    const monoFont     = `${fontSize}px JetBrainsMono, 'Courier New', monospace`;
    const monoBoldFont = `bold ${fontSize}px JetBrainsMonoBold, 'Courier New', monospace`;

    // ── PARSE LINES ──────────────────────────────────────────
    const rawText    = String(text).replace(/\\n/g, "\n");
    const mode       = modeOverride !== "auto" ? modeOverride : detectMode(rawText);
    const rawLines   = rawText.split("\n");

    // Temporary canvas to measure
    const tmp    = createCanvas(W, 100);
    const tmpCtx = tmp.getContext("2d");
    tmpCtx.font  = monoFont;

    // Build visual lines (wrapped) with token info
    // Each entry: { tokens: [{text,color}], srcLine: number }
    const visualLines = [];

    for (let li = 0; li < rawLines.length; li++) {
      const raw = rawLines[li];

      // tokenise based on mode
      let tokens;
      if (mode === "json") {
        tokens = tokeniseJsonLine(raw, theme);
      } else if (mode === "code") {
        tokens = tokeniseCodeLine(raw, theme);
      } else {
        tokens = [{ text: raw, color: theme.text }];
      }

      // reconstruct plain text for wrap measurement
      const plain = tokens.map(t => t.text).join("");
      const wrappedPlain = wrapLine(tmpCtx, plain, maxCodeW);

      if (wrappedPlain.length === 1) {
        visualLines.push({ tokens, srcLine: li + 1, wrapped: false });
      } else {
        // For wrapped lines: re-tokenise each wrapped segment naively
        // (keep first segment tokens intact, rest shown as plain continuation)
        for (let wi = 0; wi < wrappedPlain.length; wi++) {
          if (wi === 0) {
            // Try to keep tokens for first segment
            visualLines.push({ tokens, srcLine: li + 1, wrapped: false, clip: wrappedPlain[0].length });
          } else {
            visualLines.push({
              tokens: [{ text: "  " + wrappedPlain[wi], color: theme.text }],
              srcLine: null,
              wrapped: true,
            });
          }
        }
      }

      // Hard cap: truncate
      if (visualLines.length >= MAX_LINES) {
        // Remove last few and add ellipsis
        while (visualLines.length > MAX_LINES - 1) visualLines.pop();
        visualLines.push({
          tokens: [{ text: ELLIPSIS, color: theme.comment }],
          srcLine: null,
          wrapped: false,
          isEllipsis: true,
        });
        break;
      }
    }

    // ── CANVAS SIZE ──────────────────────────────────────────
    const codeH  = visualLines.length * lineHeight + padY * 2;
    const totalH = titleH + codeH + outerPad * 2;
    const totalW = W + outerPad * 2;

    const canvas = createCanvas(totalW, totalH);
    const ctx    = canvas.getContext("2d");

    // ── OUTER BACKGROUND ─────────────────────────────────────
    // Subtle gradient background
    const outerGrad = ctx.createLinearGradient(0, 0, totalW, totalH);
    outerGrad.addColorStop(0,   theme.outerBg);
    outerGrad.addColorStop(0.5, theme.themeName === "light" ? "#d8d8d8" : "#16161e");
    outerGrad.addColorStop(1,   theme.outerBg);
    ctx.fillStyle = outerGrad;
    ctx.fillRect(0, 0, totalW, totalH);

    // ── DROP SHADOW ──────────────────────────────────────────
    ctx.save();
    ctx.shadowColor   = theme.shadow;
    ctx.shadowBlur    = 40 * SCALE;
    ctx.shadowOffsetY = 10 * SCALE;
    roundRect(ctx, outerPad, outerPad, W, titleH + codeH, cornerR);
    ctx.fillStyle = theme.titleBar;
    ctx.fill();
    ctx.restore();

    // ── TITLE BAR ────────────────────────────────────────────
    roundRect(ctx, outerPad, outerPad, W, titleH, cornerR);
    ctx.fillStyle = theme.titleBar;
    ctx.fill();

    // Clip top corners only by overdrawing bottom half of title bar
    ctx.fillStyle = theme.titleBar;
    ctx.fillRect(outerPad, outerPad + titleH / 2, W, titleH / 2);

    // Traffic lights
    const dotY  = outerPad + titleH / 2;
    const dotR  = Math.floor(7 * SCALE);
    const dotGap = Math.floor(20 * SCALE);
    const dotX0 = outerPad + Math.floor(20 * SCALE);

    const dots = [
      { x: dotX0,             color: "#ff5f57", shadow: "#c0392b" },
      { x: dotX0 + dotGap,    color: "#ffbd2e", shadow: "#d4ac00" },
      { x: dotX0 + dotGap*2,  color: "#28ca41", shadow: "#1e9e33" },
    ];

    for (const d of dots) {
      // glow
      ctx.save();
      ctx.shadowColor = d.color;
      ctx.shadowBlur  = 8 * SCALE;
      ctx.beginPath();
      ctx.arc(d.x, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.restore();
      // shine
      ctx.beginPath();
      ctx.arc(d.x - dotR * 0.25, dotY - dotR * 0.3, dotR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    }

    // Title text
    const titleFontSize = Math.floor(fontSize * 0.7);
    ctx.font      = `${titleFontSize}px JetBrainsMono, 'Courier New', monospace`;
    ctx.fillStyle = theme.lineNum;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      title.length > 60 ? title.slice(0, 57) + "..." : title,
      outerPad + W / 2,
      dotY
    );
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";

    // ── DIVIDER ──────────────────────────────────────────────
    ctx.strokeStyle = theme.border;
    ctx.lineWidth   = 1 * SCALE;
    ctx.beginPath();
    ctx.moveTo(outerPad, outerPad + titleH);
    ctx.lineTo(outerPad + W, outerPad + titleH);
    ctx.stroke();

    // ── CODE AREA ────────────────────────────────────────────
    // Clip to code body
    ctx.save();
    roundRect(ctx, outerPad, outerPad + titleH, W, codeH, 0);
    ctx.clip();

    ctx.fillStyle = theme.bg;
    ctx.fillRect(outerPad, outerPad + titleH, W, codeH);

    // Line-number gutter background
    if (showNums) {
      ctx.fillStyle = theme.titleBar;
      ctx.fillRect(outerPad, outerPad + titleH, numColW + padX, codeH);

      ctx.strokeStyle = theme.border;
      ctx.lineWidth   = 1 * SCALE;
      ctx.beginPath();
      ctx.moveTo(outerPad + numColW + padX, outerPad + titleH);
      ctx.lineTo(outerPad + numColW + padX, outerPad + titleH + codeH);
      ctx.stroke();
    }

    // ── DRAW LINES ───────────────────────────────────────────
    ctx.textBaseline = "alphabetic";
    const baseY = outerPad + titleH + padY + Math.floor(fontSize * 0.85);

    for (let i = 0; i < visualLines.length; i++) {
      const vl  = visualLines[i];
      const y   = baseY + i * lineHeight;

      // Line number
      if (showNums && vl.srcLine !== null && !vl.wrapped) {
        ctx.font      = monoFont;
        ctx.fillStyle = theme.lineNum;
        ctx.textAlign = "right";
        ctx.fillText(String(vl.srcLine), outerPad + numColW, y);
        ctx.textAlign = "left";
      }

      // Tokens
      if (vl.isEllipsis) {
        ctx.font      = monoBoldFont;
        ctx.fillStyle = theme.comment;
        ctx.fillText(ELLIPSIS, outerPad + codeX, y);
      } else {
        let tx = outerPad + codeX;
        ctx.font = monoFont;
        for (const { text, color } of vl.tokens) {
          // clip each token to maxCodeW
          const avail = (outerPad + W - padX) - tx;
          if (avail <= 0) break;
          ctx.fillStyle = color;
          ctx.fillText(text, tx, y, avail);
          tx += ctx.measureText(text).width;
        }
      }
    }

    ctx.restore();

    // ── ROUNDED BOTTOM CORNERS ───────────────────────────────
    // Re-clip overall window shape
    ctx.save();
    roundRect(ctx, outerPad, outerPad, W, titleH + codeH, cornerR);
    // stroke border
    ctx.strokeStyle = theme.border;
    ctx.lineWidth   = 1.5 * SCALE;
    ctx.stroke();
    ctx.restore();

    // ── OUTPUT ───────────────────────────────────────────────
    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer("image/png"));

  } catch (err) {
    console.error("[terminal-mockup]", err);
    res.status(500).json({ error: err.message });
  }
};
