import { BOOKING_SLOTS_VIEW, BOOKINGS_BUCKET, BOOKINGS_TABLE, isSupabaseConfigured } from './supabase/config';
import { createServerSupabase } from './supabase/server';

/**
 * 预约数据源
 *
 * 两条完全不同的读取路径，对应「前台只看时间 / 后台看全部」的需求：
 *
 *   1. getBookingSlots() —— 前台「预约时间表」
 *      走 booking_slots 视图，只有 id / starts_at / duration_minutes 三列，
 *      备注和样图路径在数据库视图层就被剥掉了，前端想拿也拿不到。
 *
 *   2. getBookings() —— 后台
 *      走 bookings 表本体，RLS 限制只有站主能读。
 *      样图 URL 用 createSignedUrl 现签现用，不落地、不过 CDN。
 *
 * 时区说明：店在武汉，所有展示都按 Asia/Shanghai 格式化，
 * 不依赖服务器本地时区（Vercel 在 UTC），避免「下午的预约显示成上午」。
 */

export const SHOP_TIMEZONE = 'Asia/Shanghai';

/** 前台时间表用的一行（视图结构） */
export interface BookingSlot {
  id: string;
  starts_at: string;
  duration_minutes: number;
}

/** 后台用的一行（表结构） */
export interface BookingRow extends BookingSlot {
  note: string | null;
  image_path: string | null;
  created_at: string;
}

/** 后台列表的一行 + 签好名的样图地址（没有样图 / 超期不签时为 null） */
export interface AdminBooking extends BookingRow {
  signedImageUrl: string | null;
}

/** 历史样图只给最近 7 天（含今天）签发；更早的预约不再加载图 */
export const SAMPLE_IMAGE_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// 时区安全的格式化（全部按 Asia/Shanghai，与服务器本地时区无关）
// ---------------------------------------------------------------------------

const dateParts = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHOP_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

const timeParts = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHOP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 某日期的「年月日」键，格式 2026-11-03，用于日历格子分组 */
export function dayKeyOf(date: Date): string {
  const parts = dateParts.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month').padStart(2, '0')}-${get('day').padStart(2, '0')}`;
}

/** 格式化「14:00」 */
export function formatTime(date: Date): string {
  return timeParts.format(date);
}

/** 预约的时间段，例如「14:00 – 16:00」 */
export function formatSlotRange(slot: BookingSlot): string {
  const start = new Date(slot.starts_at);
  const end = new Date(start.getTime() + slot.duration_minutes * 60_000);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// ---------------------------------------------------------------------------
// 前台：预约时间表
// ---------------------------------------------------------------------------

export interface SlotsResult {
  slots: BookingSlot[];
  /** false 表示表/视图还没建（SQL 没跑），前台静默隐藏时间表区块 */
  available: boolean;
}

/**
 * 取「本月 1 号 0 点 ~ 下下个月 1 号 0 点」之间的所有预约时间
 *
 * 多取一个月是为了「月底顺带显示下月」的策略，取数时一次查全，
 * 显示层（BookingSchedule 组件）再决定要不要渲染下个月。
 */
export async function getBookingSlots(): Promise<SlotsResult> {
  if (!isSupabaseConfigured) {
    return { slots: [], available: false };
  }

  try {
    const now = new Date();
    // 月界必须按店内时区（+08:00）算，不能拿 UTC 日期拼，否则 1 号早上 8 点前的预约会漏
    const { year, month0 } = getShopMonth(now);
    const monthStart = new Date(`${year}-${String(month0 + 1).padStart(2, '0')}-01T00:00:00+08:00`);

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from(BOOKING_SLOTS_VIEW)
      .select('id, starts_at, duration_minutes')
      .gte('starts_at', monthStart.toISOString())
      .order('starts_at', { ascending: true })
      .limit(200);

    if (error) {
      // 视图不存在（schema-v2.sql 还没跑）是预期场景
      console.warn('[bookings] booking_slots 查询失败，前台隐藏时间表：', error.message);
      return { slots: [], available: false };
    }

    return { slots: (data ?? []) as BookingSlot[], available: true };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[bookings] booking_slots 查询异常：', message);
    return { slots: [], available: false };
  }
}

// ---------------------------------------------------------------------------
// 后台：完整预约记录
// ---------------------------------------------------------------------------

export interface AdminBookingsResult {
  bookings: AdminBooking[];
  available: boolean;
  error?: string;
  /** 今天还没结束的预约数，用于「进入后台时的提醒」 */
  todayOpenCount: number;
}

/**
 * 取全部预约（按开始时间倒序），并为最近 7 天内的样图签临时地址
 *
 * 签名在这里做（服务端），而不是让浏览器自己去签：
 * 签名动作本身就是权限证明，RLS 保证只有站主的会话能签出来。
 */
export async function getAdminBookings(): Promise<AdminBookingsResult> {
  if (!isSupabaseConfigured) {
    return { bookings: [], available: false, todayOpenCount: 0 };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from(BOOKINGS_TABLE)
      .select('id, starts_at, duration_minutes, note, image_path, created_at')
      .order('starts_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('[bookings] bookings 查询失败：', error.message);
      return { bookings: [], available: false, error: error.message, todayOpenCount: 0 };
    }

    const rows = (data ?? []) as BookingRow[];
    const now = Date.now();
    const windowStart = now - SAMPLE_IMAGE_WINDOW_DAYS * 24 * 3600 * 1000;

    let todayOpenCount = 0;
    const todayKey = dayKeyOf(new Date(now));

    const bookings: AdminBooking[] = await Promise.all(
      rows.map(async (row) => {
        const startsAtMs = new Date(row.starts_at).getTime();
        const endsAtMs = startsAtMs + row.duration_minutes * 60_000;

        // 「今天的预约且还没到完成时间」→ 进入后台时提醒
        if (dayKeyOf(new Date(startsAtMs)) === todayKey && endsAtMs > now) {
          todayOpenCount += 1;
        }

        // 样图：最近 7 天（含未来）才签发；更早的历史预约不加载图
        let signedImageUrl: string | null = null;
        if (row.image_path && startsAtMs >= windowStart) {
          const { data: signed, error: signError } = await supabase.storage
            .from(BOOKINGS_BUCKET)
            .createSignedUrl(row.image_path, 3600);
          if (signError) {
            console.warn(`[bookings] 样图签名失败 ${row.image_path}：${signError.message}`);
          } else {
            signedImageUrl = signed.signedUrl;
          }
        }

        return { ...row, signedImageUrl };
      }),
    );

    return { bookings, available: true, todayOpenCount };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[bookings] bookings 查询异常：', message);
    return { bookings: [], available: false, error: message, todayOpenCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// 日历辅助（前台时间表组件用）
// ---------------------------------------------------------------------------

/** 当前时间在店里的「今天」的年月（month0 从 0 开始） */
export function getShopMonth(date: Date): { year: number; month0: number } {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month0: month - 1 };
}

// ---------------------------------------------------------------------------
// 后台顶栏提醒：今天还没结束的预约数
// ---------------------------------------------------------------------------

/**
 * 数一下「今天且还没到完成时间」的预约有几条
 *
 * 进入后台任何页面都会显示这个提醒（见 AdminBar），
 * 所以单独做一个轻量查询，不复用 getAdminBookings（那个还会给样图签名，浪费）。
 */
export async function getTodayOpenCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const supabase = await createServerSupabase();
    const now = new Date();
    const todayKey = dayKeyOf(now);
    // 店内时区的今天 0 点 ~ 明天 0 点
    const start = new Date(`${todayKey}T00:00:00+08:00`);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);

    const { data, error } = await supabase
      .from(BOOKINGS_TABLE)
      .select('starts_at, duration_minutes')
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString());

    if (error) return 0;

    const nowMs = now.getTime();
    return ((data ?? []) as { starts_at: string; duration_minutes: number }[]).filter(
      (row) => new Date(row.starts_at).getTime() + row.duration_minutes * 60_000 > nowMs,
    ).length;
  } catch {
    return 0;
  }
}
