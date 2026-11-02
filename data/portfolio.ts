/**
 * 作品集数据源 —— 全站唯一的图片与分类入口
 *
 * 数据分两层，各管一件事：
 *   1. data/artworks.json  ← 每张照片的事实与文案（由 scripts/import-photos.mjs 生成）
 *   2. 本文件              ← 类型、分类枚举、以及由事实推导出来的展示字段
 *
 * 换图 / 改分类 / 改标题，都只动 data/artworks.json，组件层不用碰：
 *   - 加照片：把图丢进 ~/Desktop/Photo 再跑 npm run photos:import
 *   - 改文案：直接编辑 JSON 里的 title / category / summary，刷新页面即生效
 */
import rawData from './artworks.json';

/** 分类枚举：新增分类时，这里的类型和 CATEGORIES 都要同步加 */
export type Category = '纯色' | '法式' | '晕染' | '手绘' | '延长甲';

/** 筛选栏展示顺序，'全部' 固定在第一位（不是作品分类，只是视图） */
export const CATEGORIES = ['全部', '纯色', '法式', '晕染', '手绘', '延长甲'] as const;

/** 实际可挂在作品上的分类（排除 '全部'） */
export const REAL_CATEGORIES: Category[] = ['纯色', '法式', '晕染', '手绘', '延长甲'];

export type FilterValue = (typeof CATEGORIES)[number];

/**
 * 画廊顶部那句自我介绍。
 * 城市与方向按实际情况改这一行即可，全站只有这一处。
 */
export const ARTIST_INTRO = '武汉 · 专注手绘与晕染的独立美甲师';

/** 分类对应的常规服务时长（与 About 里的价目表口径一致） */
const CATEGORY_MINUTES: Record<Category, string> = {
  纯色: '60 — 90 分钟',
  法式: '70 — 95 分钟',
  晕染: '90 — 120 分钟',
  手绘: '110 — 150 分钟',
  延长甲: '150 — 180 分钟',
};

/** JSON 里的字段：全部是事实（尺寸、色调、文案），没有推导成分 */
interface RawArtwork {
  /** 原始文件名，重跑导入脚本时用它做合并键 */
  source: string;
  id: string;
  /** 图片地址：public/works/ 下的本地路径 */
  imageUrl: string;
  /** 原图宽高（px），next/image 靠它算宽高比，避免布局抖动 */
  width: number;
  height: number;
  /** 兜底色块颜色，图片加载失败时顶替 */
  tint: string;
  category: Category;
  title: string;
  /** 甲面主色调描述，例如「奶茶 · 偏亮」 */
  tone: string;
  /** 背景明暗，例如「深色背景」 */
  background: string;
  /** 一句话描述，同时用于拼接 alt */
  summary: string;
}

export interface Artwork {
  id: string;
  title: string;
  category: Category;
  imageUrl: string;
  width: number;
  height: number;
  /** 兜底底色 */
  tint: string;
  /** 甲面主色调，展示在灯箱 */
  tone: string;
  /** 背景描述 */
  background: string;
  /** 一句话描述 */
  summary: string;
  /** 图片替代文本，格式固定为「美甲作品：{风格分类}，{简短描述}」 */
  alt: string;
  /** 灯箱里的说明，由背景 + 编号拼出，不含臆测的配方 */
  note: string;
  /** 该分类的常规耗时 */
  duration: string;
}

const RAW = (rawData as { items: RawArtwork[] }).items;

// JSON 是手工可改的，分类写错字必须第一时间报错，而不是让筛选栏静默变空
for (const item of RAW) {
  if (!REAL_CATEGORIES.includes(item.category)) {
    throw new Error(
      `data/artworks.json 中 ${item.id}（${item.source}）的 category「${item.category}」不在分类列表内，可选值：${REAL_CATEGORIES.join(' / ')}`,
    );
  }
}

export const artworks: Artwork[] = RAW.map((item) => ({
  ...item,
  alt: `美甲作品：${item.category}，${item.summary}`,
  note: `${item.background}拍摄。记下编号 ${item.id}，到店会按你的甲型与甲床长度重新调整。`,
  duration: CATEGORY_MINUTES[item.category],
}));

/** 按分类筛作品；传 '全部' 返回全部 */
export function filterArtworks(list: Artwork[], filter: FilterValue): Artwork[] {
  if (filter === '全部') return list;
  return list.filter((item) => item.category === filter);
}

/** 统计每个分类的作品数，用于筛选栏角标 */
export function countByCategory(list: Artwork[]): Record<FilterValue, number> {
  const counts = {} as Record<FilterValue, number>;
  CATEGORIES.forEach((cat) => {
    counts[cat] = cat === '全部' ? list.length : list.filter((item) => item.category === cat).length;
  });
  return counts;
}
