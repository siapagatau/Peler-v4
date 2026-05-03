const { createCanvas, loadImage, Font } = require("canvacord");

Font.loadDefault();

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { type } = req.query;
  if (type !== "profile") {
    return res.status(400).json({ error: "Hanya mendukung type=profile" });
  }

  try {
    // Ambil parameter dari query string
    const {
      name = "Pengguna",
      username = "",
      bio = "",
      avatar = "https://cdn.discordapp.com/embed/avatars/0.png",
      background = "",
      stat1label = "Pesan",
      stat1value = "0",
      stat2label = "Level",
      stat2value = "1",
      stat3label = "Poin",
      stat3value = "0",
      accent = "#5865F2"
    } = req.query;

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // --- Background (gambar atau warna solid) ---
    if (background) {
      try {
        const bg = await loadImage(background);
        ctx.drawImage(bg, 0, 0, width, height);
      } catch {
        ctx.fillStyle = "#2C2F33";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = "#2C2F33";
      ctx.fillRect(0, 0, width, height);
    }

    // Overlay gelap agar teks mudah dibaca
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, width, height);

    // --- Avatar bulat ---
    let avatarImg;
    try {
      avatarImg = await loadImage(avatar);
    } catch {
      avatarImg = await loadImage("https://cdn.discordapp.com/embed/avatars/0.png");
    }
    const avatarSize = 100;
    const avatarX = 40;
    const avatarY = 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // --- Nama ---
    ctx.font = "bold 28px 'Whitney', 'Roboto'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(name, avatarX + avatarSize + 20, avatarY + 35);

    // --- Username (opsional) ---
    if (username) {
      ctx.font = "18px 'Whitney', 'Roboto'";
      ctx.fillStyle = "#B9BBBE";
      ctx.fillText(`@${username}`, avatarX + avatarSize + 20, avatarY + 70);
    }

    // --- Bio (opsional) ---
    if (bio) {
      ctx.font = "15px 'Whitney', 'Roboto'";
      ctx.fillStyle = "#DCDDDE";
      const bioText = bio.length > 50 ? bio.slice(0, 47) + "..." : bio;
      ctx.fillText(bioText, avatarX + avatarSize + 20, avatarY + 105);
    }

    // --- Statistik (3 kolom) ---
    const statsY = height - 80;
    const statWidth = (width - 80) / 3;
    const statXStart = 40;
    const stats = [
      { label: stat1label, value: stat1value },
      { label: stat2label, value: stat2value },
      { label: stat3label, value: stat3value }
    ];

    ctx.font = "bold 24px 'Whitney', 'Roboto'";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    for (let i = 0; i < stats.length; i++) {
      const x = statXStart + i * statWidth + statWidth/2;
      ctx.fillText(stats[i].value, x, statsY - 10);
    }

    ctx.font = "14px 'Whitney', 'Roboto'";
    ctx.fillStyle = "#B9BBBE";
    for (let i = 0; i < stats.length; i++) {
      const x = statXStart + i * statWidth + statWidth/2;
      ctx.fillText(stats[i].label, x, statsY + 15);
    }
    ctx.textAlign = "left";

    // --- Garis pemisah di atas statistik ---
    ctx.beginPath();
    ctx.moveTo(40, height - 110);
    ctx.lineTo(width - 40, height - 110);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Strip aksen di sisi kiri ---
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 8, height);

    // Kirim hasil
    res.setHeader("Content-Type", "image/png");
    res.send(canvas.toBuffer());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};