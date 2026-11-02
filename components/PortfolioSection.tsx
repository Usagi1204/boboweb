'use client';

import { useCallback, useMemo, useState } from 'react';
import FilterBar from './FilterBar';
import MasonryGallery from './MasonryGallery';
import Lightbox from './Lightbox';
import {
  ARTIST_INTRO,
  CATEGORIES,
  countByCategory,
  filterArtworks,
  type Artwork,
  type FilterValue,
} from '@/data/portfolio';
import styles from './Portfolio.module.css';

interface PortfolioSectionProps {
  artworks: Artwork[];
}

/**
 * 作品集区（客户端容器）
 *
 * 只在这一层持有状态：当前分类 + 灯箱打开的索引。
 * 画廊、筛选栏、灯箱都是纯展示组件，方便单独替换或测试。
 */
export default function PortfolioSection({ artworks }: PortfolioSectionProps) {
  const [filter, setFilter] = useState<FilterValue>('全部');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const counts = useMemo(() => countByCategory(artworks), [artworks]);
  const visible = useMemo(() => filterArtworks(artworks, filter), [artworks, filter]);

  // 切换分类后旧索引已失效，顺手关掉灯箱
  const handleFilterChange = useCallback((next: FilterValue) => {
    setFilter(next);
    setActiveIndex(null);
  }, []);

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const stepLightbox = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (current === null) return current;
        const next = current + delta;
        // 首尾循环浏览，避免到边界后按了没反应
        return (next + visible.length) % visible.length;
      });
    },
    [visible.length],
  );

  return (
    <section className={`section ${styles.section}`} id="gallery">
      <div className="container">
        <div className="section__head">
          <div>
            <p className="eyebrow">Selected works</p>
            <h2 className="section__title">作品集</h2>
            <p className="section__desc">
              按款式分类浏览。点击任意一张进入大图，可用左右方向键连续翻看。
            </p>
          </div>
          <p className={styles.counter}>
            当前 <strong>{visible.length}</strong> / {artworks.length} 件
          </p>
        </div>

        {/* 一句话自我介绍：衬线体，比正文浅一档 */}
        <p className={styles.tagline}>{ARTIST_INTRO}</p>

        <FilterBar
          categories={CATEGORIES}
          counts={counts}
          active={filter}
          onChange={handleFilterChange}
        />

        <MasonryGallery items={visible} onOpen={setActiveIndex} />
      </div>

      {activeIndex !== null && visible[activeIndex] ? (
        <Lightbox
          items={visible}
          index={activeIndex}
          onClose={closeLightbox}
          onStep={stepLightbox}
          onSelect={setActiveIndex}
        />
      ) : null}
    </section>
  );
}
