import { SUPABASE_URL } from './supabase/config';

/**
 * 把 Supabase Storage 地址换成本站同源代理地址
 *
 * public：https://x.supabase.co/storage/v1/object/public/nail-images/works/a.jpg
 *      → /api/media/nail-images/works/a.jpg
 * sign  ：https://x.supabase.co/storage/v1/object/sign/booking-images/u/a.jpg?token=...
 *      → /api/media/booking-images/u/a.jpg?token=...
 *
 * 目的：浏览器不再直连 supabase.co（境内移动网络连不上），
 * 改由本站服务端取图（见 app/api/media/[...path]/route.ts）。
 *
 * 非 Supabase 地址原样返回，方便将来换 CDN 时不改调用方。
 */
export function toMediaUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  if (!SUPABASE_URL) return raw;

  const prefix = `${SUPABASE_URL}/storage/v1/object/`;
  if (!raw.startsWith(prefix)) return raw;

  const rest = raw.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return raw;

  const kind = rest.slice(0, slash);
  const tail = rest.slice(slash + 1);

  if (kind === 'public') return `/api/media/${tail}`;

  if (kind === 'sign') {
    const q = tail.indexOf('?');
    const pathPart = q === -1 ? tail : tail.slice(0, q);
    const query = q === -1 ? '' : tail.slice(q);
    return `/api/media/${pathPart}${query}`;
  }

  return raw;
}
