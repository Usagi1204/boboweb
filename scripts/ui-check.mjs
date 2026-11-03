/**
 * 无头浏览器冒烟测试
 * ------------------------------------------------------------------
 * 页面上的交互（筛选、灯箱、键盘、兜底色块）没法靠 curl 验证，
 * 这里用本机 Chrome 的 DevTools 协议真点一遍，跑完打印 PASS / FAIL。
 *
 * 用法：
 *   npm run check:ui            # 默认测 http://127.0.0.1:3000
 *   npm run check:ui -- 3001    # 指定端口
 *
 * 依赖：本机装有 Google Chrome；Node ≥ 22（用到全局 WebSocket / fetch）。
 * 找不到 Chrome 时直接跳过，不判失败。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = Number(process.argv[2] || 3000);
const URL = `http://127.0.0.1:${PORT}/`;
const DEBUG_PORT = 9333;
const PROFILE = '/tmp/bobo-chrome-profile';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.log('未找到 Chrome，跳过 UI 冒烟测试。');
  process.exit(0);
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —— ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ 启动浏览器 ------------------------------ */

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--window-size=1440,1400',
    `--user-data-dir=${PROFILE}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws;
let msgId = 0;
const pending = new Map();

function cleanup() {
  try {
    ws?.close();
  } catch {}
  try {
    chrome.kill('SIGKILL');
  } catch {}
}

const watchdog = setTimeout(() => {
  console.log('WATCHDOG: 90 秒未跑完，强制退出');
  cleanup();
  process.exit(2);
}, 90000);

/** 等 DevTools 端口起来，拿到页面 target 的 ws 地址 */
async function waitForTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('DevTools 端口没起来');
}

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/** 在页面里执行一段表达式，返回其值 */
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description || '页面脚本报错');
  }
  return result.value;
}

/** 等一个条件成立（渲染是异步的） */
async function waitFor(expression, label, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true;
    } catch {}
    await sleep(150);
  }
  throw new Error(`等待超时：${label}`);
}

/** 点一个元素（用原生事件，兼容 React 合成事件） */
const clickExpr = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
})()`;

/** 按文本找筛选标签并点击 */
const clickTabExpr = (label) => `(() => {
  const tab = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.startsWith(${JSON.stringify(label)}));
  if (!tab) return false;
  tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
})()`;

const CARD_COUNT = 'document.querySelectorAll(\'[aria-label^="查看作品"]\').length';

// SSR 出来的 DOM 里已经有卡片，但 React 还没 hydrate 时点击是无效的。
// 等到节点上挂上 __reactFiber（React 18/19 的内部标记）再开始交互。
const HYDRATED =
  'Object.keys(document.querySelector(\'[role="tab"]\') || {}).some(k => k.startsWith("__reactFiber"))';

/* ------------------------------ 测试主体 ------------------------------ */

try {
  const wsUrl = await waitForTarget();
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL });

  await waitFor(`${CARD_COUNT} > 0`, '首页卡片渲染');
  await waitFor(HYDRATED, 'React 完成 hydrate', 15000);

  /* 1. 首屏 */
  const total = await evaluate(CARD_COUNT);
  record('首屏渲染 23 张作品卡片', total === 23, `实际 ${total}`);

  const tagline = await evaluate(
    'document.querySelector("[class*=tagline]")?.textContent?.trim() || ""',
  );
  record('画廊顶部有自我介绍', tagline.length > 0, tagline);

  const imgAudit = await evaluate(`(() => {
    const imgs = [...document.querySelectorAll("img")];
    return {
      total: imgs.length,
      sizes: imgs.filter(i => i.getAttribute("sizes")).length,
      optimized: imgs.filter(i => i.src.includes("/_next/image")).length,
    };
  })()`);
    if (imgAudit.optimized === 0) {
    // 本地开发（设了 SUPABASE_PROXY_URL）关闭了优化器，img 直连 Supabase，
    // 没有 sizes/srcSet 是预期行为；生产环境（优化器开启）仍要求带 sizes
    record('图片加载策略明确（直连或带 sizes）', imgAudit.total >= 20, `${imgAudit.total} 张直连`);
  } else {
    record('图片都带 sizes 属性', imgAudit.sizes >= 20, `${imgAudit.sizes} 张`);
  }

  const altOk = await evaluate(
    '[...document.querySelectorAll(\'[aria-label^="查看作品"] img\')].every(i => /^美甲作品：/.test(i.alt))',
  );
  record('alt 格式为「美甲作品：分类，描述」', altOk === true);

  /* 1b. Hero 轮播：候选 8 张 + 每 5 秒自动换 */
  const carousel = await evaluate(`(() => {
    const slides = [...document.querySelectorAll('.hero-carousel__slide')];
    return { total: slides.length, active: slides.findIndex(s => s.classList.contains('is-active')) };
  })()`);
  // 分批挂载：首屏只挂 2 张避免抢带宽，空闲后补齐到 8 张
  record('Hero 首屏只挂前 2 张（避免首屏抢带宽）', carousel.total >= 1 && carousel.total <= 3, `${carousel.total} 张`);

  let carouselFull = false;
  try {
    await waitFor(
      `document.querySelectorAll('.hero-carousel__slide').length === 8`,
      'Hero 空闲后补齐 8 张',
      6000,
    );
    carouselFull = true;
  } catch {}
  record('Hero 空闲后补齐全部候选图', carouselFull);

  let carouselChanged = false;
  try {
    await waitFor(
      `(() => {
        const slides = [...document.querySelectorAll('.hero-carousel__slide')];
        return slides.findIndex(s => s.classList.contains('is-active')) !== ${carousel.active};
      })()`,
      'Hero 5 秒后自动切换',
      8000,
    );
    carouselChanged = true;
  } catch {}
  record('Hero 每 5 秒自动随机切换', carouselChanged);

  /* 2. 筛选 */
  await evaluate(clickTabExpr('法式'));
  await waitFor(`${CARD_COUNT} === 4`, '筛选到「法式」应剩 4 张');
  const frenchOnly = await evaluate(
    '[...document.querySelectorAll(\'[aria-label^="查看作品"] [class*=chip]\')].every(c => c.textContent === "法式")',
  );
  record('切到「法式」只剩 4 张且分类一致', frenchOnly === true);

  /* 3. 灯箱 */
  await evaluate(clickExpr('[aria-label^="查看作品"]'));
  await waitFor('!!document.querySelector(\'[role="dialog"][aria-modal="true"]\')', '灯箱打开');
  const title1 = await evaluate('document.querySelector(\'[role="dialog"][aria-modal="true"] h3\')?.textContent || ""');
  record('点卡片能打开灯箱', title1.length > 0, `标题：${title1}`);

  const metaLabels = await evaluate(
    '[...document.querySelectorAll(\'[role="dialog"][aria-modal="true"] dt\')].map(d => d.textContent).join("/")',
  );
  // Supabase 行没有 tone 字段，Lightbox 会按设计跳过「主色调」行，只要求耗时必在
  record('灯箱元信息含常规耗时', /耗时/.test(metaLabels), metaLabels);

  const lightboxAlt = await evaluate(
    // 取 figure 里的正式大图；预取层（.preload）里的图 alt 为空，不能算数
    'document.querySelector(\'[role="dialog"][aria-modal="true"] figure img\')?.getAttribute("alt") || ""',
  );
  record('灯箱大图 alt 也是完整描述', /^美甲作品：/.test(lightboxAlt), lightboxAlt);

  const controlZ = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const close = dialog.querySelector('button[aria-label="关闭大图"]');
    const next = dialog.querySelector('button[aria-label="下一张"]');
    return {
      close: Number(getComputedStyle(close).zIndex) || 0,
      next: Number(getComputedStyle(next).zIndex) || 0,
    };
  })()`);
  record('关闭键与翻页键层级在图片之上', controlZ.close >= 2 && controlZ.next >= 2, JSON.stringify(controlZ));

  /* 4. 键盘翻页 + Esc */
  await evaluate(
    'window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))',
  );
  await sleep(400);
  const title2 = await evaluate('document.querySelector(\'[role="dialog"][aria-modal="true"] h3\')?.textContent || ""');
  record('→ 键翻到下一张', title2.length > 0 && title2 !== title1, `${title1} → ${title2}`);

  /* 4b. 触屏左右滑动翻页（移动端主要翻页方式） */
  const swipeExpr = `(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return false;
    const mk = (x) => new Touch({ identifier: 1, target: dialog, clientX: x, clientY: 420 });
    dialog.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(300)], changedTouches: [mk(300)], targetTouches: [mk(300)] }));
    dialog.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [mk(100)], targetTouches: [] }));
    return true;
  })()`;
  await evaluate(swipeExpr);
  await sleep(400);
  const title3 = await evaluate('document.querySelector(\'[role="dialog"][aria-modal="true"] h3\')?.textContent || ""');
  record('左滑切到下一张', title3.length > 0 && title3 !== title2, `${title2} → ${title3}`);

  await evaluate(
    'window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))',
  );
  await waitFor('!document.querySelector(\'[role="dialog"][aria-modal="true"]\')', 'Esc 关闭灯箱');
  record('Esc 能关闭灯箱', true);

  /* 5. 回到全部 */
  await evaluate(clickTabExpr('全部'));
  await waitFor(`${CARD_COUNT} === 23`, '回到「全部」应恢复 23 张');
  record('筛选可还原到全部 23 张', true);

  const overflowRestored = await evaluate('document.body.style.overflow === ""');
  record('关闭灯箱后背景滚动已恢复', overflowRestored === true);
} catch (error) {
  record('测试执行', false, error.message);
} finally {
  clearTimeout(watchdog);
  cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length === 0 ? 0 : 1);
