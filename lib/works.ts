import {
  artworks as localArtworks,
  CATEGORY_MINUTES,
  REAL_CATEGORIES,
  type Artwork,
  type Category,
} from '@/data/portfolio';
import { isSupabaseConfigured, WORKS_TABLE } from './supabase/config';
import { createServerSupabase } from './supabase/server';

/**
 * 作品数据源
 *
 * 前台与后台都只通过 getWorks() 拿数据，不直接碰 Supabase 或 JSON，
 * 这样"数据从哪来"只有一处需要关心。
 *
 * 优先级：
 *   1. Supabase nail_works 表（配好了就用它，是唯一真相源）
 *   2. 本地 data/artworks.json（没配 / 查询报错时兜底，保证站点不白屏）
 *
 * 注意"表为空"不算失败：那是真的没有作品，应该如实显示空画廊，
 * 而不是偷偷换成本地那 23 张——否则删光作品后前台又冒出 23 张，
 * 会被当成删除没生效。
 */

/** 表结构（与 supabase/schema.sql 对应） */
export interface NailWorkRow {
  id: string;
  image_url: string;
  style_category: string;
  description: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
}

/** 查询字段列表，统一在这里维护，避免 select 写一半漏字段 */
export const WORKS_SELECT = 'id, image_url, style_category, description, created_at, width, height';

export type WorksSource = 'supabase' | 'local';

export interface WorksResult {
  works: Artwork[];
  source: WorksSource;
  /** 配置了却读取失败时的原因。后台会显示出来，否则"配了却看不到"没人知道为什么 */
  error?: string;
}

/** 没有记录宽高时的兜底比例（3:4，竖构图最常见，不会把甲面裁掉） */
const FALLBACK_WIDTH = 900;
const FALLBACK_HEIGHT = 1200;

/**
 * 兜底色块：图片加载失败时顶替。
 * 按分类给不同暖色，比统一灰色更容易分辨是哪一类出了问题。
 */
const TINT_BY_CATEGORY: Record<Category, string> = {
  纯色: '#E7DAD3',
  法式: '#EFE7DE',
  晕染: '#E3D6D9',
  手绘: '#E8DCCB',
  延长甲: '#DED6D2',
};

/** 把任意字符串收敛成合法分类 */
function normalizeCategory(raw: string | null | undefined): Category {
  const value = (raw ?? '').trim();
  for (const category of REAL_CATEGORIES) {
    if (category === value) return category;
  }
  // 正常走不到这里：后台的下拉框只能选这 5 个。
  // 但有人可能在 Supabase 控制台手改数据，兜一下总比让类型说谎好。
  console.warn(`[works] 分类「${value}」不在允许范围内，暂归入「纯色」`);
  return '纯色';
}

/** 卡片标题：描述太长会把瀑布流卡片撑歪，截到 20 字 */
function toTitle(description: string, category: Category): string {
  if (!description) return `${category}款`;
  return description.length > 20 ? `${description.slice(0, 20)}…` : description;
}

/** 一行数据库记录 → 组件用的 Artwork */
export function rowToArtwork(row: NailWorkRow): Artwork {
  const category = normalizeCategory(row.style_category);
  const description = (row.description ?? '').trim();

  // 宽高缺失时用 3:4 兜底。上传表单和迁移脚本都会写入真实尺寸，
  // 所以只有手改数据库才会走到兜底分支。
  const width = row.width && row.width > 0 ? row.width : FALLBACK_WIDTH;
  const height = row.height && row.height > 0 ? row.height : FALLBACK_HEIGHT;

  // 编号取 id 前 4 位：UUID 是随机的，肉眼看不出顺序，前 4 位足够当"款号"用
  const shortId = row.id.replace(/-/g, '').slice(0, 4).toUpperCase();

  return {
    id: row.id,
    title: toTitle(description, category),
    category,
    imageUrl: row.image_url,
    width,
    height,
    tint: TINT_BY_CATEGORY[category],
    /**
     * 表里没有"主色调"字段。留空字符串，灯箱会跳过这一项
     * （见 Lightbox.tsx 里的条件渲染），而不是显示一个空白行。
     */
    tone: '',
    background: '工作室',
    summary: description || `${category}作品`,
    alt: `美甲作品：${category}，${description || '新上传的作品'}`,
    note: `工作室实拍。记下编号 ${shortId}，到店会按你的甲型与甲床长度重新调整。`,
    duration: CATEGORY_MINUTES[category],
    createdAt: row.created_at,
  };
}

/**
 * 取全部作品，按 created_at 倒序（最新的在前）
 *
 * force-dynamic 页面上每次请求都会走到这里，所以：
 *   - 加了 limit，防止以后作品越攒越多把首屏拖慢
 *   - 只列 column 不 select *，少传没用上的字段
 */
export async function getWorks(): Promise<WorksResult> {
  if (!isSupabaseConfigured) {
    return { works: localArtworks, source: 'local' };
  }

  try {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from(WORKS_TABLE)
      .select(WORKS_SELECT)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as NailWorkRow[];
    return { works: rows.map(rowToArtwork), source: 'supabase' };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // 数据库连不上时宁可显示旧数据，也不要让访客看到空白页
    console.error('[works] 读取 Supabase 失败，已回退到本地数据：', message);
    return { works: localArtworks, source: 'local', error: message };
  }
}
