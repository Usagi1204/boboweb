import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { getSupabaseFetch } from '@/lib/supabase/proxy-fetch';

/**
 * 同源图片代理
 *
 * 为什么需要：
 *   后台的放大图、预约样图如果直接用 https://<项目>.supabase.co/... 地址，
 *   就是让访客浏览器去连 supabase.co —— 这个域名从境内移动网络基本连不上，
 *   手机上表现为「图永远加载不出来」，而桌面因为挂了代理看不出问题。
 *   走这个路由后，所有图片都是本站域名，由服务端去取图（本地带代理、
 *   生产走平台网络），手机端和桌面端行为一致，还能吃到本站的缓存。
 *
 * 安全边界：
 *   - 只允许访问本项目 Storage 的 public / sign 两类对象，不接受任意 URL
 *     （否则就是公开的 SSRF 跳板）
 *   - 私有桶必须带签名 token，token 由服务端现签，1 小时过期
 *   - 响应加 sandbox CSP，防止有人上传能被当成页面的文件
 */

export const runtime = 'nodejs';

/** 桶名只允许字母数字下划线连字符 */
const BUCKET_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!SUPABASE_URL) {
    return new NextResponse('Supabase 未配置', { status: 503 });
  }

  const { path } = await params;
  if (!Array.isArray(path) || path.length < 2) {
    return new NextResponse('路径不完整', { status: 400 });
  }

  const [bucket, ...rest] = path;
  if (!BUCKET_RE.test(bucket)) {
    return new NextResponse('桶名不合法', { status: 400 });
  }

  const objectPath = rest.join('/');
  // 目录穿越：不允许 .. 和空对象名
  if (!objectPath || objectPath.includes('..')) {
    return new NextResponse('对象路径不合法', { status: 400 });
  }

  const token = request.nextUrl.searchParams.get('token');
  const upstream = token
    ? `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPath}?token=${encodeURIComponent(token)}`
    : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;

  // 本地开发走 SUPABASE_PROXY_URL，生产（Vercel）走平台默认网络
  const doFetch = getSupabaseFetch() ?? fetch;

  let upstreamRes: Response;
  try {
    upstreamRes = (await doFetch(upstream, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
    })) as unknown as Response;
  } catch (cause) {
    console.warn(`[media] 取图失败 ${bucket}/${objectPath}：${(cause as Error).message}`);
    return new NextResponse('取图失败', { status: 502 });
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    // Storage 对不存在的对象有时回 400（body 里才是 not_found），统一成 404
    if (upstreamRes.status === 404 || upstreamRes.status === 400) {
      return new NextResponse('对象不存在', { status: 404 });
    }
    return new NextResponse('上游返回错误', { status: 502 });
  }

  const contentType = upstreamRes.headers.get('content-type') ?? 'application/octet-stream';
  const contentLength = upstreamRes.headers.get('content-length');

  return new NextResponse(upstreamRes.body as ReadableStream, {
    status: 200,
    headers: {
      'content-type': contentType,
      ...(contentLength ? { 'content-length': contentLength } : {}),
      // 公开图（作品照）几乎不变，可以长缓存；签名图跟着 token 走，短缓存
      'cache-control': token
        ? 'private, max-age=900'
        : 'public, max-age=86400, stale-while-revalidate=604800',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
    },
  });
}
