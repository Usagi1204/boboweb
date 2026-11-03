'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CopyButton from './CopyButton';
import { WECHAT_ID } from '@/data/site';

/**
 * 移动端右下角固定的「加微信」浮层
 *
 * 只在窄屏出现（桌面端已有底部预约区块，不需要再挂一个浮标）。
 * 交互：点圆形按钮展开气泡 → 气泡里显示微信号 + 复制按钮 → 点外部或 Esc 收起。
 *
 * 该浮层位于页面最外层，用 fixed 定位，不参与文档流，所以不会被画廊重排影响。
 */
export default function WeChatFloat({ wechatId = WECHAT_ID }: { wechatId?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    // 点浮层以外的地方收起
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    };
    // Esc 收起，和灯箱保持一致的键盘习惯
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div className="wechat-fab" ref={wrapRef} data-open={open ? 'true' : 'false'}>
      {/* 气泡：用 data-open 控制显隐，保留过渡动画 */}
      <div
        className="wechat-fab__panel"
        id="wechat-fab-panel"
        role="dialog"
        aria-label="加微信预约"
        aria-hidden={open ? 'false' : 'true'}
      >
        <p className="wechat-fab__title">加微信约时间</p>
        <p className="wechat-fab__id" id="wechat-text-fab">
          {wechatId}
        </p>
        <CopyButton
          value={wechatId}
          variant="inline"
          textId="wechat-text-fab"
          copiedLabel="已复制，去微信添加"
          className="wechat-fab__copy"
        />
        <p className="wechat-fab__hint">发作品编号或参考图，帮你确认甲型</p>
      </div>

      <button
        type="button"
        className="wechat-fab__btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="wechat-fab-panel"
        aria-label={open ? '收起微信号' : '展开微信号'}
      >
        <span aria-hidden="true" className="wechat-fab__icon">
          {/* 微信气泡图标：两个圆角气泡 + 两个点，纯手写 path，不引外部资源 */}
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M9.2 3.4c3.5 0 6.4 2.3 6.4 5.2 0 .3 0 .5-.1.8a6.6 6.6 0 0 0-2.6-.5c-2.9 0-5.2 1.8-5.2 4 0 .5.1 1 .3 1.4-.3 0-.5.1-.8.1-.5 0-1-.1-1.4-.2l-1.7.9.5-1.5c-1.3-.9-2.1-2.2-2.1-3.6 0-2.9 2.9-5.2 6.4-5.2Zm-2.2 3.1a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Zm4.4 0a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z" />
            <path d="M17 10c2.8 0 5 1.8 5 4.1 0 1.2-.7 2.2-1.7 2.9l.4 1.2-1.4-.7c-.5.1-1 .2-1.5.2-1 0-2-.2-2.7-.6a3.7 3.7 0 0 0 1-2.5c0-2.1-1.7-3.9-4-4.4.7-.2 1.6-.2 2.4-.2Zm-1.9 2.6a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Zm3.5 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
