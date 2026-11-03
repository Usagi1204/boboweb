'use server';

import { timingSafeEqual } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { REAL_CATEGORIES, type Category } from '@/data/portfolio';
import { FIELD_BY_KEY } from '@/lib/content';
import {
  BOOKINGS_BUCKET,
  BOOKINGS_TABLE,
  CONTENT_TABLE,
  SERVICES_TABLE,
  SUPABASE_BUCKET,
  SUPABASE_URL,
  WORKS_TABLE,
  ADMIN_EMAIL,
} from '@/lib/supabase/config';
import { checkAdmin, createServerSupabase } from '@/lib/supabase/server';

/**
 * 后台的写操作
 *
 * 全部走 Server Action，而不是在浏览器里直接 insert / delete。原因：
 *   - 权限要在服务端判一次。RLS 配错一个字母，客户端直写就等于没有防护
 *   - 分类、图片地址这类输入要在服务端校验，客户端校验只是体验优化
 *
 * 图片文件本身例外，是浏览器直传 Storage 的（见 UploadForm）：
 * 走服务端中转会撞上 Vercel 的请求体大小限制。
 */

export interface ActionState {
  ok: boolean;
  message: string;
}

/** 从 Supabase 公开地址里还原出 Storage 对象路径 */
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const rest = url.slice(at + marker.length).split('?')[0];
  if (!rest) return null;

  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/** 退出登录 */
export async function signOutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

/**
 * 删除一件作品
 *
 * 顺序是先删文件再删记录：
 * 反过来的话，万一删文件失败，那条记录已经没了，
 * Storage 里就留下一个再也没人引用的孤儿文件。
 */
export async function deleteWorkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) {
    return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  }

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    return { ok: false, message: '缺少作品 id。' };
  }

  const supabase = await createServerSupabase();

  /**
   * 从数据库反查 image_url，而不是相信表单里传来的地址。
   * 表单内容是浏览器可控的，照它删文件等于把"删任意对象"的能力交出去。
   */
  const { data: row, error: readError } = await supabase
    .from(WORKS_TABLE)
    .select('id, image_url')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: `读取作品失败：${readError.message}` };
  }
  if (!row) {
    return { ok: false, message: '这条记录已经不存在了，刷新看看。' };
  }

  const path = storagePathFromUrl(row.image_url);
  if (path) {
    const { error: removeError } = await supabase.storage.from(SUPABASE_BUCKET).remove([path]);
    if (removeError) {
      // 文件删不掉（比如策略没给 delete 权限）不该阻塞删记录，
      // 否则用户点了删除什么都没发生，更让人困惑。留日志便于事后清理。
      console.warn(`[admin] 删除 Storage 对象失败：${path} — ${removeError.message}`);
    }
  }

  const { error: deleteError } = await supabase.from(WORKS_TABLE).delete().eq('id', id);
  if (deleteError) {
    return { ok: false, message: `删除失败：${deleteError.message}` };
  }

  // 前台是 force-dynamic，本来就会重新查；这里再清一次缓存，将来改成 ISR 也不会漏
  revalidatePath('/');
  revalidatePath('/admin');

  return { ok: true, message: '已删除。' };
}

/** 新建作品时，浏览器上传完文件后提交的元数据 */
export interface CreateWorkInput {
  imageUrl: string;
  width: number;
  height: number;
  category: string;
  description: string;
}

/**
 * 写入一条作品记录
 *
 * 只在浏览器已把图片传进 Storage 之后调用。
 * 校验顺序：权限 → 地址归属 → 分类合法 → 描述长度。
 */
export async function createWorkAction(input: CreateWorkInput): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) {
    return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  }

  const { imageUrl, width, height, category, description } = input;

  /**
   * 只接受本项目 nail-images bucket 下的地址。
   * 否则有人可以往表里塞任意外链，前台 next/image 会拒绝渲染，
   * 卡片变成一片兜底色块，还得回来查为什么。
   */
  const expectedPrefix = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  if (!imageUrl.startsWith(expectedPrefix)) {
    return { ok: false, message: '图片地址不属于本项目的 Storage，已拒绝写入。' };
  }

  if (!REAL_CATEGORIES.includes(category as Category)) {
    return { ok: false, message: `分类「${category}」不合法，请从下拉框里选。` };
  }

  const desc = description.trim().slice(0, 200);

  const supabase = await createServerSupabase();

  const { error } = await supabase.from(WORKS_TABLE).insert({
    image_url: imageUrl,
    style_category: category,
    description: desc,
    // 宽高一定要存：瀑布流靠它算宽高比，缺了会先撑成兜底比例再跳变
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  });

  if (error) {
    return { ok: false, message: `保存失败：${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin');

  return { ok: true, message: '上传成功，前台刷新即可看到。' };
}

// ===========================================================================
// 作品编辑
// ===========================================================================

/** 修改作品的分类与描述（图片本身不可换，要换图请删除后重新上传） */
export async function updateWorkAction(input: {
  id: string;
  category: string;
  description: string;
}): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) {
    return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  }

  const id = (input.id ?? '').trim();
  if (!id) {
    return { ok: false, message: '缺少作品 id。' };
  }
  if (!REAL_CATEGORIES.includes(input.category as Category)) {
    return { ok: false, message: `分类「${input.category}」不合法。` };
  }

  const desc = (input.description ?? '').trim().slice(0, 200);

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from(WORKS_TABLE)
    .update({ style_category: input.category, description: desc })
    .eq('id', id);

  if (error) {
    return { ok: false, message: `保存失败：${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true, message: '已保存，前台刷新即可看到。' };
}

// ===========================================================================
// 前台文案
// ===========================================================================

/**
 * 批量保存文案
 *
 * entries 的 key 是数据库里的点分 key（hero.title_a 等），
 * value 为空串时表示「恢复默认」——表里的行被置空，前台读时会回退出厂值。
 */
export async function updateContentAction(
  entries: Record<string, string>,
): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) {
    return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  }

  // 点分 key → 字段名 的白名单校验（与 lib/content.ts 的 KEY_MAP 对应）
  const rows: { key: string; value: string; updated_at: string }[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    if (!FIELD_BY_KEY[key]) {
      return { ok: false, message: `不认识的文案项「${key}」，已拒绝。` };
    }
    const value = (raw ?? '').slice(0, 1000);
    rows.push({ key, value, updated_at: new Date().toISOString() });
  }

  if (rows.length === 0) {
    return { ok: false, message: '没有需要保存的内容。' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from(CONTENT_TABLE).upsert(rows, { onConflict: 'key' });

  if (error) {
    return { ok: false, message: `保存失败：${error.message}（是不是还没跑 schema-v2.sql？）` };
  }

  revalidatePath('/');
  revalidatePath('/admin/content');
  return { ok: true, message: '文案已保存，前台刷新即可看到。' };
}

// ===========================================================================
// 服务项目
// ===========================================================================

export interface ServiceInput {
  id?: string;
  name: string;
  note: string;
  sortOrder: number;
}

function validateService(input: ServiceInput): string | null {
  if (!input.name.trim()) return '项目名称不能为空。';
  if (input.name.trim().length > 30) return '项目名称太长了（30 字以内）。';
  if (input.note.trim().length > 120) return '说明太长了（120 字以内）。';
  if (!Number.isFinite(input.sortOrder)) return '排序号不是数字。';
  return null;
}

export async function createServiceAction(input: ServiceInput): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };

  const invalid = validateService(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from(SERVICES_TABLE).insert({
    name: input.name.trim(),
    note: input.note.trim(),
    sort_order: Math.round(input.sortOrder),
  });

  if (error) {
    return { ok: false, message: `保存失败：${error.message}（是不是还没跑 schema-v2.sql？）` };
  }

  revalidatePath('/');
  revalidatePath('/admin/content');
  return { ok: true, message: '已添加。' };
}

export async function updateServiceAction(input: ServiceInput): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  if (!input.id) return { ok: false, message: '缺少项目 id。' };

  const invalid = validateService(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from(SERVICES_TABLE)
    .update({
      name: input.name.trim(),
      note: input.note.trim(),
      sort_order: Math.round(input.sortOrder),
    })
    .eq('id', input.id);

  if (error) {
    return { ok: false, message: `保存失败：${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin/content');
  return { ok: true, message: '已保存。' };
}

export async function deleteServiceAction(id: string): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  if (!id) return { ok: false, message: '缺少项目 id。' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from(SERVICES_TABLE).delete().eq('id', id);

  if (error) {
    return { ok: false, message: `删除失败：${error.message}` };
  }

  revalidatePath('/');
  revalidatePath('/admin/content');
  return { ok: true, message: '已删除。' };
}

// ===========================================================================
// 预约
// ===========================================================================

export interface BookingInput {
  /** ISO 时间字符串（带时区） */
  startsAt: string;
  durationMinutes: number;
  note: string;
  /**
   * 样图在 booking-images 桶里的对象路径。
   * undefined = 不改动（仅更新时），null = 移除样图，string = 新样图。
   */
  imagePath?: string | null;
}

const DURATION_MIN = 30;
const DURATION_MAX = 8 * 60;

function validateBooking(input: BookingInput): string | null {
  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) return '预约时间格式不对。';
  if (!Number.isFinite(input.durationMinutes)) return '时长不是数字。';
  if (input.durationMinutes < DURATION_MIN || input.durationMinutes > DURATION_MAX) {
    return `时长要在 ${DURATION_MIN} 分钟到 ${DURATION_MAX / 60} 小时之间。`;
  }
  if (input.note.length > 200) return '备注太长了（200 字以内）。';
  return null;
}

/** 删除 booking-images 桶里的对象，失败只记日志不阻塞流程 */
async function removeBookingImage(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage.from(BOOKINGS_BUCKET).remove([path]);
  if (error) {
    console.warn(`[admin] 删除预约样图失败 ${path}：${error.message}`);
  }
}

export async function createBookingAction(input: BookingInput): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };

  const invalid = validateBooking(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from(BOOKINGS_TABLE).insert({
    starts_at: new Date(input.startsAt).toISOString(),
    duration_minutes: Math.round(input.durationMinutes),
    note: input.note.trim() || null,
    image_path: input.imagePath ?? null,
  });

  if (error) {
    // 记录没写进去，刚传的样图要回收，避免孤儿文件
    if (input.imagePath) await removeBookingImage(input.imagePath);
    return { ok: false, message: `保存失败：${error.message}（是不是还没跑 schema-v2.sql？）` };
  }

  revalidatePath('/');
  revalidatePath('/admin/bookings');
  return { ok: true, message: '预约已添加。' };
}

export async function updateBookingAction(
  id: string,
  input: BookingInput,
): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  if (!id) return { ok: false, message: '缺少预约 id。' };

  const invalid = validateBooking(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createServerSupabase();

  // 换图/删图时要拿到旧路径，更新成功后把旧文件删掉
  let oldImagePath: string | null = null;
  if (input.imagePath !== undefined) {
    const { data: row } = await supabase
      .from(BOOKINGS_TABLE)
      .select('image_path')
      .eq('id', id)
      .maybeSingle();
    oldImagePath = (row?.image_path as string | null) ?? null;
  }

  const patch: Record<string, unknown> = {
    starts_at: new Date(input.startsAt).toISOString(),
    duration_minutes: Math.round(input.durationMinutes),
    note: input.note.trim() || null,
  };
  if (input.imagePath !== undefined) {
    patch.image_path = input.imagePath;
  }

  const { error } = await supabase.from(BOOKINGS_TABLE).update(patch).eq('id', id);

  if (error) {
    return { ok: false, message: `保存失败：${error.message}` };
  }

  // 更新成功了再清理被替换/移除的旧样图
  if (input.imagePath !== undefined && oldImagePath && oldImagePath !== input.imagePath) {
    await removeBookingImage(oldImagePath);
  }

  revalidatePath('/');
  revalidatePath('/admin/bookings');
  return { ok: true, message: '预约已更新。' };
}

export async function deleteBookingAction(id: string): Promise<ActionState> {
  const guard = await checkAdmin();
  if (!guard.ok) return { ok: false, message: '登录状态已失效，请重新登录后再试。' };
  if (!id) return { ok: false, message: '缺少预约 id。' };

  const supabase = await createServerSupabase();

  // 先查 image_path，删记录后顺手删样图文件
  const { data: row } = await supabase
    .from(BOOKINGS_TABLE)
    .select('image_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from(BOOKINGS_TABLE).delete().eq('id', id);
  if (error) {
    return { ok: false, message: `删除失败：${error.message}` };
  }

  if (row?.image_path) {
    await removeBookingImage(row.image_path as string);
  }

  revalidatePath('/');
  revalidatePath('/admin/bookings');
  return { ok: true, message: '预约已删除。' };
}

// ===========================================================================
// 快速登录（仅本地开发）
// ===========================================================================

/**
 * 一键登录：密码只存在于服务器环境变量 ADMIN_QUICK_PASSWORD 里，
 * 不进代码仓库、不进浏览器 bundle。
 *
 * 安全边界：本地 .env.local 配了这个变量，登录页才会出现「快速登录」按钮；
 * 线上（Vercel）故意不配 —— 公开站点上一个能绕过密码的按钮
 * 等于把后台对所有人开放。想在哪儿用就在哪儿的服务器环境配，别提交到仓库。
 */
/** 常量时间比较，防时序侧信道（虽然是个人站，好习惯不嫌多） */
function secretMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function quickLoginAction(key: string): Promise<ActionState> {
  const password = process.env.ADMIN_QUICK_PASSWORD;
  const expectedKey = process.env.ADMIN_QUICK_KEY;
  if (!password || !expectedKey) {
    return { ok: false, message: '快速登录未启用（服务器缺少 ADMIN_QUICK_PASSWORD / ADMIN_QUICK_KEY）。' };
  }

  // 密令是公开网址里的唯一凭证，服务端必须再验一次 ——
  // 不能只靠「按钮没渲染」，任何人都能直接调 server action
  if (!secretMatches(key ?? '', expectedKey)) {
    return { ok: false, message: '密令不对。请从保存的书签进入。' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });

  if (error) {
    return {
      ok: false,
      message:
        '快速登录失败：ADMIN_QUICK_PASSWORD 和 Supabase 账号密码不一致，请核对服务器环境变量。',
    };
  }

  return { ok: true, message: '' };
}
