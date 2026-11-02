import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { isAdminEmail, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { getSupabaseFetch } from './proxy-fetch';

/**
 * 服务端 Supabase 客户端（读 cookie 里的登录态）
 *
 * 只用于 Server Component / Server Action / Route Handler。
 * Next 15 起 cookies() 是异步的，必须 await。
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /**
           * Server Component 渲染过程中不能写 cookie，会抛错。
           * 这里吞掉：token 刷新由 middleware.ts 负责（它在响应阶段可以写）。
           * 不吞的话，只是打开后台页面就会 500。
           */
        }
      },
    },
    // 本地开发时 supabase.co 直连不通，走 SUPABASE_PROXY_URL 指定的代理；
    // 未设置该变量（如部署到 Vercel）时是 undefined，行为与默认完全一致
    global: { fetch: getSupabaseFetch() },
  });
}

/** 后台权限校验的结果 */
export type AdminGuard =
  | { ok: true; email: string }
  | { ok: false; reason: 'not-configured' | 'anonymous' | 'forbidden'; email?: string };

/**
 * 判断当前请求是否具备后台权限
 *
 * 三道检查，缺一不可：
 *   1. 环境变量配了没
 *   2. 有没有登录态
 *   3. 登录的邮箱是不是管理员
 *
 * 第 3 步不能省。Supabase 默认允许任何人自助注册，
 * 如果只判断"已登录"，别人注册个号就能进后台删作品。
 * 数据库 RLS 里还有同样一道（schema.sql），这里属于第二层。
 */
export async function checkAdmin(): Promise<AdminGuard> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'not-configured' };
  }

  const supabase = await createServerSupabase();

  // getUser() 会向 Supabase 校验 token，比 getSession() 只读本地 cookie 可靠
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, reason: 'anonymous' };
  }

  if (!isAdminEmail(user.email)) {
    return { ok: false, reason: 'forbidden', email: user.email ?? undefined };
  }

  return { ok: true, email: user.email as string };
}
