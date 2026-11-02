/**
 * 作品照导入工具
 * ------------------------------------------------------------------
 * 把本地整理好的作品照片一次性接进项目：
 *   1. 复制到 public/works/ 并统一命名为 work-01.jpg …（不改动原图）
 *   2. 顺手做一次压缩：长边压到 1600px、JPEG q82、渐进式，去掉冗余元数据
 *   3. 读取真实像素尺寸，写进清单（next/image 靠它算宽高比，避免布局抖动）
 *   4. 提取画面调色板，找出「甲面主色」（排除肤色的那一簇），
 *      用它生成色调文案与兜底色块色（图片加载失败时顶替用）
 *   5. 输出 data/artworks.json —— 这是唯一需要人工过一眼的文件
 *
 * 用法：
 *   node scripts/import-photos.mjs                      # 默认读 ~/Desktop/Photo
 *   node scripts/import-photos.mjs /path/to/photos       # 指定目录
 *
 * 重复执行是安全的：
 *   - 以原始文件名为键做合并，已经改过的标题 / 分类 / 文案不会被覆盖
 *   - 新增照片只会追加，不会重排已有编号
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = process.argv[2] || path.join(homedir(), 'Desktop', 'Photo');
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'works');
const DATA_FILE = path.join(ROOT, 'data', 'artworks.json');

/** 与 data/portfolio.ts 保持一致；脚本侧的副本，用于校验与配额均衡 */
const REAL_CATEGORIES = ['纯色', '法式', '晕染', '手绘', '延长甲'];

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;

/* ------------------------------ 颜色工具 ------------------------------ */

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

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return (
    '#' +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** 把颜色叫成中文，用于标题与辅助文案 */
function toneName(h, s, l) {
  if (l > 0.88 && s < 0.2) return '象牙白';
  if (l < 0.18) return '墨黑';
  if (s < 0.09) return l > 0.68 ? '浅灰' : l > 0.42 ? '灰' : '深灰';
  if (h < 15 || h >= 345) return l > 0.76 ? '樱花粉' : l > 0.52 ? '豆沙' : '酒红';
  if (h < 40) return l > 0.84 ? '奶白' : l > 0.64 ? '奶茶' : '焦糖';
  if (h < 65) return l > 0.78 ? '奶油黄' : '姜黄';
  if (h < 160) return l > 0.78 ? '浅青' : '橄榄绿';
  if (h < 200) return l > 0.76 ? '雾蓝' : '海蓝';
  if (h < 255) return l > 0.76 ? '灰蓝' : '藏蓝';
  if (h < 290) return l > 0.76 ? '薰衣草' : '葡萄紫';
  return l > 0.76 ? '藕粉' : '莓紫';
}

const lightWord = (l) => (l > 0.7 ? '偏亮' : l > 0.48 ? '中明度' : '偏暗');

/* ------------------------------ 画面采样 ------------------------------ */

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** 极简 k-means，只关心「画面大致由哪几块颜色构成」 */
function kmeans(samples, k = 5, iters = 12) {
  const centers = [];
  const step = Math.floor(samples.length / k) || 1;
  for (let i = 0; i < k; i++) {
    const s = samples[Math.min(i * step, samples.length - 1)];
    centers.push([s[0], s[1], s[2]]);
  }

  const assign = new Array(samples.length).fill(0);
  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(samples[i], centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      const a = assign[i];
      const s = samples[i];
      sums[a][0] += s[0];
      sums[a][1] += s[1];
      sums[a][2] += s[2];
      sums[a][3] += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  const counts = new Array(k).fill(0);
  for (const a of assign) counts[a] += 1;
  return centers
    .map((c, i) => ({ rgb: c, count: counts[i] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * 从照片里读三件事：
 *   - 调色板：画面主要由哪几块颜色构成（按像素占比排序）
 *   - 甲面主色：排除最大的一簇（通常是肤色/背景）之后，
 *     面积 × 与肤色的距离 得分最高的那一簇 —— 基本就是甲油胶的颜色
 *   - 明暗分布：纯白/深色像素占比，用于判断留白（法式）与深底
 */
async function sample(buffer) {
  const N = 64; // 4096 个采样点，足够稳定又不慢
  const { data, info } = await sharp(buffer)
    .resize(N, N, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const total = N * N;
  const samples = [];
  let whitePx = 0;
  let darkPx = 0;
  let sumL = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * ch];
    const g = data[i * ch + 1];
    const b = data[i * ch + 2];
    samples.push([r, g, b]);
    const hsl = rgbToHsl(r, g, b);
    if (hsl.l > 0.86 && hsl.s < 0.2) whitePx += 1;
    if (hsl.l < 0.16) darkPx += 1;
    sumL += hsl.l;
  }

  // 四角明度当背景明暗（四角基本落在桌面 / 背景布上）
  const cornerL = [
    [1, 1],
    [1, N - 2],
    [N - 2, 1],
    [N - 2, N - 2],
  ]
    .map(([x, y]) => {
      const i = y * N + x;
      return rgbToHsl(data[i * ch], data[i * ch + 1], data[i * ch + 2]).l;
    })
    .reduce((a, b) => a + b, 0) / 4;

  const clusters = kmeans(samples, 5);
  const dominant = clusters[0];

  // 候选甲面主色：剔除近黑、近白、几乎无彩度的簇，再挑「够显眼」的那一簇
  const candidates = clusters.filter((c) => {
    if (c === dominant) return false;
    const { l, s } = rgbToHsl(...c.rgb);
    return l > 0.14 && l < 0.9 && s > 0.06;
  });

  let accent = candidates[0] ?? dominant;
  let accentScore = -1;
  for (const c of candidates) {
    const { s, l } = rgbToHsl(...c.rgb);
    const distance = Math.sqrt(dist2(c.rgb, dominant.rgb)) / 255;
    // 面积占主导，同时偏好彩度稍高、与肤色差异大的簇
    const score = c.count * (0.35 + distance) * (0.5 + s * 1.4) * (l > 0.2 && l < 0.85 ? 1 : 0.6);
    if (score > accentScore) {
      accentScore = score;
      accent = c;
    }
  }

  const accentHsl = rgbToHsl(...accent.rgb);
  const palette = clusters.slice(0, 3).map((c) => toHex(...c.rgb));

  // 色彩离散度：调色板之间的平均距离，越大越像多色 / 手绘 / 晕染
  let spread = 0;
  let pairs = 0;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      spread += Math.sqrt(dist2(clusters[i].rgb, clusters[j].rgb));
      pairs += 1;
    }
  }
  spread = pairs ? spread / pairs : 0;

  return {
    palette,
    accent: toHex(...accent.rgb),
    accentHue: Math.round(accentHsl.h),
    accentSat: +accentHsl.s.toFixed(2),
    accentLight: +accentHsl.l.toFixed(2),
    accentShare: +(accent.count / total).toFixed(2),
    whiteRatio: +(whitePx / total).toFixed(2),
    darkRatio: +(darkPx / total).toFixed(2),
    avgLight: +(sumL / total).toFixed(2),
    spread: Math.round(spread),
    cornerL: +cornerL.toFixed(2),
    background: cornerL < 0.34 ? '深色背景' : cornerL > 0.72 ? '浅色背景' : '中间调背景',
  };
}

/* ------------------------------ 分类推断 ------------------------------ */

/**
 * 按画面特征给一个初判分类。
 *
 * ⚠️ 这是「按像素特征猜」的初值，不是人工看图的结果。
 * 你在 data/artworks.json 里改 category 字段即可覆盖；
 * 重跑脚本不会改回去（source 文件名不变就保留你写的内容）。
 */
function guessCategory(s) {
  if (s.whiteRatio >= 0.16) return '法式';
  if (s.accentSat < 0.14) return '纯色';
  if (s.spread >= 88) return '手绘';
  if (s.spread >= 66) return '晕染';
  if (s.darkRatio >= 0.3) return '延长甲';
  return s.accentShare >= 0.16 ? '晕染' : '纯色';
}

/** 目标分类更看重哪个特征，用于挑一张最接近的图补位 */
function affinityScore(category, s) {
  switch (category) {
    case '法式':
      return s.whiteRatio * 100 + s.accentLight * 20;
    case '纯色':
      return (1 - s.accentSat) * 80 + (1 - s.spread / 120) * 40;
    case '晕染':
      return 80 - Math.abs(s.spread - 72);
    case '手绘':
      return s.spread;
    default:
      return s.darkRatio * 60 + s.accentShare * 40;
  }
}

/**
 * 均衡分类配额：
 *   - 每类至少 2 件，否则筛选栏会出现空标签；
 *   - 单类不超过总数的 1/3，否则瀑布流看起来像只有一种款式。
 * 纯按像素猜，必然有一类会吸走大半；这里只做配额兜底，不改动最贴合的那些。
 */
function balanceCategories(entries) {
  const count = (cat) => entries.filter((e) => e.category === cat).length;
  const cap = Math.max(3, Math.ceil(entries.length / 3));

  // 先补足
  for (const target of REAL_CATEGORIES) {
    let guard = 0;
    while (count(target) < 2 && guard++ < entries.length) {
      const donors = REAL_CATEGORIES.filter((c) => c !== target && count(c) > 2).sort(
        (a, b) => count(b) - count(a),
      );
      if (donors.length === 0) break;
      const pool = entries
        .filter((e) => e.category === donors[0])
        .sort((a, b) => affinityScore(target, b.stats) - affinityScore(target, a.stats));
      if (pool.length === 0) break;
      pool[0].category = target;
    }
  }

  // 再削峰
  for (const donor of [...REAL_CATEGORIES].sort((a, b) => count(b) - count(a))) {
    let guard = 0;
    while (count(donor) > cap && guard++ < entries.length) {
      const target = REAL_CATEGORIES.filter((c) => c !== donor).sort(
        (a, b) => count(a) - count(b),
      )[0];
      if (!target || count(target) >= cap) break;
      // 挑「本来就不太像在这个类里」的那张搬走
      const pool = entries
        .filter((e) => e.category === donor)
        .sort((a, b) => affinityScore(donor, a.stats) - affinityScore(donor, b.stats));
      const pick = pool.find((e) => affinityScore(target, e.stats) > 0) ?? pool[0];
      if (!pick) break;
      pick.category = target;
    }
  }

  return entries;
}

/* ------------------------------ 主流程 ------------------------------ */

const files = (await readdir(SRC_DIR))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.error(`目录里没有图片：${SRC_DIR}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(path.dirname(DATA_FILE), { recursive: true });

/** 读旧清单：以 source 为键，保留人工改过的字段 */
let previous = [];
if (existsSync(DATA_FILE)) {
  try {
    previous = JSON.parse(await readFile(DATA_FILE, 'utf8')).items ?? [];
  } catch {
    console.warn('旧清单解析失败，将重新生成');
  }
}
const prevBySource = new Map(previous.map((it) => [it.source, it]));

let nextSeq =
  previous.reduce((max, it) => {
    const n = Number(String(it.id).replace(/\D/g, ''));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0) + 1;

const items = [];
const titleSeen = new Map();
const bgWord = (s) => (s.cornerL < 0.34 ? '深底' : s.cornerL > 0.72 ? '浅底' : '素底');

for (const file of files) {
  const full = path.join(SRC_DIR, file);
  const optimized = await sharp(full)
    .rotate() // 按 EXIF 转正，手机竖拍照片不会躺倒
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
    .toBuffer({ resolveWithObject: true });

  const stats = await sample(optimized.data);
  const old = prevBySource.get(file);

  const id = old?.id ?? `work-${String(nextSeq++).padStart(2, '0')}`;
  const outName = `${id}.jpg`;
  await writeFile(path.join(OUT_DIR, outName), optimized.data);

  const accentWord = toneName(stats.accentHue, stats.accentSat, stats.accentLight);
  const baseTitle = `${bgWord(stats)}${accentWord}`;

  let title = old?.title;
  if (!title) {
    const n = (titleSeen.get(baseTitle) ?? 0) + 1;
    titleSeen.set(baseTitle, n);
    title = n === 1 ? baseTitle : `${baseTitle} · ${String(n).padStart(2, '0')}`;
  }

  items.push({
    source: file,
    id,
    imageUrl: `/works/${outName}`,
    width: optimized.info.width,
    height: optimized.info.height,
    /** 图片缺失时的兜底底色：主色提亮压饱和，得到柔和的纸感色块 */
    tint: hslToHex(stats.accentHue, Math.min(stats.accentSat, 0.26), 0.9),
    category: old?.category ?? guessCategory(stats),
    title,
    tone: `${accentWord} · ${lightWord(stats.accentLight)}`,
    background: old?.background ?? stats.background,
    summary: old?.summary ?? `${accentWord}甲面，${bgWord(stats)}`,
    /** 调色板仅作参考，方便你自己核对主色 */
    palette: stats.palette,
    stats,
  });
}

balanceCategories(items);

// stats / palette 只用于生成阶段的推断，不进清单
const cleaned = items.map(({ stats, palette, ...rest }) => rest);

await writeFile(
  DATA_FILE,
  JSON.stringify(
    {
      _readme:
        '作品照片清单（由 scripts/import-photos.mjs 生成）。手改 id / title / category / tone / summary 不会被重跑覆盖；删掉对应 source 那条再重跑即可恢复自动值。',
      _generatedFrom: SRC_DIR,
      _updatedAt: new Date().toISOString(),
      count: cleaned.length,
      items: cleaned,
    },
    null,
    2,
  ) + '\n',
);

const byCategory = REAL_CATEGORIES.map(
  (c) => `${c} ${cleaned.filter((i) => i.category === c).length}`,
).join(' · ');

console.log(`导入完成：${cleaned.length} 张 → public/works/`);
console.log(`清单：${path.relative(ROOT, DATA_FILE)}`);
console.log(`分类分布：${byCategory}`);
