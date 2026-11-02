'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Artwork } from '@/data/portfolio';
import ArtworkImage from './ArtworkImage';
import styles from './Lightbox.module.css';

interface LightboxProps {
  /** 当前筛选结果集，灯箱翻页只在集合内循环 */
  items: Artwork[];
  /** 当前展示的下标 */
  index: number;
  onClose: () => void;
  /** 翻页：+1 下一张，-1 上一张 */
  onStep: (delta: number) => void;
  /** 直接跳到某张（预留给缩略图导航） */
  onSelect?: (index: number) => void;
}

/**
 * 灯箱
 *
 * 交互覆盖：
 * - 点击遮罩 / 关闭按钮 / Esc 关闭
 * - ← → 键翻页，首尾循环
 * - 打开时锁定 body 滚动，关闭后恢复
 * - 打开后焦点移到关闭按钮，键盘用户不会「丢失」焦点
 */
export default function Lightbox({ items, index, onClose, onStep }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];

  // 键盘：Esc 关闭，左右翻页
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onStep(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onStep(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onStep]);

  // 锁定背景滚动，避免灯箱打开时页面还能滚
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // 打开后把焦点移到关闭按钮
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!item) return null;

  const aspectRatio = item.width / item.height;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`作品大图：${item.title}`}
      onClick={(event) => {
        // 只有点到遮罩本身才关闭，点内容区不关闭
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="关闭大图">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowPrev}`}
        onClick={() => onStep(-1)}
        aria-label="上一张"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M12.5 4L6.5 10L12.5 16"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className={styles.stage}>
        <figure className={styles.figure}>
          <div className={styles.frame} style={{ '--ar': aspectRatio } as CSSProperties}>
            <ArtworkImage
              item={item}
              variant="full"
              sizes="(max-width: 720px) 94vw, (max-width: 1180px) 92vw, 1040px"
              priority
            />
          </div>

          <figcaption className={styles.caption}>
            <div className={styles.captionMain}>
              <span className={styles.chip}>{item.category}</span>
              <h3 className={styles.title}>{item.title}</h3>
              <p className={styles.note}>{item.note}</p>
            </div>
            <dl className={styles.meta}>
              <div>
                <dt>主色调</dt>
                <dd>{item.tone}</dd>
              </div>
              <div>
                <dt>常规耗时</dt>
                <dd>{item.duration}</dd>
              </div>
              <div>
                <dt>编号</dt>
                <dd>
                  {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                </dd>
              </div>
            </dl>
          </figcaption>
        </figure>
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowNext}`}
        onClick={() => onStep(1)}
        aria-label="下一张"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M7.5 4L13.5 10L7.5 16"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
