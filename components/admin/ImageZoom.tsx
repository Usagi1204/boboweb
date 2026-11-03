'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

/**
 * 后台图片点击放大
 *
 * 交互（为「看顾客样图细节」设计）：
 * 1. 点缩略图 → 全屏遮罩打开，图片先按「适应窗口」显示（整图全貌）
 * 2. 再点图片 → 切换到「原图尺寸」，容器可滚动拖拽，看清细节
 * 3. 再点图片 → 切回适应窗口；Esc / 点空白 / 点右上角 × 关闭
 *
 * children 是缩略图内容（调用方决定用 next/image 还是原生 img），
 * 大图始终用原生 img：作品图是公开 URL、样图是签名 URL，
 * 都不需要、也不能走 next/image 优化器。
 */
export default function ImageZoom({
  src,
  alt,
  children,
}: {
  /** 大图地址（公开 URL 或签名 URL） */
  src: string;
  alt: string;
  /** 缩略图内容 */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /** true = 原图尺寸模式（看细节）；false = 适应窗口 */
  const [detail, setDetail] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setDetail(false);
  }, []);

  // Esc 关闭 + 打开时锁住背景滚动
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className="admin-zoom__trigger"
        onClick={() => setOpen(true)}
        aria-label={`放大查看：${alt}`}
        title="点击放大"
      >
        {children}
      </button>

      {open ? (
        <div
          className="admin-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
        >
          {/* 点空白处关闭；点在图区上不冒泡，交给图片自己的缩放切换 */}
          <div
            className={`admin-zoom__stage${detail ? ' is-detail' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="admin-zoom__img"
              onClick={() => setDetail((v) => !v)}
            />
          </div>

          <p className="admin-zoom__hint" aria-hidden="true">
            {/* 桌面提示键盘操作；触屏设备由 CSS 换成不带 Esc 的文案 */}
            <span className="admin-zoom__hint--pointer">
              {detail ? '滚动查看细节 · 点图片收回 · Esc 关闭' : '点图片放大看细节 · Esc 关闭'}
            </span>
            <span className="admin-zoom__hint--touch">
              {detail ? '点图片收回 · 点空白处关闭' : '轻点图片看原图细节 · 点空白处关闭'}
            </span>
          </p>

          <button
            type="button"
            className="admin-zoom__close"
            onClick={close}
            aria-label="关闭大图"
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
