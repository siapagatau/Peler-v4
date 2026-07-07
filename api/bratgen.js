const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
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

const FN = (sz) => `normal ${sz}px ${hasEmoji ? "'Inter','NotoColorEmoji'" : "Inter,sans-serif"}`;
const FB = (sz) => `bold ${sz}px ${hasEmoji ? "'InterBold','NotoColorEmoji'" : "InterBold,sans-serif"}`;

// ── UTILS ──────────────────────────────────────────────────────────────────
function cleanFormatting(str) {
  if (str.startsWith("```") && str.endsWith("```")) return str.slice(3, -3);
  if ((str.startsWith("*_") && str.endsWith("_*")) || (str.startsWith("_*") && str.endsWith("*_"))) return str.slice(2, -2);
  if ((str.startsWith("*") && str.endsWith("*")) || (str.startsWith("_") && str.endsWith("_")) || (str.startsWith("~") && str.endsWith("~"))) return str.slice(1, -1);
  return str;
}

function isHighlighted(highlightList, content) {
  if (!content || !highlightList || highlightList.length === 0) return false;
  const lower = content.toLowerCase();
  return highlightList.some(w => cleanFormatting(w).toLowerCase() === lower);
}

// NOTE: emoji-db/emoji-cache tidak dipakai. NotoColorEmoji sudah terdaftar
// sebagai fallback font (sama seperti storygram.js), jadi emoji cukup ikut
// jadi bagian teks biasa — canvas yang menggambar glyph-nya langsung.
function parseTextToSegments(text, ctx, fontSize) {
  const segments = [];
  const splitWords = (content, type, font) => {
    const parts = content.match(/\S+|\s+/g) || [];
    for (const part of parts) {
      const isWs = /^\s+$/.test(part);
      ctx.font = font;
      segments.push({ type: isWs ? "whitespace" : type, content: part, width: ctx.measureText(part).width });
    }
  };
  // Tidak ada font italic/monospace terdaftar, jadi */_ dan ``` dirender pakai Inter biasa.
  const tokenizer = /(\*_.*?_\*|_\*.*?\*_)|(\*.*?\*)|(_.*?_)|(~.*?~)|(```.*?```)|(\s+)|([^\s*~_`]+)/g;
  let match;
  while ((match = tokenizer.exec(text)) !== null) {
    const [, boldItalic, bold, italic, strike, mono, ws, plain] = match;
    if (boldItalic)      splitWords(boldItalic.slice(2, -2), "bold", FB(fontSize));
    else if (bold)       splitWords(bold.slice(1, -1), "bold", FB(fontSize));
    else if (italic)     splitWords(italic.slice(1, -1), "text", FN(fontSize));
    else if (strike)     splitWords(strike.slice(1, -1), "strikethrough", FN(fontSize));
    else if (mono)       splitWords(mono.slice(3, -3), "text", FN(fontSize));
    else if (ws) { ctx.font = FN(fontSize); segments.push({ type: "whitespace", content: ws, width: ctx.measureText(ws).width }); }
    else if (plain) { ctx.font = FN(fontSize); segments.push({ type: "text", content: plain, width: ctx.measureText(plain).width }); }
  }
  ctx.font = FN(fontSize);
  return segments;
}

function rebuildLines(segments, maxWidth, ctx, fontSize) {
  const lines = [];
  let cur = [], curW = 0;
  for (const seg of segments) {
    if (seg.type !== "whitespace" && seg.width > maxWidth) {
      if (cur.length) lines.push(cur);
      let tmp = "";
      ctx.font = seg.type === "bold" ? FB(fontSize) : FN(fontSize);
      for (const ch of seg.content) {
        const test = tmp + ch;
        if (ctx.measureText(test).width > maxWidth && tmp) {
          lines.push([{ ...seg, content: tmp, width: ctx.measureText(tmp).width }]);
          tmp = ch;
        } else tmp = test;
      }
      cur = [{ ...seg, content: tmp, width: ctx.measureText(tmp).width }];
      curW = ctx.measureText(tmp).width;
      continue;
    }
    if (curW + seg.width > maxWidth && cur.length) { lines.push(cur); cur = []; curW = 0; }
    if (seg.type === "whitespace" && cur.length === 0) continue;
    cur.push(seg); curW += seg.width;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Ganti sharp .blur(): downsample lalu upscale pakai smoothing canvas.
function softBlur(canvas) {
  const w = canvas.width, h = canvas.height;
  const factor = 6;
  const small = createCanvas(Math.max(1, Math.round(w / factor)), Math.max(1, Math.round(h / factor)));
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(canvas, 0, 0, w, h, 0, 0, small.width, small.height);

  const out = createCanvas(w, h);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
  return out;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  try {
    let {
      text      = "brat",
      bgColor   = "#FFFFFF",
      textColor = "#000000",
      highlight = "",
      width     = "512",
      height    = "512",
      blur      = "true",
    } = req.query || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Parameter 'text' wajib diisi" });
    }
    if (!/^#[0-9A-F]{3,8}$/i.test(bgColor))   bgColor   = "#FFFFFF";
    if (!/^#[0-9A-F]{3,8}$/i.test(textColor)) textColor = "#000000";

    const highlightWords = highlight ? String(highlight).split(",").map(s => s.trim()).filter(Boolean) : [];
    const W = Math.max(64, parseInt(width)  || 512);
    const H = Math.max(64, parseInt(height) || 512);
    const doBlur = String(blur).toLowerCase() !== "false";

    const margin = 8, verticalPadding = 8;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const availableWidth = W - margin * 2;
    const lineHeightMultiplier = 1.3;
    let fontSize = 200, finalLines = [], lineHeight = 0, lastGood = null;

    while (fontSize > 10) {
      let renderLines = [];
      for (const singleLine of String(text).split("\n")) {
        if (singleLine === "") { renderLines.push([]); continue; }
        const segs = parseTextToSegments(singleLine, ctx, fontSize);
        renderLines.push(...rebuildLines(segs, availableWidth, ctx, fontSize));
      }
      const lh = fontSize * lineHeightMultiplier;
      const totalH = renderLines.length * lh;
      if (totalH <= H - verticalPadding * 2) {
        lastGood = { lines: renderLines, fontSize, lineHeight: lh };
        finalLines = renderLines; lineHeight = lh;
        break;
      }
      fontSize -= 2;
    }
    if (!finalLines.length && lastGood) {
      finalLines = lastGood.lines; fontSize = lastGood.fontSize; lineHeight = lastGood.lineHeight;
    }

    // Kasus satu kata tunggal: perbesar semaksimal mungkin
    if (finalLines.length === 1 && finalLines[0].length === 1) {
      const word = finalLines[0][0].content;
      ctx.font = FN(200);
      const refW = ctx.measureText(word).width;
      const byHeight = (H - verticalPadding * 2) / lineHeightMultiplier;
      const byWidth  = (availableWidth / refW) * 200;
      fontSize = Math.floor(Math.min(byHeight, byWidth));
      lineHeight = fontSize * lineHeightMultiplier;
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    const totalH = finalLines.length * lineHeight;
    let y = finalLines.length === 1 ? verticalPadding : (H - totalH) / 2;

    const drawSeg = (seg, x, yy) => {
      ctx.fillStyle = isHighlighted(highlightWords, seg.content) ? "#ff0000" : textColor;
      ctx.font = seg.type === "bold" ? FB(fontSize) : FN(fontSize);
      ctx.fillText(seg.content, x, yy);
      if (seg.type === "strikethrough") {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, fontSize / 15);
        const ly = yy + lineHeight / 2.1;
        ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + seg.width, ly); ctx.stroke();
      }
    };

    for (const line of finalLines) {
      const content = line.filter(s => s.type !== "whitespace");
      if (content.length <= 1) {
        let x = margin;
        for (const seg of line) { drawSeg(seg, x, y); x += seg.width; }
      } else {
        const totalW = content.reduce((s, seg) => s + seg.width, 0);
        const gap = (availableWidth - totalW) / (content.length - 1);
        let x = margin;
        for (let i = 0; i < content.length; i++) {
          drawSeg(content[i], x, y);
          x += content[i].width;
          if (i < content.length - 1) x += gap;
        }
      }
      y += lineHeight;
    }

    const finalCanvas = doBlur ? softBlur(canvas) : canvas;

    res.setHeader("Content-Type", "image/png");
    res.send(finalCanvas.toBuffer("image/png"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
