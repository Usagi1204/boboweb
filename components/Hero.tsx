import Link from 'next/link';
import type { Artwork } from '@/data/portfolio';
import { STUDIO_FACTS } from '@/data/site';
import HeroCarousel from './HeroCarousel';

interface HeroProps {
  /**
   * 轮播候选作品（服务端随机抽取）
   *
   * 允许为空数组：后台把作品删光了，首页仍然要能正常打开，
   * 只是不显示封面区，而不是白屏或报错。
   */
  slides: Artwork[];
  /** 作品总数，用于角标文案 */
  totalCount: number;
  /** 标题第一行（后台可改） */
  titleA?: string;
  /** 标题第二行（高亮，后台可改） */
  titleB?: string;
  /** 导语（后台可改） */
  lead?: string;
  /** 「服务客人」数字（后台可改） */
  servedClients?: string;
}

export default function Hero({
  slides,
  totalCount,
  titleA = '指尖上的',
  titleB = '小画廊',
  lead = '这里收着我自己做过的款式：从最基础的纯色，到需要一笔一笔画的碎花。按分类点开就能看细节。喜欢哪一款，记下编号加微信告诉我，我按你的甲型重做一遍。',
  servedClients = STUDIO_FACTS.servedClients,
}: HeroProps) {
  return (
    <section className="container hero">
      <div className="hero__grid">
        <div>
          <p className="eyebrow">Independent Nail Artist · Wuhan</p>
          <h1 className="hero__title">
            {titleA}
            <br />
            <em>{titleB}</em>
          </h1>
          <p className="hero__lead">{lead}</p>
          <div className="hero__actions">
            <Link href="#gallery" className="btn btn--primary">
              浏览作品
            </Link>
            <Link href="#contact" className="btn btn--ghost">
              微信预约
            </Link>
          </div>
        </div>

        <dl className="hero__meta">
          <div className="meta-item">
            <dt>作品收录</dt>
            <dd>
              {totalCount}
              <span>件</span>
            </dd>
          </div>
          <div className="meta-item">
            <dt>服务客人</dt>
            <dd>
              {servedClients}
              <span>+</span>
            </dd>
          </div>
          <div className="meta-item">
            <dt>美甲师</dt>
            <dd>
              {STUDIO_FACTS.artists}
              <span>位 · 我自己</span>
            </dd>
          </div>
        </dl>
      </div>

      {slides.length > 0 ? (
        <figure className="hero-cover">
          <HeroCarousel slides={slides} />
          <figcaption className="hero-cover__badge">
            <i aria-hidden="true" />
            工作室实拍 · 共收录 {totalCount} 件作品
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
