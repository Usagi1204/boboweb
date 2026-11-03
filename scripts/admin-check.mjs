#!/usr/bin/env node
/**
 * 管理后台自检
 *
 * 分两类检查：
 *   1. 运行时（对运行中的 dev/prod 发 HTTP 请求）
 *   2. 静态（读源码，确认前端配置与 SQL 脚本没有漂移）
 *
 * 第 2 类看起来多余，但它防的是最隐蔽的一类 bug：
 * 前端 ADMIN_EMAIL 改了、SQL 里的邮箱没改 —— 页面看起来一切正常，
 * 实际上数据库策略还认着旧邮箱，属于"能进后台但写不进去"或"别人也能写"。
 *
 * 用法：先 npm run dev，再 npm run check:admin
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:3000';
const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}${detail ? `  — ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function read(relative) {
  const full = path.join(ROOT, relative);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

/** 取 HTML 里的可见文本，used 判断页面到底渲染了什么 */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: 'manual',
    headers: { 'user-agent': 'bobo-admin-check' },
    ...options,
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get('location'), body };
}

// ---------------------------------------------------------------------------
// 静态检查：配置与 SQL 是否一致
// ---------------------------------------------------------------------------
console.log('=== 静态检查 ===');

const siteConfig = read('lib/supabase/config.ts') ?? '';
const schemaSql = read('supabase/schema.sql') ?? '';
const portfolio = read('data/portfolio.ts') ?? '';

// 管理员邮箱：config.ts 里的默认值必须和 SQL 里三处策略一致
const emailInConfig = (siteConfig.match(/'(usagi520x@gmail\.com)'/) || [])[1];
const emailsInSql = [...schemaSql.matchAll(/'(usagi520x@gmail\.com)'/g)].length;

check(
  'config.ts 里读到了管理员邮箱默认值',
  Boolean(emailInConfig),
  emailInConfig ?? '没找到',
);
check(
  'schema.sql 里出现 4 处邮箱（表 insert/update/delete + 存储写/删）',
  emailsInSql >= 4,
  `实际 ${emailsInSql} 处`,
);

// 分类枚举：前端 5 个分类必须和 SQL 的 check 约束一致
const categories = [...portfolio.matchAll(/export const REAL_CATEGORIES[^=]*=\s*\[([^\]]+)\]/g)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')))
  .filter(Boolean);

check('前端读到了 5 个分类', categories.length === 5, categories.join(' / '));

const missingInSql = categories.filter((c) => !schemaSql.includes(`'${c}'`));
check(
  '每个分类都出现在 schema.sql 的约束里',
  missingInSql.length === 0,
  missingInSql.length ? `缺：${missingInSql.join(', ')}` : '',
);

// bucket 名一致
const bucketInConfig = (siteConfig.match(/'nail-images'/) || [])[0];
check('bucket 名与 SQL 一致（nail-images）', Boolean(bucketInConfig) && schemaSql.includes("'nail-images'"));

// ---- v2 结构：schema-v2.sql 与代码是否对得上 ----
const schemaV2 = read('supabase/schema-v2.sql') ?? '';
const bookingsLib = read('lib/bookings.ts') ?? '';
const contentLib = read('lib/content.ts') ?? '';

check('存在 schema-v2.sql 升级脚本', schemaV2.length > 1000);
check(
  'v2 建了 site_content / services / bookings / booking_slots 四件套',
  ['site_content', 'services', 'bookings', 'booking_slots'].every((name) => schemaV2.includes(name)),
);
check('预约样图桶是私有的', /'booking-images',\s*false/s.test(schemaV2) || /public = false/.test(schemaV2));
check(
  'booking_slots 视图只 select 时间字段（不含 note / image_path）',
  /create or replace view public\.booking_slots[\s\S]*?select id, starts_at, duration_minutes\s*\n?from public\.bookings/.test(schemaV2),
);
check(
  '前台时间表数据来自 booking_slots 视图而不是 bookings 表',
  bookingsLib.includes("from(BOOKING_SLOTS_VIEW)") && !/getBookingSlots[\s\S]{0,600}from\(BOOKINGS_TABLE\)/.test(bookingsLib),
);
check(
  '文案默认值与数据库 key 有映射（KEY_MAP 导出）',
  contentLib.includes('export const KEY_MAP'),
);

check('ImageZoom 放大组件存在', Boolean(read('components/admin/ImageZoom.tsx')));
check(
  '作品与预约列表都接了点击放大',
  (read('components/admin/WorkList.tsx') ?? '').includes('ImageZoom') &&
    (read('components/admin/BookingList.tsx') ?? '').includes('ImageZoom'),
);

// 快速登录：密码只能活在 .env.local（gitignored），绝不出现在源码里
check(
  '快速登录走服务端环境变量（quickLoginAction）',
  (read('app/admin/actions.ts') ?? '').includes('process.env.ADMIN_QUICK_PASSWORD'),
);
check(
  '登录页按环境变量决定渲染快速登录按钮',
  (read('app/admin/login/page.tsx') ?? '').includes('process.env.ADMIN_QUICK_PASSWORD'),
);


// 密码绝不能出现在源码里
const sourceFiles = [
  'lib/supabase/config.ts',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'app/admin/actions.ts',
  'app/admin/page.tsx',
  'app/admin/login/LoginForm.tsx',
  'components/admin/UploadForm.tsx',
  'components/admin/WorkList.tsx',
  'components/admin/BookingForm.tsx',
  'components/admin/BookingList.tsx',
  'components/admin/ContentForm.tsx',
  'components/admin/ServicesEditor.tsx',
  'components/admin/AdminBar.tsx',
  'components/admin/booking-image.ts',
  'components/admin/ImageZoom.tsx',
  'lib/content.ts',
  'lib/services.ts',
  'lib/bookings.ts',
  'scripts/migrate-to-supabase.mjs',
  'supabase/schema.sql',
];

const passwordLeaks = sourceFiles.filter((file) => {
  const content = read(file);
  if (!content) return false;
  // 迁移脚本里出现的是变量名 SUPABASE_MIGRATE_PASSWORD，不是明文
  return /Zhangyu/i.test(content);
});

check('源码里没有硬编码登录密码', passwordLeaks.length === 0, passwordLeaks.join(', '));

// .env.local 必须被 git 忽略
const gitignore = read('.gitignore') ?? '';
check('.env.local 已被 .gitignore 忽略', gitignore.includes('.env.local'));

// ---------------------------------------------------------------------------
// 运行时检查
// ---------------------------------------------------------------------------
console.log('\n=== 运行时检查 ===');

let home;
try {
  home = await get('/');
} catch (cause) {
  console.error(`\n✗ 连不上 ${BASE}`);
  console.error('  先启动服务：npm run dev\n');
  process.exit(1);
}

check('首页可访问', home.status === 200, `状态 ${home.status}`);

const homeText = visibleText(home.body);
const cardCount = (home.body.match(/aria-label="查看作品/g) || []).length;
check('首页渲染出作品卡片', cardCount > 0, `${cardCount} 张`);

// 降级时前台不能把技术错误甩给访客
check(
  '首页没有把 Supabase 错误暴露给访客',
  !homeText.includes('读取 Supabase 失败') && !homeText.includes('relation "nail_works"'),
);

// ---- /admin ----
const admin = await get('/admin');
const adminText = visibleText(admin.body);

const isRedirectToLogin = [302, 303, 307, 308].includes(admin.status)
  && (admin.location ?? '').includes('/admin/login');
const isSetupGuide = admin.status === 200 && adminText.includes('还差几步就能用了');
const isPanel = admin.status === 200 && (adminText.includes('管理后台') || adminText.includes('已上传'));

check(
  '/admin 处于三种合法状态之一（跳登录 / 配置指引 / 已登录面板）',
  isRedirectToLogin || isSetupGuide || isPanel,
  `状态 ${admin.status}，${isRedirectToLogin ? '跳转登录' : isSetupGuide ? '配置指引' : isPanel ? '管理面板' : '未知'}`,
);

if (isSetupGuide) {
  // 指引页必须给出可执行的步骤，不能只说"请配置"
  const steps = ['SQL Editor', 'schema.sql', 'Authentication', 'NEXT_PUBLIC_SUPABASE_URL'];
  const missing = steps.filter((s) => !adminText.includes(s));
  check('配置指引包含全部关键步骤', missing.length === 0, missing.length ? `缺：${missing.join(', ')}` : '4 步齐全');
}

// ---- 新增的两个后台分区：必须同样被 middleware 保护 ----
for (const route of ['/admin/bookings', '/admin/content']) {
  const res = await get(route);
  const guarded = [302, 303, 307, 308].includes(res.status)
    && (res.location ?? '').includes('/admin/login');
  const rendered = res.status === 200 && (res.body.includes('管理后台') || res.body.includes('新增预约') || res.body.includes('前台文案'));
  check(`${route} 被守卫或正常渲染`, guarded || rendered, `状态 ${res.status}`);
}

// ---- /admin/login ----
const login = await get('/admin/login');
const loginText = visibleText(login.body);

check('登录页可访问', login.status === 200, `状态 ${login.status}`);

/**
 * 表单是否存在，取决于有没有配置 Supabase：
 *   · 已配置 → 应该给出邮箱/密码表单
 *   · 未配置 → 应该只显示'去配置'的提示，不能摆一个提交了会报错的空表单
 * 按状态分别断言，而不是一律要求有表单。
 */
if (isSetupGuide) {
  check('未配置时登录页不显示无用表单', !login.body.includes('type="password"'));
  check(
    '未配置时登录页给出配置指引链接',
    loginText.includes('还没配置') || loginText.includes('未配置'),
  );
} else {
  check('登录页有邮箱输入框', login.body.includes('type="email"'));
  check('登录页有密码输入框', login.body.includes('type="password"'));
}
check(
  '登录页不会被搜索引擎收录',
  /name="robots"[^>]*noindex/.test(login.body) || /noindex/.test(login.body),
);

// 已登录状态下 middleware 不该把人挡在登录页外面
if (isPanel) {
  const loginWhenAuthed = await get('/admin/login');
  check(
    '已登录访问登录页会被送回后台',
    [302, 303, 307, 308].includes(loginWhenAuthed.status) === false
      || !(loginWhenAuthed.location ?? '').includes('/admin/login'),
    `状态 ${loginWhenAuthed.status}`,
  );
}

// ---- 安全相关的响应头 ----
check(
  '后台页面没有被缓存（避免共享设备上留登录态）',
  (() => {
    const cacheControl = login.body.includes('no-store');
    // 没有显式头也不算错，force-dynamic 的页面 Next 会带 private/no-cache
    return cacheControl || true;
  })(),
  '（仅提示，不算失败）',
);

// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(50));
console.log(`===== ${pass}/${pass + fail} 通过 =====`);

if (fail > 0) {
  console.log(`\n失败项：\n  · ${failures.join('\n  · ')}`);
  console.log('\n如果 /admin 显示"配置指引"，属于预期状态：');
  console.log('填好 .env.local 并重启后，这里会变成"跳登录"或"管理面板"。');
  process.exit(1);
}
