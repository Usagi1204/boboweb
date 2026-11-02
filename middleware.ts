import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseFetch } from '@/lib/supabase/proxy-fetch';

/**
 * 后台守卫 + 登录态刷新
 *
 * 两件事一起做：
 *   1. 刷新 access token 并写回 cookie —— @supabase/ssr 要求有人负责这件事，
 *      否则登录一小时后 token 过期，页面会突然变成未登录。
 *      放在 middleware 是因为只有响应阶段才能写 cookie（Server Component 里不行）。
 *   2. 未登录访问 /admin 跳登录页；已登录访问登录页跳回后台。
 *
 * 注意：这里只做"有没有登录"，邮箱白名单在页面和 Server Action 里再查一次，
 * 数据库 RLS 里还有第三道。三道都过才算真的有权，少任何一道都是假的安全。
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'usagi520x@gmail.com').trim().toLowerCase();

export async function middleware(request: NextRequest) {
  // 没配置 Supabase 时不要拦人：/admin 会自己渲染配置指引页，
  // 在这里重定向会让用户连"该怎么配"都看不到。
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
    // 与 server.ts 同理：本地走 SUPABASE_PROXY_URL，生产不设置则走默认
    global: { fetch: getSupabaseFetch() },
  });

  /**
   * getUser() 需要访问 Supabase Auth。万一网络异常（比如代理没开），
   * 不要让 /admin 整页 500，按"未登录"处理跳去登录页即可，
   * 登录页和 Server Action 里还有完整的错误提示。
   */
  let user: { email?: string | null } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/admin/login';

  const isAllowed = Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL);

  // 已登录且是管理员，却停在登录页 → 直接进后台
  if (isAllowed && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 没登录 → 去登录页，并带上原目标，登录后能跳回来
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 登录了但不是管理员 → 也回登录页，带标记让页面提示"无权限"
  if (user && !isAllowed && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '?denied=1';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * runtime nodejs：middleware 里要经 undici ProxyAgent 访问 Supabase，
   * edge runtime 跑不了。Next 15.5 起 Node.js middleware 已稳定。
   */
  runtime: 'nodejs',
  matcher: ['/admin', '/admin/:path*'],
};
