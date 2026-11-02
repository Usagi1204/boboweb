import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PortfolioSection from '@/components/PortfolioSection';
import Services from '@/components/Services';
import About from '@/components/About';
import BookingCTA from '@/components/BookingCTA';
import Footer from '@/components/Footer';
import WeChatFloat from '@/components/WeChatFloat';
import { getWorks } from '@/lib/works';

/**
 * 每次请求都重新读数据
 *
 * 后台传完图要"刷新就能看到"，用 ISR 缓存会出现最长 N 秒的延迟，
 * 与验收标准冲突。作品量在百张以内，一次查询的开销可以忽略。
 *
 * 以后量大了想提速，把这里改成 export const revalidate = 60，
 * 并在后台的 Server Action 里 call revalidatePath('/') 立即失效即可。
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { works } = await getWorks();

  // 封面默认取第 8 张（构图通常更完整）；作品不足时退回第一张，一张都没有则不显示封面
  const cover = works[7] ?? works[0] ?? null;

  return (
    <>
      <Header />
      <main id="top">
        <Hero cover={cover} totalCount={works.length} />
        <PortfolioSection artworks={works} />
        {/* 看完作品接着想知道价格与耗时，所以服务项目紧跟画廊 */}
        <Services />
        <About />
        <BookingCTA />
      </main>
      <Footer />
      {/* 移动端专用浮标，桌面端由 CSS 隐藏 */}
      <WeChatFloat />
    </>
  );
}
