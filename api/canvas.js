const { createCanvas, loadImage } = require("@napi-rs/canvas");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: 'Hanya mendukung type="profile"' });
  }

  try {
    const {
      name = "Pengguna",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      uang = "Rp 0",
      limit = "100",
      rank = "#1",
      badge = "Member"
    } = req.query;

    const width = 900;
    const height = 340;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background solid putih dulu (biar teks keliatan jelas)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Background image opsional (sangat transparan)
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.globalAlpha = 0.1;
        ctx.drawImage(bg, 0, 0, width, height);
        ctx.globalAlpha = 1;
      } catch {}
    }

    // 3. Background gradien pastel
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#fce4f3");
    bgGrad.addColorStop(0.5, "#e8d5f5");
    bgGrad.addColorStop(1, "#d0e8ff");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 4. Panel putih transparan (frosted)
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    roundRect(ctx, 20, 20, width - 40, height - 40, 25);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    roundRect(ctx, 20, 20, width - 40, height - 40, 25);
    ctx.stroke();

    // 5. Avatar
    const avatarSize = 110;
    const avatarX = 55;
    const avatarY = (height - avatarSize) / 2;
    const centerX = avatarX + avatarSize/2;
    const centerY = avatarY + avatarSize/2;

    // Lingkaran putih di belakang avatar
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize/2 + 5, 0, Math.PI*2);
    ctx.fillStyle = "white";
    ctx.fill();

    // Avatar image
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, avatarSize/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // 6. Ring warna di avatar
    const ringColors = ["#FF8FAB", "#A78BFA", "#60CDFF"];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, avatarSize/2 + 8, 
        (i * 2 * Math.PI) / 3 - Math.PI/2,
        ((i+1) * 2 * Math.PI) / 3 - Math.PI/2
      );
      ctx.strokeStyle = ringColors[i];
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    // ================ TEKS ================
    // Reset semua properti yang bisa mengganggu teks
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    
    const textX = avatarX + avatarSize + 35;

    // Badge
    const badgeText = badge.toUpperCase();
    ctx.font = "bold 13px Arial, sans-serif";
    const badgeWidth = ctx.measureText(badgeText).width + 24;
    const badgeHeight = 26;
    const badgeY = 50;
    ctx.fillStyle = "#C4B5FD";
    roundRect(ctx, textX, badgeY, badgeWidth, badgeHeight, 13);
    ctx.fill();
    ctx.fillStyle = "#3d2260";
    ctx.fillText(badgeText, textX + 12, badgeY + 8);

    // Nama user
    ctx.font = "bold 38px Arial, sans-serif";
    ctx.fillStyle = "#2c1a4a";
    ctx.fillText(name, textX, badgeY + 42);

    // Garis dekorasi
    ctx.beginPath();
    ctx.moveTo(textX, badgeY + 82);
    ctx.lineTo(textX + 200, badgeY + 82);
    ctx.strokeStyle = "#d9c8f2";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stat cards
    const stats = [
      { label: "Uang", value: uang, color: "#FFB3C8" },
      { label: "Limit", value: limit, color: "#C4B5FD" },
      { label: "Rank", value: rank, color: "#93E0FF" }
    ];
    const cardY = badgeY + 100;
    const cardWidth = (width - textX - 60) / 3 - 10;
    const cardHeight = 70;

    for (let i = 0; i < stats.length; i++) {
      const cardX = textX + i * (cardWidth + 12);
      
      // Background card
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = stats[i].color;
      ctx.lineWidth = 2.5;
      roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
      ctx.stroke();
      
      // Value
      ctx.font = "bold 22px Arial, sans-serif";
      ctx.fillStyle = "#2c1a4a";
      ctx.textAlign = "center";
      ctx.fillText(stats[i].value, cardX + cardWidth/2, cardY + 28);
      
      // Label
      ctx.font = "12px Arial, sans-serif";
      ctx.fillStyle = "#6b4e8a";
      ctx.fillText(stats[i].label, cardX + cardWidth/2, cardY + 55);
    }

    // Reset alignment
    ctx.textAlign = "left";

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

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