#!/usr/bin/env node
/**
 * 把本地作品迁移到 Supabase
 *
 * 做三件事：
 *   1. 逐张上传 public/works/*.jpg 到 nail-images 桶
 *   2. 把元数据写进 nail_works 表
 *   3. created_at 按原顺序递减排布，保证前台倒序展示后仍是从 work-01 开始
 *
 * 幂等：图片用 upsert（覆盖同名对象），记录按 image_url 判重，
 * 重复跑不会产生重复行，也不会打断。
 *
 * 认证方式用"邮箱 + 密码登录"，不用 service_role key ——
 * 少一个高危密钥，而且能顺带验证 RLS 策略是否真的生效。
 * 凭据只从环境变量读，不落盘、不打印。
 *
 * 网络说明：.env.local 里设 SUPABASE_PROXY_URL=http://127.0.0.1:<代理端口>
 * 时走代理（境内直连 supabase.co 会被重置，Node 22 自带代理支持实测无效，
 * 须用 undici ProxyAgent）；不设置则直连（海外服务器场景）。
 *
 * 上传体说明：必须传 Uint8Array 而不是 Blob。
 * storage-js 在 Node 下检测到 Blob 会把它包进 FormData（字段名为空字符串），
 * 经 undici fetch 做 multipart 序列化时 content-type 会丢成 text/plain，
 * 被桶的 MIME 白名单拒掉；Uint8Array 走原始 body + 显式 content-type 头，最可靠。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');

/** 极简 .env 解析：不引 dotenv，少一个依赖 */
function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;

  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // 去掉成对的引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnvFile(ENV_FILE);
const env = (key) => (process.env[key] ?? fileEnv[key] ?? '').trim();

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const BUCKET = env('NEXT_PUBLIC_SUPABASE_BUCKET') || 'nail-images';
const EMAIL = env('SUPABASE_MIGRATE_EMAIL') || env('ADMIN_EMAIL');
const PASSWORD = env('SUPABASE_MIGRATE_PASSWORD');
const TABLE = 'nail_works';

function die(message, hint) {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

// ---- 前置检查：缺什么就说清楚缺什么，别让人对着空白报错猜 ----

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  die(
    '缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    '在 .env.local 里填好（可参考 .env.example），或确认文件在项目根目录。',
  );
}

if (!EMAIL || !PASSWORD) {
  die(
    '缺少迁移账号',
    '在 .env.local 加上：\n    SUPABASE_MIGRATE_EMAIL=usagi520x@gmail.com\n    SUPABASE_MIGRATE_PASSWORD=你的密码\n  跑完记得删掉这两行。',
  );
}

const artworksPath = path.join(ROOT, 'data', 'artworks.json');
if (!fs.existsSync(artworksPath)) {
  die('找不到 data/artworks.json', '这个文件是从 ~/Desktop/Photo 导入照片时生成的。');
}

const items = JSON.parse(fs.readFileSync(artworksPath, 'utf8')).items ?? [];
if (items.length === 0) {
  die('data/artworks.json 里没有作品');
}

// ---- 可选代理：SUPABASE_PROXY_URL 设置了就走它 ----

const PROXY_URL = env('SUPABASE_PROXY_URL');
const proxiedFetch = PROXY_URL
  ? ((input, init) => undiciFetch(input, { ...init, dispatcher: new ProxyAgent(PROXY_URL) }))
  : undefined;

if (PROXY_URL) {
  console.log(`网络：经代理 ${PROXY_URL}`);
} else {
  console.log('网络：直连（未设置 SUPABASE_PROXY_URL）');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(proxiedFetch ? { global: { fetch: proxiedFetch } } : {}),
});

console.log(`\n准备迁移 ${items.length} 件作品到 ${SUPABASE_URL}\n`);

// ---- 1. 登录 ----
process.stdout.write('登录… ');
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});

if (authError) {
  die(`登录失败：${authError.message}`, '检查邮箱密码，以及这个账号是否已在 Supabase Authentication → Users 里创建并确认。');
}

if (!auth.user) {
  die('登录成功但没拿到用户信息', '账号可能被禁用了，去 Supabase 控制台看一下。');
}

console.log(`ok（${auth.user.email}）`);

// ---- 2. 读出已有记录，用于判重 ----

const { data: existingRows, error: readError } = await supabase
  .from(TABLE)
  .select('image_url');

if (readError) {
  die(
    `读取 ${TABLE} 失败：${readError.message}`,
    '表还没建？先在 SQL Editor 里跑 supabase/schema.sql。',
  );
}

const existing = new Set((existingRows ?? []).map((row) => row.image_url));
console.log(`已有记录：${existing.size} 条\n`);

/**
 * created_at 排布
 *
 * 前台按倒序展示，希望 work-01 在最前面，
 * 所以让 work-01 的时间最新，往后依次早一分钟。
 * 这样无论迁移多少次，顺序都稳定。
 */
const base = Date.now();

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (let index = 0; index < items.length; index += 1) {
  const item = items[index];
  const label = `[${String(index + 1).padStart(2, '0')}/${items.length}] ${item.id}`;

  // /works/work-01.jpg → public/works/work-01.jpg
  const relative = item.imageUrl.replace(/^\//, '');
  const absolute = path.join(ROOT, 'public', relative);

  if (!fs.existsSync(absolute)) {
    console.log(`${label}  ✗ 本地文件不存在：public/${relative}`);
    failed += 1;
    continue;
  }

  // 对象名保持原名，方便以后在 Supabase 控制台里对着找
  const objectPath = relative.replace(/^works\//, 'works/');

  // Uint8Array 而非 Blob，见文件头"上传体说明"
  const bytes = new Uint8Array(fs.readFileSync(absolute));

  // upsert：重跑时覆盖同名对象，不会因为"已存在"失败
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });

  if (uploadError) {
    console.log(`${label}  ✗ 上传失败：${uploadError.message}`);
    failed += 1;
    continue;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  if (existing.has(publicUrl)) {
    console.log(`${label}  · 记录已存在，跳过`);
    skipped += 1;
    continue;
  }

  const { error: insertError } = await supabase.from(TABLE).insert({
    image_url: publicUrl,
    style_category: item.category,
    description: item.summary,
    width: item.width,
    height: item.height,
    created_at: new Date(base - index * 60_000).toISOString(),
  });

  if (insertError) {
    console.log(`${label}  ✗ 写库失败：${insertError.message}`);
    failed += 1;
    continue;
  }

  console.log(`${label}  ✓ ${item.category} · ${item.width}×${item.height}`);
  uploaded += 1;
}

console.log('\n' + '─'.repeat(48));
console.log(`新上传 ${uploaded} 件 · 跳过 ${skipped} 件 · 失败 ${failed} 件`);

if (failed > 0) {
  console.log('\n有失败项。常见原因：');
  console.log('  · Storage 策略没建 → 重跑 supabase/schema.sql');
  console.log('  · 登录邮箱和 RLS 里的邮箱不一致 → 检查 ADMIN_EMAIL 与 SQL 第 2、4 节');
  process.exit(1);
}

// ---- 3. 复核：确认能读回来 ----

const { count, error: countError } = await supabase
  .from(TABLE)
  .select('id', { count: 'exact', head: true });

if (!countError) {
  console.log(`\n库里现有 ${count} 条记录。打开前台刷新即可看到。`);
}

console.log('\n迁移完成。记得把 .env.local 里的 SUPABASE_MIGRATE_PASSWORD 删掉。\n');
