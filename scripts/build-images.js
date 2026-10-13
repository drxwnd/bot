// Makes smaller WebP copies of the site photos in public/img/photos, so browsers can download the
// size they actually need. Run after adding or replacing a photo:  node scripts/build-images.js
//
// For photo.jpg it writes photo-640.webp, photo-1280.webp (when the original is that wide) and
// photo.webp at full size. views/partials/photo.ejs lists them in srcset.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'public', 'img', 'photos');
const WIDTHS = [640, 1280];

(async () => {
  for (const file of fs.readdirSync(dir).filter((f) => /^[a-z0-9-]+\.jpg$/.test(f))) {
    const src = path.join(dir, file);
    const base = file.replace(/\.jpg$/, '');
    const { width } = await sharp(src).metadata();
    for (const w of WIDTHS) {
      if (w >= width) continue;
      await sharp(src).resize({ width: w }).webp({ quality: 72 }).toFile(path.join(dir, `${base}-${w}.webp`));
    }
    await sharp(src).webp({ quality: 72 }).toFile(path.join(dir, `${base}.webp`));
    console.log(file, width);
  }
})();
