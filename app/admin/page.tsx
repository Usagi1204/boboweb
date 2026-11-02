import Link from 'next/link';
import { redirect } from 'next/navigation';
import WorkList from '@/components/admin/WorkList';
import UploadForm from '@/components/admin/UploadForm';
import { signOutAction } from './actions';
import { ADMIN_EMAIL, isSupabaseConfigured, SUPABASE_BUCKET, WORKS_TABLE } from '@/lib/supabase/config';
import { checkAdmin } from '@/lib/supabase/server';
import { getWorks } from '@/lib/works';

/**
 * 强制动态渲染
 *
 * 不加这一行，构建时若没配环境变量，Next 会把「配置指引页」当成静态结果固化进产物，
 * 线上配好 Supabase 后 /admin 仍然永远显示指引页 —— 改了配置却毫无反应，极难排查。
 * 页面本身要读 cookie 判断登录态，本来也不该被缓存。
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: '后台 · BOBO Nail',
  robots: { index: false, follow: false },
};

/** 没配置 Supabase 时显示的指引页 —— 让人能照着做完，而不是看到一句"请配置" */
function SetupGuide() {
  return (
    <main className="admin-setup">
      <h1 className="admin-login__title" style={{ fontSize: '1.3rem', marginBottom: 10 }}>
        还差几步就能用了
      </h1>
      <p className="admin-card__hint" style={{ marginBottom: 26 }}>
        后台需要连一个 Supabase 项目来做登录、存图和存数据。
        下面五步做完，把 <code>.env.local</code> 填好并重启 dev server 即可。
      </p>

      <div className="admin-card">
        <h2 className="admin-card__title">1. 建项目</h2>
        <p className="admin-card__hint" style={{ marginBottom: 0 }}>
          打开 supabase.com 用 GitHub 或邮箱注册，新建一个 project。
          区域选新加坡或东京，国内访问比美区顺一些。建好大约等两分钟初始化。
        </p>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">2. 跑建表脚本</h2>
        <p className="admin-card__hint">
          项目左侧点 <strong>SQL Editor</strong> → New query，
          把仓库里的 <code>supabase/schema.sql</code> 全文粘进去，点 Run。
          它一次做完四件事：建 <code>{WORKS_TABLE}</code> 表、建索引、
          建读写策略、建 <code>{SUPABASE_BUCKET}</code> 存储桶（公开可读）。
        </p>
        <p className="admin-card__hint" style={{ marginBottom: 0 }}>
          脚本可重复执行，跑错了重跑一遍就行。
        </p>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">3. 建你自己的账号</h2>
        <p className="admin-card__hint">
          左侧 <strong>Authentication</strong> → Users → Add user，
          邮箱填 <code>{ADMIN_EMAIL}</code>，设一个密码。
        </p>
        <p className="admin-card__hint" style={{ marginBottom: 0 }}>
          建完记得把 <strong>Authentication → Providers → Email</strong> 里的
          <strong> Confirm email</strong> 关掉，否则账号会卡在"未验证"登不进去。
          这个站只有你用，不需要邮箱验证流程。
        </p>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">4. 填环境变量</h2>
        <p className="admin-card__hint">
          左侧 <strong>Project Settings → API</strong>，复制 Project URL 和 anon / public key，
          在项目根目录建 <code>.env.local</code>（可以从 <code>.env.example</code> 复制）：
        </p>
        <code className="admin-code">
          {`NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
ADMIN_EMAIL=${ADMIN_EMAIL}`}
        </code>
        <p className="admin-card__hint" style={{ marginBottom: 0 }}>
          anon key 是公开的，会打进前端代码里 —— 安全性由第 2 步建的 RLS 策略保证，
          所以那步不能跳过。填完重启 <code>npm run dev</code>。
        </p>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">5. 把现有作品导进来（可选）</h2>
        <p className="admin-card__hint">
          想保留现在这 23 张，在 <code>.env.local</code> 里补上登录邮箱和密码，然后：
        </p>
        <code className="admin-code">{`SUPABASE_MIGRATE_EMAIL=${ADMIN_EMAIL}
SUPABASE_MIGRATE_PASSWORD=你的密码

npm run db:migrate`}</code>
        <p className="admin-card__hint" style={{ marginBottom: 0 }}>
          脚本会登录后逐张上传并写入记录，可以重复跑，已存在的会跳过。
          跑完把那两行密码删掉，别提交到仓库。
        </p>
      </div>

      <p style={{ marginTop: 28, fontSize: '0.84rem' }}>
        <Link href="/" style={{ color: 'var(--adm-muted)' }}>
          ← 回到作品集
        </Link>
      </p>
    </main>
  );
}

export default async function AdminPage() {
  if (!isSupabaseConfigured) {
    return <SetupGuide />;
  }

  const guard = await checkAdmin();

  if (!guard.ok) {
    if (guard.reason === 'anonymous') {
      // middleware 通常已经拦过；这里再兜一次，防止有人直接请求 Server Action
      redirect('/admin/login');
    }

    // 登录了但不是站主
    return (
      <main className="admin-login">
        <div className="admin-login__card">
          <h1 className="admin-login__title">没有访问权限</h1>
          <p className="admin-login__hint">
            当前账号 <code>{guard.email ?? '未知'}</code> 不是站主，进不了后台。
          </p>
          <form action={signOutAction}>
            <button type="submit" className="admin-btn admin-btn--ghost">
              退出并换账号
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { works, source, error } = await getWorks();

  return (
    <main className="admin-wrap">
      <header className="admin-bar">
        <div className="admin-bar__left">
          <h1 className="admin-bar__title">作品管理</h1>
          <span className="admin-bar__who">{guard.email}</span>
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

      {/* 数据源异常要说出来，否则"配好了却看不到新图"没人知道该查哪里 */}
      {error ? (
        <div className="admin-note admin-note--error">
          读取 Supabase 失败，前台正在显示本地数据：<code>{error}</code>
        </div>
      ) : null}

      {source === 'local' && !error ? (
        <div className="admin-note admin-note--warn">
          前台当前显示的是本地 <code>data/artworks.json</code>（{works.length} 件），
          不是 Supabase 里的数据。
        </div>
      ) : null}

      <section className="admin-card">
        <h2 className="admin-card__title">新增作品</h2>
        <p className="admin-card__hint">
          传完刷新前台就能看到，新作品排在最前面。
        </p>
        <UploadForm />
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          已上传
          <span className="admin-count">
            {works.length} 件 · 数据来源 {source === 'supabase' ? 'Supabase' : '本地 JSON'}
          </span>
        </h2>
        <p className="admin-card__hint">按上传时间倒序，最新的在最上面。</p>
        <WorkList works={works} />
      </section>
    </main>
  );
}
