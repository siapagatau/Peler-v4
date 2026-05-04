const { createCanvas, loadImage } = require("@napi-rs/canvas");

module.exports = async (req, res) => {
  // Header CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Parameter yang dibutuhkan
  const {
    name = "Pengguna",
    avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
    background = "",
    uang = "0",
    limit = "0",
    rank = "bronze",
    accent = "f97316",    // warna aksen hex (tanpa #)
  } = req.query;

  try {
    const width = 800;
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // --- 1. BACKGROUND GRADIENT (soft & colorful) ---
    const grad = ctx.createLinearGradient(0, 0, width*0.8, height);
    grad.addColorStop(0, `#${accent}80`);       // aksen 50%
    grad.addColorStop(0.5, "#1e1a4dcc");        // ungu gelap
    grad.addColorStop(1, "#0f172acc");           // biru gelap
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // --- 2. OVERLAY BLUR (efek glassmorphism) ---
    ctx.fillStyle = "rgba(255,255,240,0.08)";
    ctx.fillRect(0, 0, width, height);

    // --- 3. BACKGROUND GAMBAR (jika ada) ---
    if (background) {
      try {
        const bgImg = await loadImage(background);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(bgImg, 0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.restore();
      } catch (error) {
        console.warn("Gagal muat background:", error.message);
      }
    }

    // --- 4. AVATAR BULAT (shadow & glow) ---
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    const avatarSize = 120;
    const avatarX = 50;
    const avatarY = 70;
    
    // shadow
    ctx.shadowColor = `rgba(0,0,0,0.3)`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // clip & gambar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();  // restore clip

    // --- 5. NAMA & RANK BADGE (glow text opsional) ---
    ctx.font = "bold 32px 'Segoe UI', 'Whitney', 'Poppins'";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.fillText(name, avatarX + avatarSize + 25, avatarY + 45);
    ctx.shadowBlur = 0;
    
    // rank badge (warna sesuai rank)
    let rankColor = "#facc15"; // gold default
    if (rank === "bronze") rankColor = "#cd7f32";
    if (rank === "silver") rankColor = "#c0c0c0";
    if (rank === "gold") rankColor = "#facc15";
    if (rank === "platinum") rankColor = "#b0c4de";
    ctx.font = "bold 16px 'Segoe UI'";
    ctx.fillStyle = rankColor;
    ctx.fillText(`🏆 ${rank.toUpperCase()}`, avatarX + avatarSize + 25, avatarY + 90);

    // --- 6. STATISTIK (Uang, Limit, Rank) - card terpisah ---
    const stats = [
      { label: "💰 Uang", value: formatNumber(uang) },
      { label: "⏱️ Limit", value: formatNumber(limit) },
      { label: "⭐ Rank", value: rank.toUpperCase() }
    ];
    
    const cardWidth = 200;
    const cardHeight = 80;
    const startX = 50;
    const startY = height - 120;
    const gap = (width - (cardWidth * 3) - 100) / 2;
    
    for (let i = 0; i < stats.length; i++) {
      const x = startX + i * (cardWidth + gap);
      const y = startY;
      
      // card background (glassmorph)
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px 'Segoe UI'";
      ctx.fillText(stats[i].value, x + 25, y + 40);
      ctx.font = "14px 'Segoe UI'";
      ctx.fillStyle = "#dddddd";
      ctx.fillText(stats[i].label, x + 25, y + 70);
    }
    ctx.shadowBlur = 0;

    // --- 7. GARIS AKSEN (soft glow) ---
    ctx.beginPath();
    ctx.moveTo(30, height - 150);
    ctx.lineTo(width - 30, height - 150);
    ctx.strokeStyle = `#${accent}`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = `#${accent}`;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- 8. OUTPUT ---
    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Helper format angka ribuan
function formatNumber(num) {
  return parseInt(num).toLocaleString('id-ID');
}