'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  /** 要复制的文本（微信号） */
  value: string;
  /** 视觉样式：icon 只显示图标，inline 图标 + 文字 */
  variant?: 'icon' | 'inline';
  /** 复制成功后按钮上的文字 */
  copiedLabel?: string;
  /** 兜底选中文本时定位的节点 id；同页多处使用时必须各不相同 */
  textId?: string;
  className?: string;
}

/**
 * 复制微信号的按钮
 *
 * 复制有三条路，按可靠性依次降级：
 *   1. navigator.clipboard.writeText —— 需要安全上下文（https 或 localhost）
 *   2. document.execCommand('copy') —— http 页面（如手机连局域网 IP）走这条
 *   3. 两条都不行 —— 选中文本，提示手动复制，绝不假装成功
 *
 * 第 2 条是移动端的真实主力路径，所以里面针对 iOS Safari 做了专门处理：
 * 它对 readonly 元素的 select() 无效，必须临时改成可编辑再套 Range 选区。
 */
export default function CopyButton({
  value,
  variant = 'icon',
  copiedLabel = '已复制',
  textId,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'done' | 'manual'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清掉定时器，避免在已卸载的组件上 setState
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = useCallback((next: 'done' | 'manual') => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2200);
  }, []);

  const handleCopy = useCallback(async () => {
    // 1. 标准 API（https / localhost）
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        flash('done');
        return;
      } catch {
        /* 权限被拒或非安全上下文，继续降级 */
      }
    }

    // 2. execCommand 兜底（http 页面、老浏览器）
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      // 必须留在可视区域内才能被选中，靠透明 + 移出屏幕右侧隐藏
      el.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
      document.body.appendChild(el);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // iOS 上 readonly 元素无法 select()，改成可编辑 + Range 才选得中
        el.readOnly = false;
        el.contentEditable = 'true';
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        el.select();
      }
      el.setSelectionRange(0, value.length);

      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      if (ok) {
        flash('done');
        return;
      }
    } catch {
      /* 继续降级 */
    }

    // 3. 都不行就选中页面上的微信号文本，让用户自己按 Cmd/Ctrl+C
    const target = document.getElementById(textId ?? `wechat-text-${variant}`);
    if (target) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    flash('manual');
  }, [value, variant, textId, flash]);

  // 降级文案要同时对触屏和鼠标成立：「长按」和「Ctrl+C」都写进去会太长
  const label = state === 'done' ? copiedLabel : state === 'manual' ? '已选中' : '复制微信号';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[className, 'copy-btn', `copy-btn--${variant}`].filter(Boolean).join(' ')}
      aria-label={`复制微信号 ${value}`}
      title={state === 'manual' ? '复制失败，微信号已选中，请手动复制' : `复制微信号 ${value}`}
      data-state={state}
    >
      <span className="copy-btn__icon" aria-hidden="true">
        {state === 'done' ? (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="7.2" y="7.2" width="9" height="9" rx="2" />
            <path d="M12.8 4.8H6.2a2 2 0 0 0-2 2v6.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {variant === 'inline' ? <span className="copy-btn__text">{label}</span> : null}
      {/* 读屏播报：视觉上隐藏，但让状态变化可被听见 */}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'done'
          ? '微信号已复制到剪贴板'
          : state === 'manual'
            ? '复制失败，微信号已选中，请手动复制'
            : ''}
      </span>
    </button>
  );
}
