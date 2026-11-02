/**
 * 预约钩子相关的浏览器自检
 *
 * 用无头 Chrome + DevTools 协议真点一遍：
 * 服务项目渲染、底部 CTA、复制按钮状态机、移动端浮层开关、移动/桌面显隐切换。
 * 只依赖 Node 22 自带的 fetch / WebSocket，不装 puppeteer。
 */
const { spawn } = require('node:child_process');
const http = require('node:http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9444;
const PAGE_URL = 'http://127.0.0.1:3000/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(path) {
  return new Promise((resolve, reject) => {
    // 直连 127.0.0.1，绕开系统代理
    const req = http.get({ host: '127.0.0.1', port: DEBUG_PORT, path, timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--disable-extensions',
      '--proxy-server=direct://',
      '--proxy-bypass-list=*',
      '--user-data-dir=/tmp/bobo-probe-profile',
      `--remote-debugging-port=${DEBUG_PORT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let page = null;
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await getJson('/json/list');
      page = list.find((t) => t.type === 'page');
      if (page) break;
    } catch {
      /* 还没起来 */
    }
    await sleep(300);
  }
  if (!page) throw new Error('DevTools 端口未就绪');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true });
  });

  let msgId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  // 带超时的发送：某些域方法在 page target 上不会返回（如 Browser.grantPermissions），
  // 没有超时保护会静默挂死。
  const send = (method, params = {}, timeoutMs = 10000) =>
    new Promise((resolve, reject) => {
      msgId += 1;
      const id = msgId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(method + ' 超时'));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result.value;
  };

  const waitFor = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        /* 页面还没 ready */
      }
      await sleep(250);
    }
    throw new Error(`等待超时：${label}`);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  // 无头 Chrome 默认没有剪贴板权限，也不认为页面处于焦点状态，
  // 不做这两步的话 navigator.clipboard 必然失败，只能测到降级路径。
  // navigator.clipboard 要求页面处于焦点状态，无头模式下必须显式打开
  try {
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }, 4000);
    console.log('已启用焦点模拟');
  } catch (e) {
    console.log('焦点模拟失败：', e.message);
  }
  // 剪贴板权限走 Browser 域；在 page target 上可能不被受理，失败就靠焦点+用户手势
  try {
    await send(
      'Browser.grantPermissions',
      {
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        origin: 'http://127.0.0.1:3000',
      },
      4000,
    );
    console.log('已授予剪贴板权限');
  } catch (e) {
    console.log('授予剪贴板权限失败（改靠焦点 + 点击手势）：', e.message);
  }
  await send('Page.navigate', { url: PAGE_URL });
  await waitFor("document.readyState === 'complete'", '页面加载');
  await waitFor(
    "document.querySelectorAll('[aria-label^=\"查看作品\"]').length > 0",
    '卡片渲染',
  );
  // SSR 的 DOM 先到，React 挂上 fiber 之后点击才有效
  await waitFor(
    "Object.keys(document.querySelector('[role=\"tab\"]') || {}).some(k => k.startsWith('__reactFiber$'))",
    'React hydrate',
  );

  // ---- 1. 服务项目区块 ----
  // 刻意不标价：甲型/长度/加固都会影响报价，写成固定数字反要在店里解释。
  // 所以这里断言的是「价格确实不存在」，而不是「价格是多少」。
  const svc = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.svc-list__row')];
    const section = document.querySelector('#services');
    const text = section ? section.textContent.replace(/\\s+/g, ' ') : '';
    return {
      count: rows.length,
      first: rows[0] ? rows[0].querySelector('.svc-list__name')?.textContent : null,
      last: rows[rows.length - 1] ? rows[rows.length - 1].querySelector('.svc-list__name')?.textContent : null,
      notesFilled: rows.every(r => (r.querySelector('.svc-list__note')?.textContent || '').length > 8),
      priceNodes: rows.filter(r => r.querySelector('.svc-list__price')).length,
      text,
    };
  })()`);
  check('服务项目 5 行', svc.count === 5, `实际 ${svc.count} 行`);
  check('首项为纯色', svc.first === '纯色 / 猫眼', String(svc.first));
  check('每项都有说明', svc.notesFilled === true);
  check('无价格节点', svc.priceNodes === 0, `含价格的项 ${svc.priceNodes}`);
  check('无 ¥ 符号', !/¥/.test(svc.text), svc.text.slice(0, 60));
  check('无金额数字', !/\d+\s*元/.test(svc.text) && !/\d+\s*起/.test(svc.text));

  // ---- 2. 底部 CTA ----
  const cta = await evaluate(`(() => {
    const el = document.querySelector('.booking');
    return {
      exists: !!el,
      title: el?.querySelector('.booking__title')?.textContent,
      lead: el?.querySelector('.booking__lead')?.textContent,
      id: el?.querySelector('.booking__id')?.textContent,
    };
  })()`);
  check('CTA 区块存在', cta.exists);
  check('CTA 标题文案', cta.title === '喜欢某款？', String(cta.title));
  check('CTA 引导文案', cta.lead === '加我微信，告诉我你想做的风格。', String(cta.lead));
  check('CTA 微信号正确', cta.id === 'hbobo1001_', String(cta.id));

  // ---- 3. 全站只保留一个联系方式 ----
  const contactAudit = await evaluate(`(() => {
    const text = document.body.innerText;
    return {
      hasPhone: /1[3-9]\\d{9}|\\d{3}-\\d{4}-\\d{4}/.test(text),
      hasEmail: /[\\w.+-]+@[\\w-]+\\.[\\w.]+/.test(text),
      wechatCount: (text.match(/hbobo1001_/g) || []).length,
      copyBtns: document.querySelectorAll('[aria-label^="复制微信号"]').length,
    };
  })()`);
  check('页面无电话号码', contactAudit.hasPhone === false);
  check('页面无邮箱', contactAudit.hasEmail === false);
    // 页脚的微信号已按需求删掉（2026-11-03）：CTA 与浮层各一次，共 2 次
  check('微信号出现两次（CTA + 浮层），页脚不再重复', contactAudit.wechatCount === 2, `${contactAudit.wechatCount} 次`);
  check('复制按钮 2 处', contactAudit.copyBtns === 2, `${contactAudit.copyBtns} 个`);

  // ---- 4. 复制按钮状态机 ----
  // 无头 Chrome 的 clipboard.readText() 恒返回空串，不能用来断言内容。
  // 改为拦截 writeText，记录业务代码实际写进剪贴板的文本——这才是要验证的东西。
  const copyResult = await evaluate(`(async () => {
    const btn = document.querySelector('.booking .copy-btn');
    if (!btn) return { error: '未找到 CTA 里的复制按钮' };
    const api = navigator.clipboard;
    const orig = api && api.writeText ? api.writeText.bind(api) : null;
    let captured = null;
    if (orig) {
      api.writeText = async (text) => {
        captured = text;
        return orig(text);
      };
    }
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    if (orig) api.writeText = orig;
    return {
      hasApi: !!orig,
      captured,
      before: btn.dataset.state,
      after: btn.dataset.state,
      label: btn.textContent.trim(),
    };
  })()`);
  check('点击后调用剪贴板 API 成功', copyResult.after === 'done', `state=${copyResult.after}`);
  check(
    '写入剪贴板的内容是微信号',
    copyResult.captured === 'hbobo1001_',
    `captured=${JSON.stringify(copyResult.captured)}`,
  );
  check('页面处于安全上下文（有 clipboard API）', copyResult.hasApi === true);

  // 2.2 秒后应自动复位，否则按钮会一直停在「已复制」
  await sleep(2400);
  const resetState = await evaluate("document.querySelector('.booking .copy-btn').dataset.state");
  check('反馈态自动复位', resetState === 'idle', `state=${resetState}`);

  // ---- 4b. 降级路径：clipboard API 不可用时（等同手机走局域网 http 访问）----
  const degradedResult = await evaluate(`(async () => {
    const btn = document.querySelector('.booking .copy-btn');

    // 真正把 clipboard 挪走：delete 对只读访问器无效，必须改原型描述符。
    // 这模拟的是手机通过 http://192.168.x.x 访问时的非安全上下文。
    const proto = Navigator.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'clipboard');
    const hadApi = typeof navigator.clipboard?.writeText === 'function';

    Object.defineProperty(proto, 'clipboard', { value: undefined, configurable: true });
    const apiGone = typeof navigator.clipboard === 'undefined';

    // 记录是否真的走了 execCommand 兜底
    let usedExecCommand = false;
    const origExec = document.execCommand.bind(document);
    document.execCommand = (cmd, ...rest) => {
      if (cmd === 'copy') usedExecCommand = true;
      return origExec(cmd, ...rest);
    };

    btn.click();
    await new Promise(r => setTimeout(r, 500));
    const state = btn.dataset.state;
    const label = btn.querySelector('.copy-btn__text')?.textContent;

    document.execCommand = origExec;
    if (desc) Object.defineProperty(proto, 'clipboard', desc);
    else delete proto.clipboard;

    return { state, label, hadApi, apiGone, usedExecCommand };
  })()`);
  check('成功模拟出无 clipboard API 的环境', degradedResult.apiGone === true);
  check(
    '无 API 时走 execCommand 兜底',
    degradedResult.usedExecCommand === true,
    `usedExecCommand=${degradedResult.usedExecCommand}`,
  );
  check(
    '无 API 时有明确反馈（done 或 manual，不静默失败）',
    degradedResult.state === 'done' || degradedResult.state === 'manual',
    `state=${degradedResult.state} label=${degradedResult.label}`,
  );

  // ---- 5. 移动端浮层 ----
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(400);

  const fabMobile = await evaluate(`(() => {
    const fab = document.querySelector('.wechat-fab');
    const btn = fab?.querySelector('.wechat-fab__btn');
    const panel = fab?.querySelector('.wechat-fab__panel');
    return {
      display: fab ? getComputedStyle(fab).display : null,
      btnVisible: btn ? btn.getBoundingClientRect().width > 0 : false,
      btnBottom: btn ? Math.round(window.innerHeight - btn.getBoundingClientRect().bottom) : null,
      expanded: btn?.getAttribute('aria-expanded'),
      panelOpacity: panel ? getComputedStyle(panel).opacity : null,
      panelId: panel?.id,
      offscreen: panel ? panel.getBoundingClientRect().bottom > window.innerHeight + 4 : null,
    };
  })()`);
  check('移动端浮标可见', fabMobile.display === 'flex', `display=${fabMobile.display}`);
  check('浮标按钮在视口内', fabMobile.btnVisible === true && fabMobile.btnBottom > 0, `距底 ${fabMobile.btnBottom}px`);
  check('浮层默认收起', fabMobile.expanded === 'false' && fabMobile.panelOpacity === '0', `expanded=${fabMobile.expanded} opacity=${fabMobile.panelOpacity}`);

  // 点开
  const fabOpen = await evaluate(`(async () => {
    const btn = document.querySelector('.wechat-fab__btn');
    btn.click();
    await new Promise(r => setTimeout(r, 450));
    const fab = document.querySelector('.wechat-fab');
    const panel = fab.querySelector('.wechat-fab__panel');
    const rect = panel.getBoundingClientRect();
    return {
      expanded: btn.getAttribute('aria-expanded'),
      opacity: getComputedStyle(panel).opacity,
      inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight + 1,
      id: panel.querySelector('.wechat-fab__id')?.textContent?.trim(),
      copyLabel: panel.querySelector('.copy-btn .copy-btn__text')?.textContent,
    };
  })()`);
  check('点击后浮层展开', fabOpen.expanded === 'true' && fabOpen.opacity === '1', `expanded=${fabOpen.expanded}`);
  check('浮层完整在视口内', fabOpen.inViewport === true);
  check('浮层显示微信号', fabOpen.id === 'hbobo1001_', String(fabOpen.id));
  check('浮层复制按钮文案', (fabOpen.copyLabel || '').includes('复制'), String(fabOpen.copyLabel));

  // 点外部收起
  const fabClose = await evaluate(`(async () => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return document.querySelector('.wechat-fab__btn').getAttribute('aria-expanded');
  })()`);
  check('点击外部收起浮层', fabClose === 'false', `expanded=${fabClose}`);

  // ---- 6. 桌面端应隐藏浮标 ----
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);
  const fabDesktop = await evaluate("getComputedStyle(document.querySelector('.wechat-fab')).display");
  check('桌面端浮标隐藏', fabDesktop === 'none', `display=${fabDesktop}`);

  // ---- 7. 旧交互回归：筛选仍然工作 ----
  const filterResult = await evaluate(`(async () => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const french = tabs.find(t => t.textContent.includes('法式'));
    if (!french) return { error: '找不到法式标签' };
    const before = document.querySelectorAll('[aria-label^="查看作品"]').length;
    french.click();
    await new Promise(r => setTimeout(r, 500));
    const after = document.querySelectorAll('[aria-label^="查看作品"]').length;
    const all = tabs.find(t => t.textContent.includes('全部'));
    all.click();
    await new Promise(r => setTimeout(r, 400));
    const restored = document.querySelectorAll('[aria-label^="查看作品"]').length;
    return { before, after, restored };
  })()`);
  check('筛选文式后数量减少', filterResult.after < filterResult.before, `${filterResult.before} -> ${filterResult.after}`);
  check('筛回全部恢复', filterResult.restored === filterResult.before, `恢复为 ${filterResult.restored}`);

  // ---- 8. 锚点导航可达 ----
  const anchors = await evaluate(`(() => ({
    gallery: !!document.querySelector('#gallery'),
    services: !!document.querySelector('#services'),
    about: !!document.querySelector('#about'),
    contact: !!document.querySelector('#contact'),
  }))()`);
  check('四个锚点都存在', anchors.gallery && anchors.services && anchors.about && anchors.contact, JSON.stringify(anchors));

  // ---- 9. 营业信息不重复 ----
  // 只统计真实 DOM（next dev 的 HTML 里没有 RSC flight 数据，但生产产物有，
  // 所以这里用 innerText 而不是页面源码，天然只算可见文本）。
  const dedupe = await evaluate(`(() => {
    const bodyText = document.body.innerText;
    const count = (kw) => bodyText.split(kw).length - 1;
    const facts = document.querySelector('.about__facts');
    const factsText = facts ? facts.innerText : '';
    const bookingText = document.querySelector('.booking')?.innerText ?? '';
    const footerText = document.querySelector('.site-footer')?.innerText ?? '';
    return {
      hours: count('10:00 — 20:00'),
      leadTime: count('建议提前 3 天预约'),
      capacity: count('一天最多三位'),
      inFactsCard: factsText.includes('10:00 — 20:00') && factsText.includes('建议提前 3 天预约'),
      bookingHasHours: bookingText.includes('10:00') || bookingText.includes('提前 3 天'),
      footerHasHours: footerText.includes('10:00') || footerText.includes('提前 3 天'),
      factsItems: facts ? facts.querySelectorAll('li').length : 0,
    };
  })()`);

  check('营业时间全站只出现一次', dedupe.hours === 1, `出现 ${dedupe.hours} 次`);
  check('预约提前量全站只出现一次', dedupe.leadTime === 1, `出现 ${dedupe.leadTime} 次`);
  check('每日接待量全站只出现一次', dedupe.capacity === 1, `出现 ${dedupe.capacity} 次`);
  check('营业信息归口在「到店须知」', dedupe.inFactsCard === true, `到店须知含营业与预约：${dedupe.inFactsCard}`);
  check('预约区块不再重复营业信息', dedupe.bookingHasHours === false, `含营业字样：${dedupe.bookingHasHours}`);
  check('页脚不再重复营业信息', dedupe.footerHasHours === false, `含营业字样：${dedupe.footerHasHours}`);
  check('到店须知为 3 条', dedupe.factsItems === 3, `实际 ${dedupe.factsItems} 条`);

  ws.close();
  chrome.kill('SIGKILL');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
  if (failed.length) {
    console.log('未通过：');
    failed.forEach((f) => console.log(`  - ${f.name}（${f.detail}）`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('探测失败：', err.message);
  process.exit(2);
});
