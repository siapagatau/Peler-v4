const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { Font } = require("canvacord");

Font.loadDefault();

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "image/png");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: 'Hanya mendukung type="profile"' });
  }

  try {
    // Ambil data dari query
    const {
      name = "Nama Pengguna",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      uang = "0",
      limit = "0",
      rank = "Bronze",
      accent = "#7289DA" // Warna default soft blue
    } = req.query;

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // --- BACKGROUND DAN OVERLAY ---
    // Gambar background atau warna solid
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, width, height);
      } catch {
        // Gradien background default yang soft
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(1, '#16213e');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#1a1a2e');
      bgGradient.addColorStop(1, '#16213e');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Overlay semi-transparan biar teks jelas
    ctx.fillStyle = "rgba(20, 20, 40, 0.65)";
    ctx.fillRect(0, 0, width, height);

    // --- AVATAR ---
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }

    // Efek lingkaran luar avatar
    const avatarSize = 130;
    const avatarX = 50;
    const avatarY = (height - avatarSize) / 2;
    
    // Lingkaran glow
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 10, 0, Math.PI*2);
    const gradient = ctx.createRadialGradient(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 10);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Avatar bulat
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // --- TEKS DAN INFORMASI ---
    const textStartX = avatarX + avatarSize + 40;

    // Nama
    ctx.font = "bold 36px 'Whitney'";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(name, textStartX, height / 2 - 60);
    ctx.shadowBlur = 0;

    // Garis dekoratif bawah nama
    ctx.beginPath();
    ctx.moveTo(textStartX, height / 2 - 40);
    ctx.lineTo(textStartX + 250, height / 2 - 40);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // --- STATISTIK (Uang, Limit, Rank) ---
    const statsY = height / 2 + 20;
    const lineHeight = 45;

    const stats = [
      { label: "💰 Uang", value: formatNumber(uang) },
      { label: "🔒 Limit", value: limit },
      { label: "🏆 Rank", value: rank }
    ];

    ctx.font = "24px 'Whitney'";
    
    stats.forEach((stat, index) => {
      const yPos = statsY + (index * lineHeight);
      
      // Label
      ctx.fillStyle = "#B9BBBE";
      ctx.fillText(`${stat.label}:`, textStartX, yPos);
      
      // Value
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(stat.value, textStartX + 140, yPos);
    });

    // --- STRIP WARNA DI KIRI ---
    const sideGradient = ctx.createLinearGradient(0, 0, 15, height);
    sideGradient.addColorStop(0, accent);
    sideGradient.addColorStop(1, adjustBrightness(accent, -20));
    ctx.fillStyle = sideGradient;
    ctx.fillRect(0, 0, 15, height);

    // Kirim gambar
    const buffer = canvas.toBuffer("image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function untuk format angka jadi ribuan
function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

// Helper function untuk gelapkan warna
function adjustBrightness(color, amount) {
  return '#' + color.replace(/^#/, '').replace(/../g, color => 
    ('0'+Math.max(0, Math.min(255, parseInt(color, 16) + amount)).toString(16)).slice(-2)
  );
}
