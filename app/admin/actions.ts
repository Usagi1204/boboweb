'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { REAL_CATEGORIES, type Category } from '@/data/portfolio';
import { SUPABASE_BUCKET, SUPABASE_URL, WORKS_TABLE } from '@/lib/supabase/config';
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
