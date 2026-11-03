import Link from 'next/link';
import { signOutAction } from '@/app/admin/actions';
import { getTodayOpenCount } from '@/lib/bookings';

/**
 * 后台共享顶栏：标题 + 分区 tab + 账号操作
 *
 * 三个分区各是一个独立页面（作品 / 预约 / 文案与服务），
 * tab 高亮由调用方传 active 决定（服务端组件，不读路由）。
 *
 * 「今天还有预约没完成」的提醒也在这里：
 * 需求是「进入后台时提示」，后台任何页面都会渲染这个顶栏，放这里只写一次。
 */

const TABS = [
  { key: 'works', href: '/admin', label: '作品' },
  { key: 'bookings', href: '/admin/bookings', label: '预约' },
  { key: 'content', href: '/admin/content', label: '文案与服务' },
] as const;

export type AdminTabKey = (typeof TABS)[number]['key'];

export default async function AdminBar({ active, email }: { active: AdminTabKey; email: string }) {
  const todayOpenCount = await getTodayOpenCount();

  return (
    <>
      <header className="admin-bar">
        <div className="admin-bar__left">
          <h1 className="admin-bar__title">管理后台</h1>
          <nav className="admin-tabs" aria-label="后台分区">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`admin-tabs__tab${active === tab.key ? ' is-active' : ''}`}
                aria-current={active === tab.key ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <span className="admin-bar__who">{email}</span>
        </div>
        <div className="admin-bar__right">
          <Link href="/" className="admin-btn admin-btn--ghost">
            查看前台
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="admin-btn admin-btn--ghost">
              退出
            </button>
          </form>
        </div>
      </header>

      {todayOpenCount > 0 ? (
        <div className="admin-note admin-note--today" role="status">
          今天还有 <strong>{todayOpenCount}</strong> 位客人的预约没到完成时间，别忘了。
          <Link href="/admin/bookings">去看看 →</Link>
        </div>
      ) : null}
    </>
  );
}
