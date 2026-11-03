import { BOOKINGS_BUCKET } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';

/**
 * 预约样图的上传助手（浏览器直传 booking-images 私有桶）
 *
 * 与作品图同一个直传模式：文件不过服务端（Vercel 请求体限制），
 * 元数据（booking 记录）随后通过 Server Action 写入，服务端再校验权限。
 */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

function extensionOf(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/avif') return 'avif';
  return 'jpg';
}

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

export async function uploadBookingImage(file: File): Promise<UploadResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, message: '只支持 JPG / PNG / WebP / AVIF 四种格式。' };
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `这张 ${mb} MB，超过 10 MB 上限。` };
  }

  const supabase = getBrowserSupabase();
  const objectPath = `${crypto.randomUUID()}.${extensionOf(file)}`;

  const { error } = await supabase.storage.from(BOOKINGS_BUCKET).upload(objectPath, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    return { ok: false, message: `样图上传失败：${error.message}` };
  }

  return { ok: true, path: objectPath };
}

/** 上传失败回滚：记录没建成时把已传的图删掉，不留孤儿文件 */
export async function removeBookingImageFile(path: string): Promise<void> {
  const supabase = getBrowserSupabase();
  await supabase.storage.from(BOOKINGS_BUCKET).remove([path]);
}
