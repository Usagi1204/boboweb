import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import LoginForm from './LoginForm';

export const metadata = {
  title: '登录 · 管理后台',
  robots: { index: false, follow: false },
};

/**
 * 登录页
 *
 * 做成服务端组件 + 客户端表单两层，是为了在服务端读 searchParams：
 * 客户端读要用 useSearchParams，必须被 Suspense 包住，否则构建时报警。
 * 这层壳顺便把"有没有配置 Supabase"也判掉。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  const denied = params.denied === '1';

  return (
    <main className="admin-login">
      <div className="admin-login__card">
        <h1 className="admin-login__title">管理后台</h1>
        <p className="admin-login__hint">用你自己的邮箱登录，只有站主账号能进入。</p>

        {isSupabaseConfigured ? (
          <LoginForm denied={denied} quickLogin={Boolean(process.env.ADMIN_QUICK_PASSWORD)} />
        ) : (
          <div className="admin-note admin-note--warn" style={{ marginBottom: 0 }}>
            还没配置 Supabase，登录不可用。按
            <Link href="/admin"> 后台首页的指引 </Link>
            填好 <code>.env.local</code> 后重启即可。
          </div>
        )}

        <p className="admin-login__foot">
          <Link href="/">← 回到作品集</Link>
        </p>
      </div>
    </main>
  );
}
