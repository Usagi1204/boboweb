/**
 * 生成美甲作品集占位图（纯 Node，无第三方依赖）
 *
 * 输出：public/placeholders/nail-01.png ... nail-18.png
 *
 * 为什么自己生成 PNG：
 * 1. 不依赖外网（模板原本用 Unsplash 外链，离线或图片限流时会白屏）
 * 2. 尺寸/宽高比可控，方便验证瀑布流错落效果
 * 3. 后续换成真实照片时，只要替换 data/portfolio.ts 里的 imageUrl 即可
 *
 * 用法：npm run placeholders
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'placeholders');

/* ---------------- PNG 编码 ---------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** 把 RGB 像素数组编码为 PNG Buffer */
function encodePng(width, height, rgb) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 每行前加一个 filter byte(0 = None)
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- 图像绘制 ---------------- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
// smoothstep，让渐变过渡更柔和
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * 绘制一张抽象“甲面”图：
 * - 对角线双色渐变打底
 * - 中央椭圆高光（模拟甲面反光）
 * - 可选斜向细纹（模拟手绘笔触）
 * - 轻微暗角，让图片有层次
 */
function renderArt(width, height, { from, to, angle = 35, highlight = 0.5, stripes = 0, vignette = 0.28 }) {
  const c1 = hexToRgb(from);
  const c2 = hexToRgb(to);
  const buf = Buffer.alloc(width * height * 3);

  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const maxProj = Math.abs(width * dx) + Math.abs(height * dy);

  const cx = width / 2;
  const cy = height * 0.46;
  const rx = width * 0.34;
  const ry = height * 0.3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 基础渐变
      const proj = (x * dx + y * dy) / maxProj;
      let t = smooth(proj);
      let r = lerp(c1[0], c2[0], t);
      let g = lerp(c1[1], c2[1], t);
      let b = lerp(c1[2], c2[2], t);

      // 椭圆高光
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      const glow = Math.pow(clamp01(1 - d), 2.2) * highlight;
      r = lerp(r, 255, glow * 0.75);
      g = lerp(g, 252, glow * 0.75);
      b = lerp(b, 250, glow * 0.75);

      // 斜向细纹（手绘/大理石质感）
      if (stripes > 0) {
        const s = Math.sin((x * 0.06 + y * 0.14) * stripes) * 0.5 + 0.5;
        const amp = 10 * stripes * 0.4;
        r = clamp255(r + (s - 0.5) * amp);
        g = clamp255(g + (s - 0.5) * amp);
        b = clamp255(b + (s - 0.5) * amp);
      }

      // 暗角
      const vx = (x - width / 2) / (width / 2);
      const vy = (y - height / 2) / (height / 2);
      const vd = Math.sqrt(vx * vx + vy * vy) / Math.SQRT2;
      const v = 1 - vignette * Math.pow(clamp01(vd), 2);
      r *= v;
      g *= v;
      b *= v;

      const i = (y * width + x) * 3;
      buf[i] = r | 0;
      buf[i + 1] = g | 0;
      buf[i + 2] = b | 0;
    }
  }
  return buf;
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/* ---------------- 18 张占位图配置 ---------------- */
// 宽高比刻意做成 3:4 / 4:5 / 1:1 / 4:3 / 9:16 混排，检验瀑布流是否真的错落
const SPECS = [
  { w: 720, h: 960, from: '#E8C4C4', to: '#B76E79', angle: 30, highlight: 0.6 },
  { w: 720, h: 720, from: '#F3E3D3', to: '#C9A227', angle: 60, highlight: 0.45, stripes: 0.6 },
  { w: 720, h: 900, from: '#1F1B1A', to: '#4A3B38', angle: 45, highlight: 0.35 },
  { w: 720, h: 1080, from: '#F6EFEA', to: '#D9B8A6', angle: 20, highlight: 0.55 },
  { w: 720, h: 800, from: '#C9D9D3', to: '#6E8B84', angle: 75, highlight: 0.5, stripes: 0.35 },
  { w: 720, h: 960, from: '#EAD7E6', to: '#8C6E9B', angle: 40, highlight: 0.5 },
  { w: 720, h: 960, from: '#F7DFD3', to: '#E08B7A', angle: 15, highlight: 0.4, stripes: 0.8 },
  { w: 720, h: 540, from: '#FBF3EC', to: '#C08C7B', angle: 65, highlight: 0.5 },
  { w: 720, h: 1000, from: '#2A2320', to: '#C9A227', angle: 50, highlight: 0.3 },
  { w: 720, h: 900, from: '#EFDCDC', to: '#9C6B78', angle: 25, highlight: 0.6, stripes: 0.3 },
  { w: 720, h: 720, from: '#E4EDE9', to: '#7E9E96', angle: 85, highlight: 0.45, stripes: 0.55 },
  { w: 720, h: 1080, from: '#F8E9E2', to: '#B98A86', angle: 35, highlight: 0.5 },
  { w: 720, h: 880, from: '#DCC3B2', to: '#6B4A3F', angle: 10, highlight: 0.4, stripes: 0.7 },
  { w: 720, h: 960, from: '#F0E4F2', to: '#7A5C93', angle: 55, highlight: 0.5 },
  { w: 720, h: 640, from: '#FBF6F0', to: '#D8C3A5', angle: 70, highlight: 0.45, stripes: 0.4 },
  { w: 720, h: 960, from: '#EEDCD5', to: '#8E5B52', angle: 40, highlight: 0.55 },
  { w: 720, h: 900, from: '#20211F', to: '#5E6460', angle: 20, highlight: 0.35, stripes: 0.5 },
  { w: 720, h: 760, from: '#F6E7E0', to: '#C4677B', angle: 45, highlight: 0.55 },
];

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  SPECS.forEach((spec, idx) => {
    const name = `nail-${String(idx + 1).padStart(2, '0')}.png`;
    const rgb = renderArt(spec.w, spec.h, spec);
    const png = encodePng(spec.w, spec.h, rgb);
    writeFileSync(join(OUT_DIR, name), png);
    console.log(`✓ ${name}  ${spec.w}x${spec.h}  ${(png.length / 1024).toFixed(1)} KB`);
  });

  console.log(`\n共生成 ${SPECS.length} 张占位图 → public/placeholders/`);
}

main();
