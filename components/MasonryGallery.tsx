'use client';

import type { Artwork } from '@/data/portfolio';
import ArtworkImage from './ArtworkImage';
import styles from './Portfolio.module.css';

interface MasonryGalleryProps {
  items: Artwork[];
  /** 点击卡片时回调，参数是该卡片在当前筛选结果中的下标 */
  onOpen: (index: number) => void;
}

/**
 * 瀑布流画廊
 *
 * 用 CSS multi-column 实现：容器给 column-count，卡片 break-inside: avoid。
 * 相比 JS 计算绝对定位，写法简单、无布局抖动、SSR 首屏即可正确渲染。
 * 代价是填充顺序为「先竖后横」，对作品集这种无严格阅读顺序的场景完全够用。
 *
 * 图片全部走 next/image 懒加载，sizes 与下面 CSS 的分栏宽度对齐：
 *   桌面 3 栏 ≈ 342px / 平板 2 栏 ≈ 45vw / 手机 1 栏 ≈ 100vw - 40px
 */
const CARD_SIZES =
  '(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) calc(45vw - 10px), (max-width: 1180px) calc(33vw - 51px), 342px';

export default function MasonryGallery({ items, onOpen }: MasonryGalleryProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>这个分类还没有作品，换个标签看看。</p>;
  }

  return (
    <div className={styles.gallery} id="gallery-panel">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={styles.card}
          onClick={() => onOpen(index)}
          aria-label={`查看作品：${item.title}（${item.category}）`}
        >
          <span className={styles.imageWrap}>
            <ArtworkImage item={item} sizes={CARD_SIZES} />
          </span>

          <span className={styles.overlay}>
            <span className={styles.cardTitle}>{item.title}</span>
            <span className={styles.cardMeta}>
              <span className={styles.chip}>{item.category}</span>
              <span className={styles.cardIndex}>{String(index + 1).padStart(2, '0')}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
