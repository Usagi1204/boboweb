import { ARTIST_INTRO } from '@/data/portfolio';
import { BOOKING_CTA, CONTACT, STUDIO_FACTS, WECHAT_ID } from '@/data/site';
import { CONTENT_TABLE, isSupabaseConfigured } from './supabase/config';
import { createServerSupabase } from './supabase/server';

/**
 * 前台文案数据源
 *
 * data/site.ts 里的常量是「出厂值」，site_content 表是「后台改过的值」。
 * 读取规则：表里有就用表里的，没有（表不存在 / key 缺失 / 查询失败）就用出厂值。
 * 这样代码可以先上线、SQL 后跑，页面在任何状态下都不会白屏。
 *
 * key 的命名规则：区块.字段，例如 hero.title_a、contact.wechat。
 * 新增可编辑文案时：DEFAULTS 加一行 + schema-v2.sql 种子加一行。
 */

export interface SiteContent {
  heroTitleA: string;
  heroTitleB: string;
  heroLead: string;
  artistIntro: string;
  aboutQuoteA: string;
  aboutQuoteB: string;
  aboutQuoteC: string;
  aboutText1: string;
  aboutText2: string;
  wechat: string;
  hoursNote: string;
  addressNote: string;
  bookingEyebrow: string;
  bookingTitle: string;
  bookingLead: string;
  bookingHint: string;
  servedClients: string;
}

/** key → 出厂值（与 schema-v2.sql 的种子数据保持一致） */
export const CONTENT_DEFAULTS: Record<keyof SiteContent, string> = {
  heroTitleA: '指尖上的',
  heroTitleB: '小画廊',
  heroLead:
    '这里收着我自己做过的款式：从最基础的纯色，到需要一笔一笔画的碎花。按分类点开就能看细节。喜欢哪一款，记下编号加微信告诉我，我按你的甲型重做一遍。',
  artistIntro: ARTIST_INTRO,
  aboutQuoteA: '我不做“网红款”，只做',
  aboutQuoteB: '能安心戴满三周',
  aboutQuoteC: '的指甲。',
  aboutText1:
    'BOBO NAIL 是我一个人的小工作室——没有前台，也没有驻店团队。从沟通、修型、打底到最后一层封层，都是我一个人做完，不会做到一半换人接手。所有甲油胶与工具按单人单套消毒，卸甲免费。做之前会先聊清楚你的日常：是否常打字、是否带娃、指甲是否容易断，再决定甲型与长度，而不是硬套图片。',
  aboutText2:
    '工作室刚起步，到现在服务过一百多位客人。没有连锁店的流水线，换来的是每个人的手都记得住——你上次做过什么、哪根手指容易起翘，我都留着记录。',
  wechat: WECHAT_ID,
  hoursNote: CONTACT.hoursNote,
  addressNote: CONTACT.addressNote,
  bookingEyebrow: BOOKING_CTA.eyebrow,
  bookingTitle: BOOKING_CTA.title,
  bookingLead: BOOKING_CTA.lead,
  bookingHint: BOOKING_CTA.hint,
  servedClients: STUDIO_FACTS.servedClients,
};

/** SiteContent 字段 ↔ 数据库 key 的映射（数据库里是点分命名） */
export const KEY_MAP: Record<keyof SiteContent, string> = {
  heroTitleA: 'hero.title_a',
  heroTitleB: 'hero.title_b',
  heroLead: 'hero.lead',
  artistIntro: 'artist.intro',
  aboutQuoteA: 'about.quote_a',
  aboutQuoteB: 'about.quote_b',
  aboutQuoteC: 'about.quote_c',
  aboutText1: 'about.text_1',
  aboutText2: 'about.text_2',
  wechat: 'contact.wechat',
  hoursNote: 'contact.hours_note',
  addressNote: 'contact.address_note',
  bookingEyebrow: 'booking.eyebrow',
  bookingTitle: 'booking.title',
  bookingLead: 'booking.lead',
  bookingHint: 'booking.hint',
  servedClients: 'studio.served_clients',
};

/** 反向映射：数据库 key → SiteContent 字段（后台保存时用） */
export const FIELD_BY_KEY: Record<string, keyof SiteContent> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([field, key]) => [key, field as keyof SiteContent]),
);

export type ContentSource = 'supabase' | 'static';

export interface ContentResult {
  content: SiteContent;
  source: ContentSource;
}

/**
 * 读全部文案
 *
 * 一次性把整张表拉下来（十几行，开销可忽略），再按映射合并。
 * 单行缺失 / 值为空串都回退到出厂值，后台「清空某栏」不会把页面弄出空白区块。
 */
export async function getSiteContent(): Promise<ContentResult> {
  const fallback: SiteContent = { ...CONTENT_DEFAULTS };

  if (!isSupabaseConfigured) {
    return { content: fallback, source: 'static' };
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from(CONTENT_TABLE).select('key, value');

    if (error) {
      // 表还没建（schema-v2.sql 没跑）是预期场景，静默用出厂值
      console.warn('[content] 读取 site_content 失败，使用静态文案：', error.message);
      return { content: fallback, source: 'static' };
    }

    const merged = { ...fallback };
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      const field = FIELD_BY_KEY[row.key];
      // 空串视为「没填」，不动出厂值
      if (field && row.value.trim() !== '') {
        merged[field] = row.value;
      }
    }
    return { content: merged, source: 'supabase' };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[content] 读取 site_content 异常，使用静态文案：', message);
    return { content: fallback, source: 'static' };
  }
}
