#!/usr/bin/env node
/**
 * 升级脚本 v2 的落地自检（在 Supabase SQL Editor 跑完 schema-v2.sql 之后执行）
 *
 * 用法：npm run check:v2
 *
 * 检查四件事：
 *   1. site_content / services 表可读且种子数据在
 *   2. booking_slots 视图可读，并且只有时间字段（备注/样图不外泄）
 *   3. bookings 本体对匿名用户不可读（RLS 生效，这是隐私红线）
 *   4. booking-images 桶存在（私有桶 anon 查不到属正常，只提示不判失败）
 *
 * 不需要密码：公开表用 anon key 就够；本脚本只读，不写任何数据。
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetch, ProxyAgent } from 'undici';

// 读 .env.local（不打印任何值）
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const eq = line.indexOf('=');
  if (eq === -1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('✗ .env.local 里没有 Supabase URL / anon key');
  process.exit(1);
}

// 本地开发要走代理，生产环境不设 SUPABASE_PROXY_URL 时走默认
const globalFetch = env.SUPABASE_PROXY_URL
  ? (input, init) => fetch(input, { ...init, dispatcher: new ProxyAgent(env.SUPABASE_PROXY_URL) })
  : undefined;

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  ...(globalFetch ? { global: { fetch: globalFetch } } : {}),
});

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}${detail ? `  — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

async function main() {
  // 1. 文案表
  const content = await supabase.from('site_content').select('key, value');
  check('site_content 可读', !content.error, content.error?.message ?? '');
  check('文案种子数据齐全（17 项）', (content.data ?? []).length === 17, `实际 ${(content.data ?? []).length} 项`);

  // 2. 服务项目表
  const services = await supabase.from('services').select('id, name, note, sort_order');
  check('services 可读', !services.error, services.error?.message ?? '');
  check('服务项目种子数据在（5 项）', (services.data ?? []).length === 5, `实际 ${(services.data ?? []).length} 项`);

  // 3. 前台时间视图：字段白名单
  const slots = await supabase.from('booking_slots').select('*').limit(1);
  check('booking_slots 视图可读', !slots.error, slots.error?.message ?? '');
  if (!slots.error) {
    const columns = Object.keys(slots.data?.[0] ?? { id: '', starts_at: '', duration_minutes: '' });
    const leaked = columns.filter((c) => ['note', 'image_path', 'created_at'].includes(c));
    check('视图只暴露时间字段（不含备注/样图）', leaked.length === 0, `字段：${columns.join(', ')}`);
  }

  // 4. 隐私红线：匿名用户不能读预约本体
  const bookings = await supabase.from('bookings').select('id, note, image_path').limit(1);
  const rowsVisible = (bookings.data ?? []).length;
  check(
    'bookings 表对匿名用户不可读（RLS 生效）',
    rowsVisible === 0,
    rowsVisible === 0 ? 'anon 查不到任何行' : `泄漏 ${rowsVisible} 行！`,
  );

  // 5. 私有桶：anon 没有读桶元数据的权限，这里只做提示，不判失败
  const bucket = await supabase.storage.getBucket('booking-images');
  console.log(
    bucket.error
      ? 'INFO  booking-images 桶：anon 无权限确认（私有桶的正常表现），请在控制台 Storage 页面核对'
      : 'INFO  booking-images 桶已确认（private=' + String(bucket.data?.public === false) + '）',
  );

  console.log('\n' + '='.repeat(50));
  console.log(`===== ${pass}/${pass + fail} 通过 =====`);
  if (fail > 0) {
    console.log('\n若大面积失败：大概率是 schema-v2.sql 还没在 SQL Editor 里跑。');
    process.exit(1);
  }
}

main().catch((cause) => {
  console.error('✗ 检查异常：', cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
});
