import { redirect } from 'next/navigation';
import AdminBar from '@/components/admin/AdminBar';
import BookingForm from '@/components/admin/BookingForm';
import BookingList from '@/components/admin/BookingList';
import { getAdminBookings } from '@/lib/bookings';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { checkAdmin } from '@/lib/supabase/server';

/** 预约数据每次都要最新，不能缓存 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '预约管理 · BOBO Nail',
  robots: { index: false, follow: false },
};

export default async function AdminBookingsPage() {
  if (!isSupabaseConfigured) {
    redirect('/admin');
  }

  const guard = await checkAdmin();
  if (!guard.ok) {
    redirect(guard.reason === 'anonymous' ? '/admin/login' : '/admin');
  }

  const result = await getAdminBookings();

  return (
    <main className="admin-wrap">
      {/* getAdminBookings 已经算好了今日未完数，不用再查一次 */}
      <AdminBar active="bookings" email={guard.email} todayCount={result.todayOpenCount} />

      {!result.available ? (
        <div className="admin-note admin-note--warn">
          预约功能的数据表还没建好：到 Supabase 控制台 → SQL Editor，
          把仓库里的 <code>supabase/schema-v2.sql</code> 全文粘进去跑一次，然后刷新本页。
          {result.error ? <code>{result.error}</code> : null}
        </div>
      ) : null}

      <section className="admin-card">
        <h2 className="admin-card__title">新增预约</h2>
        <p className="admin-card__hint">
          客人定下时间后记在这里。前台「预约时间表」只会显示时间段，备注和样图别人看不到。
        </p>
        <BookingForm />
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          预约记录
          <span className="admin-count">{result.bookings.length} 条</span>
        </h2>
        <p className="admin-card__hint">
          样图只保留最近 7 天的预览，更早的历史记录不再加载图片。
        </p>
        <BookingList bookings={result.bookings} />
      </section>
    </main>
  );
}
