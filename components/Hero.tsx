import Image from 'next/image';
import Link from 'next/link';
import type { Artwork } from '@/data/portfolio';

interface HeroProps {
  /** 封面图（复用作品集数据，换图只改一处） */
  cover: Artwork;
  /** 作品总数，用于角标文案 */
  totalCount: number;
}

export default function Hero({ cover, totalCount }: HeroProps) {
  return (
    <section className="container hero">
      <div className="hero__grid">
        <div>
          <p className="eyebrow">Nail Art Portfolio · 2019 — 2026</p>
          <h1 className="hero__title">
            指尖上的
            <br />
            <em>小画廊</em>
          </h1>
          <p className="hero__lead">
            这里收着工作室这几年做过的款式：从最基础的纯色，到需要一笔一笔画的碎花。
            按分类点开就能看细节，喜欢哪一款，带着编号来预约就好。
          </p>
          <div className="hero__actions">
            <Link href="#gallery" className="btn btn--primary">
              浏览作品
            </Link>
            <Link href="#contact" className="btn btn--ghost">
              预约到店
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
              1800
              <span>+</span>
            </dd>
          </div>
          <div className="meta-item">
            <dt>驻店美甲师</dt>
            <dd>
              4<span>位</span>
            </dd>
          </div>
        </dl>
      </div>

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
    </section>
  );
}
