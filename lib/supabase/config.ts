/**
 * Supabase 配置读取的唯一入口
 *
 * 所有地方都从这里拿 URL / key / bucket / 管理员邮箱，避免各处自己拼
 * process.env 导致名字写错一半、线上静默失效。
 *
 * 设计前提：**没配 Supabase 也要能跑**。
 * 前台会回退到 data/artworks.json 的本地数据，/admin 显示配置指引页，
 * 而不是白屏或 500。所以下面 isSupabaseConfigured 是整个功能的总开关。
 */

/** Project URL，例如 https://abcdefgh.supabase.co */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');

/** anon / publishable key。公开可见，安全性靠数据库 RLS 兜底 */
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

/** Storage bucket 名，与 supabase/schema.sql 里创建的要一致 */
export const SUPABASE_BUCKET = (process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? '').trim() || 'nail-images';

/**
 * 唯一允许进入后台的邮箱
 *
 * 小写化后比较，因为 Supabase 返回的 email 大小写不一定和输入一致。
 * 数据库 RLS 策略里有同样的判断（auth.jwt() ->> 'email'），两处必须一致：
 * 只改这里不改 SQL，用户仍然能通过 API 直接写库，属于假的安全。
 */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'usagi520x@gmail.com').trim().toLowerCase();

/** 作品表名 */
export const WORKS_TABLE = 'nail_works';

/** 两个环境变量都齐了才算配置完成 */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

/** 判断某个邮箱是不是管理员 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
