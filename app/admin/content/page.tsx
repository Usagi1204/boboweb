import { redirect } from 'next/navigation';
import AdminBar from '@/components/admin/AdminBar';
import ContentForm from '@/components/admin/ContentForm';
import ServicesEditor from '@/components/admin/ServicesEditor';
import { getSiteContent, KEY_MAP } from '@/lib/content';
import { getServices } from '@/lib/services';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { checkAdmin } from '@/lib/supabase/server';

/** 文案每次都要读到最新，不能缓存 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '文案与服务 · BOBO Nail',
  robots: { index: false, follow: false },
};

export default async function AdminContentPage() {
  if (!isSupabaseConfigured) {
    redirect('/admin');
  }

  const guard = await checkAdmin();
  if (!guard.ok) {
    redirect(guard.reason === 'anonymous' ? '/admin/login' : '/admin');
  }

  const [{ content, source: contentSource }, servicesResult] = await Promise.all([
    getSiteContent(),
    getServices(),
  ]);

  // 表单初始值：字段（camelCase）→ 数据库点分 key
  const initial: Record<string, string> = {};
  for (const [field, key] of Object.entries(KEY_MAP)) {
    initial[key] = content[field as keyof typeof content];
  }

  return (
    <main className="admin-wrap">
      <AdminBar active="content" email={guard.email} />

      {contentSource === 'static' ? (
        <div className="admin-note admin-note--warn">
          文案表还没建好：到 Supabase 控制台 → SQL Editor，
          把仓库里的 <code>supabase/schema-v2.sql</code> 全文粘进去跑一次。
          下面显示的是出厂默认文案，保存时会自动写入表里。
        </div>
      ) : null}

      <section className="admin-card">
        <h2 className="admin-card__title">前台文案</h2>
        <p className="admin-card__hint">
          这里改的是首页各处的文字。改完点「保存全部修改」，前台刷新即可看到。
        </p>
        <ContentForm initial={initial} />
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          服务项目
          <span className="admin-count">
            {servicesResult.rows.length} 项
            {servicesResult.source === 'static' ? ' · 当前显示静态清单' : ''}
          </span>
        </h2>
        <p className="admin-card__hint">
          排序号小的排前面。删掉所有项目后，前台会显示「项目整理中」。
        </p>
        <ServicesEditor rows={servicesResult.rows} />
      </section>
    </main>
  );
}
