/**
 * 照片色调分析（一次性工具，不参与构建）
 *
 * 用途：给 Desktop/Photo 下的作品照打一份「颜色指纹」，
 * 作为分类 + 文案的客观依据（主色调、明度、饱和度、白色占比）。
 *
 * 用法：
 *   node scripts/analyze-photos.mjs /Users/zhangyu/Desktop/Photo
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const dir = process.argv[2] || '/Users/zhangyu/Desktop/Photo';

/** RGB -> HSL（h:0-360, s:0-1, l:0-1） */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** 主色调的通俗叫法，写文案时直接可用 */
function hueName(h, s, l) {
  if (l > 0.86 && s < 0.25) return '白';
  if (l < 0.2) return '黑';
  if (s < 0.12) return l > 0.6 ? '浅灰' : l > 0.35 ? '灰' : '深灰';
  if (h < 15 || h >= 345) return l > 0.72 ? '粉' : l > 0.45 ? '红' : '酒红';
  if (h < 40) return l > 0.78 ? '奶白' : l > 0.6 ? '杏' : '焦糖';
  if (h < 65) return l > 0.72 ? '奶油黄' : '芥黄';
  if (h < 160) return l > 0.72 ? '浅青' : '青绿';
  if (h < 200) return l > 0.75 ? '雾蓝' : '蓝';
  if (h < 255) return l > 0.75 ? '雾霭蓝' : '蓝紫';
  if (h < 290) return l > 0.75 ? '薰衣草' : '紫';
  return l > 0.75 ? '藕粉' : '莓紫';
}

const files = (await readdir(dir))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

const results = [];

for (const file of files) {
  const full = path.join(dir, file);
  const meta = await sharp(full).metadata();

  // 6 列 × 8 行 的平均色网格：能粗略看出中心色、边缘色与渐变方向
  const GW = 6;
  const GH = 8;
  const data = await sharp(full)
    .resize(GW, GH, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const grid = [];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let white = 0;
  let dark = 0;
  const cellCount = GW * GH;

  for (let i = 0; i < cellCount; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    const { l } = rgbToHsl(r, g, b);
    if (l > 0.85) white++;
    if (l < 0.18) dark++;
    grid.push(toHex(r, g, b));
  }

  const avgR = sumR / cellCount;
  const avgG = sumG / cellCount;
  const avgB = sumB / cellCount;
  const avgHsl = rgbToHsl(avgR, avgG, avgB);

  // 网格色彩离散度：越大说明画面颜色越杂（手绘/晕染），越小越接近纯色
  let spread = 0;
  for (let i = 0; i < cellCount; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    spread += Math.abs(r - avgR) + Math.abs(g - avgG) + Math.abs(b - avgB);
  }
  spread = spread / cellCount / 3;

  results.push({
    file,
    width: meta.width,
    height: meta.height,
    avg: toHex(avgR, avgG, avgB),
    hue: Math.round(avgHsl.h),
    sat: +avgHsl.s.toFixed(2),
    light: +avgHsl.l.toFixed(2),
    tone: hueName(avgHsl.h, avgHsl.s, avgHsl.l),
    spread: Math.round(spread),
    whiteRatio: +(white / cellCount).toFixed(2),
    darkRatio: +(dark / cellCount).toFixed(2),
  });

  const rows = [];
  for (let y = 0; y < GH; y++) rows.push(grid.slice(y * GW, (y + 1) * GW).join(' '));
  console.log(
    `\n${file}  ${meta.width}x${meta.height}  avg=${toHex(avgR, avgG, avgB)} ${hueName(
      avgHsl.h,
      avgHsl.s,
      avgHsl.l,
    )} h=${Math.round(avgHsl.h)} s=${avgHsl.s.toFixed(2)} l=${avgHsl.l.toFixed(2)} spread=${Math.round(
      spread,
    )} white=${(white / cellCount).toFixed(2)} dark=${(dark / cellCount).toFixed(2)}`,
  );
  console.log(rows.join('\n'));
}

console.log('\n===JSON===');
console.log(JSON.stringify(results, null, 0));
