import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const reference = process.argv[2];
if (!reference) throw new Error('Supply the attached face image path');
const target = await sharp(reference).greyscale().raw().toBuffer({ resolveWithObject: true });
const samples = [];
for (let y = 18; y < 161; y += 5) for (let x = 92; x < 211; x += 5) {
  const value = target.data[y * target.info.width + x];
  if (value > 12) samples.push({ x, y, value });
}
let best = { correlation: -1 };
for (let width = 310; width <= 500; width += 2) {
  const source = await sharp('public/portrait-fallback.png').resize(width).greyscale().raw().toBuffer();
  const guessX = Math.round(590 * width / 1280 - 95);
  const guessY = Math.round(85 * width / 1280 - 13);
  for (let dy = -20; dy <= 20; dy += 2) for (let dx = -25; dx <= 25; dx += 2) {
    const left = guessX + dx, top = guessY + dy;
    if (92 + left < 0 || 211 + left >= width || 18 + top < 0 || 161 + top >= width) continue;
    let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
    for (const sample of samples) {
      const value = source[(sample.y + top) * width + sample.x + left];
      a += sample.value; b += value; aa += sample.value ** 2; bb += value ** 2; ab += sample.value * value;
    }
    const count = samples.length;
    const correlation = (ab - a * b / count) / Math.sqrt((aa - a * a / count) * (bb - b * b / count));
    if (correlation > best.correlation) best = { correlation, width, left, top, samples: count };
  }
}
await mkdir('artifacts/identity-study', { recursive: true });
await writeFile('artifacts/identity-study/source-match.json', JSON.stringify({ reference, candidate: 'public/portrait-fallback.png', best, note: 'Crop correlation only, not a biometric identity or percentage-likeness score.' }, null, 2));
console.log(best);
