// Grade every course photo to one "sunlit clubhouse" set: same 3:2 crop, same width, levels, a warm-sunny white
// balance, a gentle lift for greens and blues, and a bluer sky where the original sky is grey.
// Originals in public/courses/<slug>/*.jpg stay untouched (credits and licences refer to them); graded copies are
// written to public/courses/<slug>/graded/<same name>.jpg. Uses sharp only; no generation, every pixel is the photo's.
// Usage: node scripts/grade-photos.mjs [slug…]
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = path.join(root, "public/courses");
const WIDTH = 1600; // never enlarged past the original
const ASPECT = 3 / 2;
// Vintage colour postcards: crop and levels only. Painting a blue sky into a hand-tinted card would fake it.
const ARCHIVAL = new Set(["jackson-park/g1.jpg", "jackson-park/g2.jpg", "pinehurst-no-2/g2.jpg"]);

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1) || 1);
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, clamp(s), l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
function percentile(hist, total, p) {
  let acc = 0;
  for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= total * p) return i / (hist.length - 1); }
  return 1;
}

async function grade(src, out, archival) {
  const meta = await sharp(src).metadata();
  const h = Math.round(Math.min(WIDTH, meta.width, meta.height * ASPECT) / ASPECT);
  const w = Math.min(WIDTH, meta.width, Math.round(h * ASPECT));
  const { data } = await sharp(src).rotate().resize(w, h, { fit: "cover", position: sharp.strategy.attention })
    .removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const n = w * h;
  const px = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) px[i] = data[i] / 255;

  // 1 · White balance from the bright near-neutral pixels (clouds, white sand, a clubhouse wall): pull them most of
  // the way to a sunlit neutral (slightly warm), with gains capped so no photo swings far.
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2], L = lum(r, g, b), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (L > 0.55 && L < 0.98 && mx - mn < 0.18) { sr += r; sg += g; sb += b; cnt++; }
  }
  let gain = [1, 1, 1];
  if (cnt > n * 0.005) {
    const m = (sr + sg + sb) / 3 / cnt, warm = [1.025, 1.0, 0.955], k = archival ? 0.3 : 0.6;
    gain = [sr, sg, sb].map((s, c) => clamp(1 + ((m * warm[c]) / (s / cnt) - 1) * k, 0.9, 1.1));
  } else gain = archival ? [1, 1, 1] : [1.015, 1, 0.975];
  // Clipped highlights (a sun disc, a blown cloud) carry no colour to correct: fade the gains out near white, or a
  // pure-white sun turns cream inside a white glow and reads as a ring.
  for (let i = 0; i < n; i++) {
    const keep = smooth(0.9, 0.99, Math.min(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
    for (let c = 0; c < 3; c++) px[i * 3 + c] *= 1 + (gain[c] - 1) * (1 - keep);
  }

  // 2 · Levels: black and white points from the luminance histogram, then a gamma that brings the mean to one
  // shared exposure, so dark and washed-out photos meet in the middle.
  const hist = new Uint32Array(1024);
  let sumL = 0;
  for (let i = 0; i < n; i++) { const L = clamp(lum(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])); hist[Math.round(L * 1023)]++; sumL += L; }
  const lo = Math.min(percentile(hist, n, 0.004), 0.12), hi = Math.max(percentile(hist, n, 0.996), 0.8);
  const meanStretched = clamp((sumL / n - lo) / (hi - lo), 0.05, 0.95);
  const TARGET = 0.5; // a bright, sunlit exposure
  const gamma = clamp(Math.log(TARGET) / Math.log(meanStretched), 0.7, 1.04); // brighten freely, barely ever darken: the set is sunlit
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    let v = clamp((i / 1023 - lo) / (hi - lo));
    v = Math.pow(v, gamma);
    v = v + 0.10 * (v - 0.5) * (1 - Math.abs(2 * v - 1)); // a gentle S for snap, not crunch
    curve[i] = 0.012 + v * (0.975 - 0.012); // a soft, never-crushed black and a creamy, never-clipped white
  }
  const tone = (v) => curve[Math.round(clamp(v) * 1023)];

  // 3 · Sky mask, soft everywhere so no edge ever shows. Each pixel gets a "looks like sky" score (bright, and grey or
  // already blue, never green). Each column walks down from the top while the score holds, giving a sky line; that line
  // is smoothed across neighbouring columns (so a flagpole or a sunlit cloud can't cut a notch), then feathered.
  const mask = new Uint8Array(n);
  if (!archival) {
    const maxY = Math.round(h * 0.62), like = new Float32Array(n);
    for (let i = 0; i < w * maxY; i++) {
      const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2], L = lum(r, g, b), sat = Math.max(r, g, b) - Math.min(r, g, b);
      like[i] = smooth(0.4, 0.6, L) * Math.max(1 - smooth(0.1, 0.3, sat), smooth(0.02, 0.08, b - r)) * (1 - smooth(0.02, 0.1, g - b));
    }
    const bottom = new Float32Array(w), tol = Math.max(3, Math.round(h * 0.012));
    for (let x = 0; x < w; x++) {
      let misses = 0, last = 0;
      for (let y = 0; y < maxY; y++) { if (like[y * w + x] > 0.4) { last = y; misses = 0; } else if (++misses > tol) break; }
      bottom[x] = last;
    }
    const rad = Math.round(w / 16), run = (arr, f) => arr.map((_, x) => f(arr.slice(Math.max(0, x - rad), x + rad + 1)));
    const line = run(run(bottom, (a) => Math.max(...a)), (a) => a.reduce((p, q) => p + q, 0) / a.length);
    const feather = h * 0.04;
    for (let y = 0; y < maxY; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // …and fade with depth, so water and haze near the horizon only take a hint of it.
      mask[i] = Math.round(255 * like[i] * (1 - smooth(line[x] - feather, line[x] + feather, y)) * (1 - 0.75 * smooth(h * 0.22, h * 0.6, y)));
    }
  }
  const soft = archival ? mask : await sharp(Buffer.from(mask), { raw: { width: w, height: h, channels: 1 } }).blur(2.5).extractChannel(0).raw().toBuffer();
  // A sun in the frame: protect the near-white disc and its glow from the blue blend, or the sky tint stops at the
  // disc's edge and draws a ring around it. A wide blur of the brightest sky pixels gives a soft halo to keep as shot.
  let sun = null;
  if (!archival) {
    const bright = new Uint8Array(n);
    let hits = 0;
    for (let i = 0; i < w * Math.round(h * 0.62); i++) if (lum(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]) > 0.95) { bright[i] = 255; hits++; }
    if (hits > 0 && hits < n * 0.02) {
      sun = await sharp(Buffer.from(bright), { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(4, w / 80)).extractChannel(0).raw().toBuffer();
    }
  }

  // 4 · Per pixel: tone, sky, then colour.
  const outBuf = Buffer.alloc(n * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = tone(px[i * 3]), g = tone(px[i * 3 + 1]), b = tone(px[i * 3 + 2]);
      const m = (soft[i] / 255) * (sun ? 1 - smooth(0.01, 0.2, sun[i] / 255) : 1);
      if (m > 0) {
        // Blend toward a clear late-morning sky: deeper at the top, paler at the horizon. Keep the pixel's own
        // brightness (cloud texture survives), keep bright clouds mostly white, and lift a dull grey a touch.
        const t = y / (h * 0.6);
        const sky = [0.43 + 0.33 * t, 0.62 + 0.22 * t, 0.86 + 0.08 * t];
        // Scale the sky colour to the pixel's brightness, but never past a clean (not cyan, not clipped) blue.
        const L = lum(r, g, b), sc = Math.min((L * 1.02 + 0.01) / lum(...sky), 0.98 / sky[2]);
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const grey = 1 - smooth(0.05, 0.22, sat); // already-blue skies need little help
        const cloud = smooth(0.8, 1.0, L); // the brightest cloud tops stay white
        const k = m * (0.3 + 0.42 * grey) * (1 - 0.35 * cloud);
        const sr2 = sky[0] * sc, sg2 = sky[1] * sc, sb2 = sky[2] * sc;
        r = r + (sr2 - r) * k; g = g + (sg2 - g) * k; b = b + (sb2 - b) * k;
      }
      // Colour: vibrance (more for duller pixels), extra for grass greens and sky/water blues, a little warmth in
      // the highlights, and nothing pushed past a photographic saturation.
      let [hh, s, l] = rgbToHsl(clamp(r), clamp(g), clamp(b));
      const green = smooth(55, 80, hh) * (1 - smooth(160, 185, hh));
      const blue = smooth(180, 200, hh) * (1 - smooth(235, 255, hh));
      const boost = archival ? 1.04 : 1 + (0.1 + 0.08 * green + 0.08 * blue) * (1 - s);
      s = Math.min(s * boost, Math.max(s, 0.78));
      [r, g, b] = hslToRgb(hh, s, l);
      if (!archival) { const hl = smooth(0.55, 1, l) * (1 - smooth(0.93, 0.99, l)) * 0.018; r += hl; b -= hl; }
      outBuf[i * 3] = Math.round(clamp(r) * 255);
      outBuf[i * 3 + 1] = Math.round(clamp(g) * 255);
      outBuf[i * 3 + 2] = Math.round(clamp(b) * 255);
    }
  }
  await sharp(outBuf, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: "4:2:0" }).toFile(out);
  return { w, h, gain, gamma: +gamma.toFixed(2) };
}

const only = process.argv.slice(2);
for (const slug of fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()).sort()) {
  if (only.length && !only.includes(slug)) continue;
  const dir = path.join(base, slug), gdir = path.join(dir, "graded");
  fs.mkdirSync(gdir, { recursive: true });
  for (const f of fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort()) {
    const key = `${slug}/${f}`, r = await grade(path.join(dir, f), path.join(gdir, f), ARCHIVAL.has(key));
    const kb = Math.round(fs.statSync(path.join(gdir, f)).size / 1024);
    console.log(`${key.padEnd(34)} ${r.w}×${r.h}  ${kb}KB  gamma ${r.gamma}  wb ${r.gain.map((g) => g.toFixed(3)).join("/")}`);
  }
}
