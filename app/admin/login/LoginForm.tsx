'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { quickLoginAction } from '@/app/admin/actions';
import { getBrowserSupabase } from '@/lib/supabase/client';

interface LoginFormProps {
  /** URL 带了 ?denied=1，说明登录成功但账号不是站主 */
  denied: boolean;
  /**
   * 服务端配置了 ADMIN_QUICK_PASSWORD 才为 true（只有本地会配），
   * 决定是否渲染「快速登录」按钮。密码本身不下发到浏览器。
   */
  quickLogin: boolean;
}

/** Supabase 的英文报错 → 能看懂的中文 */
function toFriendlyMessage(raw: string): string {
  const text = raw.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return '邮箱或密码不对。注意这是 Supabase 里创建的那个账号，不是微信或别的密码。';
  }
  if (text.includes('email not confirmed')) {
    return '这个邮箱还没验证。去 Supabase 控制台 Authentication → Users 里点确认，或把 Confirm email 关掉。';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return '尝试次数太多，等一分钟再试。';
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return '连不上 Supabase。检查 NEXT_PUBLIC_SUPABASE_URL 是否填对、网络是否正常。';
  }
  return raw;
}

export default function LoginForm({ denied, quickLogin }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    denied ? '这个账号没有后台权限，换站主邮箱登录。' : null,
  );
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const supabase = getBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(toFriendlyMessage(signInError.message));
        setBusy(false);
        return;
      }

      /**
       * 登录成功后必须 refresh：
       * replace 只是切换路由，服务端组件和 middleware 拿到的还是旧 cookie，
       * 会立刻被弹回登录页。refresh 让它带着新 cookie 重新请求一次。
       */
      router.replace('/admin');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试。');
      setBusy(false);
    }
  }

  /** 快速登录：不调浏览器 Supabase，让服务端用环境变量里的密码登录 */
  async function handleQuickLogin() {
    if (quickBusy) return;
    setQuickBusy(true);
    setError(null);
    try {
      const result = await quickLoginAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // 同普通登录：refresh 让 middleware 拿到新 cookie
      router.replace('/admin');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '快速登录失败，请重试。');
    } finally {
      setQuickBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {error ? (
        <div className="admin-note admin-note--error" style={{ marginBottom: 0 }} role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-field">
        <label className="admin-label" htmlFor="admin-email">
          邮箱
        </label>
        <input
          id="admin-email"
          className="admin-input"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="admin-password">
          密码
        </label>
        <input
          id="admin-password"
          className="admin-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || quickBusy}>
          {busy ? '登录中…' : '登录'}
        </button>
        {quickLogin ? (
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={handleQuickLogin}
            disabled={busy || quickBusy}
          >
            {quickBusy ? '登录中…' : '快速登录（本机）'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
