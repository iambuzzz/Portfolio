// Generates public/og-image.jpg (1200×630) — the preview card shown when the
// site link is shared. Re-run after changing name/role: node scripts/og-image.mjs
import sharp from "sharp";

const W = 1200;
const H = 630;
const name = "Ambuj Jaiswal";
const role = "Software Engineer · Full-Stack Developer";
const line3 = "DSA &amp; System Design · IIIT Kota '27";

const bg = await sharp("public/wallpapers/DefaultAerial_Tahoe_Beach.webp")
  .resize(W, H, { fit: "cover" })
  .modulate({ brightness: 0.8 })
  .blur(2)
  .toBuffer();

const font = "-apple-system, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="0.75" stop-color="#000" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <!-- menu bar -->
  <rect width="${W}" height="34" fill="#fff" fill-opacity="0.18"/>
  <text x="24" y="23" font-family="${font}" font-size="16" font-weight="700" fill="#fff"></text>
  <text x="48" y="23" font-family="${font}" font-size="15" font-weight="600" fill="#fff">Portfolio</text>
  <!-- window -->
  <g transform="translate(70,150)">
    <rect width="760" height="330" rx="22" fill="#1c1c1e" fill-opacity="0.72" stroke="#fff" stroke-opacity="0.18"/>
    <circle cx="30" cy="28" r="8" fill="#FF5F57"/><circle cx="56" cy="28" r="8" fill="#FEBC2E"/><circle cx="82" cy="28" r="8" fill="#28C840"/>
    <text x="48" y="150" font-family="${font}" font-size="76" font-weight="800" fill="#fff" letter-spacing="-2">${name}</text>
    <text x="50" y="205" font-family="${font}" font-size="30" font-weight="500" fill="#fff" fill-opacity="0.9">${role}</text>
    <text x="50" y="250" font-family="${font}" font-size="24" fill="#fff" fill-opacity="0.7">${line3}</text>
    <text x="50" y="298" font-family="Menlo, monospace" font-size="20" fill="#5AF78E">$ open portfolio --like-a-mac</text>
  </g>
</svg>`);

const info = await sharp(bg).composite([{ input: overlay }]).jpeg({ quality: 84, mozjpeg: true }).toFile("public/og-image.jpg");
console.log(`public/og-image.jpg ${info.width}×${info.height} ${(info.size / 1024).toFixed(0)}KB`);
