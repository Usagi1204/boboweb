/**
 * 服务端出站代理 fetch
 *
 * 为什么存在：supabase.co 的数据接口（REST / Auth / Storage）在境内直连会被重置，
 * Node 22 自带的 NODE_USE_ENV_PROXY 实测不生效（详见 2026-11-03 调试记录），
 * 所以用 undici 的 ProxyAgent 显式接管 Supabase 客户端的所有请求。
 *
 * 什么时候用：
 *   - 本地开发：.env.local 里设 SUPABASE_PROXY_URL=http://127.0.0.1:<端口>
 *     （端口以代理客户端"HTTP 代理"设置为准，会随客户端版本变化）
 *   - 生产（Vercel 等海外平台）：不设置，返回 undefined，走平台默认网络
 *
 * 只用于服务端（Server Component / Server Action / Node runtime 的 middleware）。
 * 浏览器端不经过这里：访客的浏览器自己有系统代理。
 */

import { fetch as undiciFetch, ProxyAgent } from 'undici';

/**
 * 模块级缓存：ProxyAgent 内部维护连接池，每个请求 new 一个会泄漏 socket。
 * undefined 还没算过；null 表示"不需要代理"，二者要区分开。
 */
let cached: typeof globalThis.fetch | null | undefined;

export function getSupabaseFetch(): typeof globalThis.fetch | undefined {
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const proxyUrl = (process.env.SUPABASE_PROXY_URL ?? '').trim();
  if (!proxyUrl) {
    cached = null;
    return undefined;
  }

  const agent = new ProxyAgent(proxyUrl);

  // undici 的 fetch / Response 与全局签名兼容，但类型系统不认，
  // 走一次显式转换。supabase-js 只用到标准 fetch 的能力。
  cached = ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
    undiciFetch(input, { ...init, dispatcher: agent })) as unknown as typeof globalThis.fetch;

  return cached;
}
