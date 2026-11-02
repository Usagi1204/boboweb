import Image from 'next/image';
import Link from 'next/link';
import type { Artwork } from '@/data/portfolio';
import { STUDIO_FACTS } from '@/data/site';

interface HeroProps {
  /**
   * 封面图（复用作品集数据，换图只改一处）
   *
   * 允许为空：后台把作品删光了，首页仍然要能正常打开，
   * 只是不显示封面图，而不是白屏或报错。
   */
  cover?: Artwork | null;
  /** 作品总数，用于角标文案 */
  totalCount: number;
}

export default function Hero({ cover, totalCount }: HeroProps) {
  return (
    <section className="container hero">
      <div className="hero__grid">
        <div>
          <p className="eyebrow">Independent Nail Artist · Wuhan</p>
          <h1 className="hero__title">
            指尖上的
            <br />
            <em>小画廊</em>
          </h1>
          <p className="hero__lead">
            这里收着我自己做过的款式：从最基础的纯色，到需要一笔一笔画的碎花。
            按分类点开就能看细节。喜欢哪一款，记下编号加微信告诉我，我按你的甲型重做一遍。
          </p>
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
              {STUDIO_FACTS.servedClients}
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

      {cover ? (
        <figure className="hero-cover">
          <div className="hero-cover__media">
            <Image
              src={cover.imageUrl}
              alt={cover.alt}
              fill
              sizes="(max-width: 1180px) 100vw, 1180px"
              priority
              style={{ objectFit: 'cover', objectPosition: 'center 42%' }}
            />
          </div>
          <figcaption className="hero-cover__badge">
            <i aria-hidden="true" />
            工作室实拍 · 共收录 {totalCount} 件作品
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
