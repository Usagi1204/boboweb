'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

type BrowserClient = ReturnType<typeof createBrowserClient>;

/**
 * 浏览器端 Supabase 客户端
 *
 * 用单例：每次调用都 new 一个会触发 GoTrueClient 的
 * "Multiple GoTrueClient instances detected" 警告，登录态也可能读到不同副本。
 */
let cached: BrowserClient | null = null;

export function getBrowserSupabase(): BrowserClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // 正常情况下页面会在配置缺失时提前拦掉，走到这里说明调用方漏了判断
    throw new Error(
      'Supabase 尚未配置。请在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 后重启 dev server。',
    );
  }
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
