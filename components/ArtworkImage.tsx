'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Artwork } from '@/data/portfolio';
import styles from './Portfolio.module.css';

interface ArtworkImageProps {
  item: Artwork;
  /**
   * 传给 next/image 的 sizes。
   * 浏览器靠它决定下载哪一档宽度，移动端才不会白拉一张 1200px 的大图。
   */
  sizes: string;
  /** card = 瀑布流卡片（按原比例撑开）；full = 灯箱大图（填满容器） */
  variant?: 'card' | 'full';
  /** 首屏关键图才开，其余保持懒加载 */
  priority?: boolean;
}

/**
 * 作品图
 *
 * 相比直接写 <Image>，多做了一件小事：加载失败时不留破图标，
 * 而是换成一块取自该作品主色的柔和色块，同时在控制台打出文件名，
 * 方便上线后一眼看出是哪张图丢了。
 */
export default function ArtworkImage({
  item,
  sizes,
  variant = 'card',
  priority = false,
}: ArtworkImageProps) {
  const [failed, setFailed] = useState(false);

  // 灯箱翻页会换图；换图时重置状态，否则上一张的兜底块会粘在新图上
  useEffect(() => {
    setFailed(false);
  }, [item.imageUrl]);

  if (failed) {
    return (
      <span
        className={variant === 'full' ? styles.fallbackFull : styles.fallbackCard}
        style={
          variant === 'full'
            ? { backgroundColor: item.tint }
            : { backgroundColor: item.tint, aspectRatio: `${item.width} / ${item.height}` }
        }
        role="img"
        aria-label={item.alt}
        data-fallback={item.imageUrl}
      />
    );
  }

  const handleError = () => {
    // 需求：失败不显示破图标，并在控制台输出缺失的文件名
    console.warn(`[画廊] 图片加载失败，已用色块顶替：${item.imageUrl}（${item.alt}）`);
    setFailed(true);
  };

  if (variant === 'full') {
    return (
      <Image
        src={item.imageUrl}
        alt={item.alt}
        fill
        sizes={sizes}
        style={{ objectFit: 'contain' }}
        priority={priority}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={item.imageUrl}
      alt={item.alt}
      width={item.width}
      height={item.height}
      sizes={sizes}
      className={styles.image}
      priority={priority}
      onError={handleError}
    />
  );
}
