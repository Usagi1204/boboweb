import { SERVICES, type ServiceItem } from '@/data/site';
import { isSupabaseConfigured, SERVICES_TABLE } from './supabase/config';
import { createServerSupabase } from './supabase/server';

/**
 * 服务项目数据源
 *
 * 与作品、文案同一个思路：services 表为准，读不到就回退 data/site.ts 的静态清单。
 * 表为空（后台全删了）如实返回空数组，前台区块显示「项目整理中」，
 * 不偷换静态数据——否则删除操作看起来像是没生效。
 */

export interface ServiceRow {
  id: string;
  name: string;
  note: string;
  sort_order: number;
}

export type ServicesSource = 'supabase' | 'static';

export interface ServicesResult {
  /** 前台渲染用的精简结构（与 data/site.ts 的 ServiceItem 一致） */
  services: ServiceItem[];
  /** 带 id / sort_order 的完整行，后台编辑器用 */
  rows: ServiceRow[];
  source: ServicesSource;
  error?: string;
}

export async function getServices(): Promise<ServicesResult> {
  if (!isSupabaseConfigured) {
    return { services: SERVICES, rows: [], source: 'static' };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from(SERVICES_TABLE)
      .select('id, name, note, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      // 表还没建（schema-v2.sql 没跑）是预期场景，静默回退
      console.warn('[services] 读取 services 失败，使用静态清单：', error.message);
      return { services: SERVICES, rows: [], source: 'static' };
    }

    const rows = (data ?? []) as ServiceRow[];
    return {
      services: rows.map((row) => ({ name: row.name, note: row.note })),
      rows,
      source: 'supabase',
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[services] 读取 services 异常，使用静态清单：', message);
    return { services: SERVICES, rows: [], source: 'static', error: message };
  }
}
