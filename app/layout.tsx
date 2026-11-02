import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BOBO NAIL · 美甲作品集',
  description:
    'BOBO NAIL 美甲工作室作品集：纯色、法式、晕染、手绘、延长甲，按款式分类浏览每一件指尖作品。',
  keywords: ['美甲', '作品集', '法式美甲', '晕染', '手绘美甲', '延长甲', 'nail art'],
  openGraph: {
    title: 'BOBO NAIL · 美甲作品集',
    description: '按款式浏览指尖作品：纯色 / 法式 / 晕染 / 手绘 / 延长甲。',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#faf6f2',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
