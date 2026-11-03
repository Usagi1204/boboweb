'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Artwork } from '@/data/portfolio';

interface HeroCarouselProps {
  /** 候选作品（服务端已随机抽好），至少 1 张才会渲染这个组件 */
  slides: Artwork[];
  /** 切换间隔（毫秒），默认 5 秒 */
  intervalMs?: number;
}

/**
 * Hero 轮播：每 5 秒随机换一张，交叉淡入淡出
 *
 * 实现要点：
 * - 所有候选图同时渲染、叠在一起，当前图 opacity 1 其余 0，
 *   切换靠 CSS transition，不需要 JS 动画库
 * - 随机换下一张时排除当前张，避免「换了个寂寞」
 * - 组件不可见（tab 切走）时 setInterval 照样跑也没关系，
 *   但切回来立刻换图体验更好，所以监听 visibilitychange 补一次
 */
export default function HeroCarousel({ slides, intervalMs = 5000 }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;

    const pickNext = () => {
      setCurrent((prev) => {
        let next = Math.floor(Math.random() * slides.length);
        // 只有两张时 50% 概率会抽中自己，多试一次就行；更多张时基本一次过
        if (next === prev) next = (next + 1) % slides.length;
        return next;
      });
    };

    const timer = window.setInterval(pickNext, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') pickNext();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slides.length, intervalMs]);

  return (
    <div className="hero-cover__media hero-carousel">
      {slides.map((item, index) => (
        <div
          key={item.id}
          className={`hero-carousel__slide${index === current ? ' is-active' : ''}`}
          aria-hidden={index !== current}
        >
          <Image
            src={item.imageUrl}
            alt={item.alt}
            fill
            sizes="(max-width: 1180px) 100vw, 1180px"
            priority={index === 0}
            style={{ objectFit: 'cover', objectPosition: 'center 42%' }}
          />
        </div>
      ))}
      {/* 轮播序号指示：纯装饰，不可点 */}
      {slides.length > 1 ? (
        <ol className="hero-carousel__dots" aria-hidden="true">
          {slides.map((item, index) => (
            <li key={item.id} className={index === current ? 'is-active' : ''} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
