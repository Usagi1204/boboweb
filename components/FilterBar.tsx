'use client';

import type { FilterValue } from '@/data/portfolio';
import styles from './Portfolio.module.css';

interface FilterBarProps {
  /** 展示顺序：'全部' 在首位 */
  categories: readonly FilterValue[];
  /** 每个分类的作品数 */
  counts: Record<FilterValue, number>;
  /** 当前选中分类 */
  active: FilterValue;
  onChange: (next: FilterValue) => void;
}

/**
 * 分类筛选栏
 *
 * 与模板 Artist Portfolio 的 FilterBar 对应，标签已从
 * Illustration / Photography / 3D 换成本项目的五个美甲分类。
 * 文案统一从 data/portfolio.ts 的 CATEGORIES 读取，增删分类只改那一处。
 */
export default function FilterBar({ categories, counts, active, onChange }: FilterBarProps) {
  return (
    <div className={styles.filterBar} role="tablist" aria-label="作品分类筛选">
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="gallery-panel"
            className={isActive ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
            onClick={() => onChange(category)}
          >
            <span>{category}</span>
            <span className={styles.filterCount}>{counts[category]}</span>
          </button>
        );
      })}
    </div>
  );
}
