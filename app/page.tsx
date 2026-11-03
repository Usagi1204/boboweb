import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PortfolioSection from '@/components/PortfolioSection';
import Services from '@/components/Services';
import About from '@/components/About';
import BookingCTA from '@/components/BookingCTA';
import BookingSchedule from '@/components/BookingSchedule';
import Footer from '@/components/Footer';
import WeChatFloat from '@/components/WeChatFloat';
import { getBookingSlots } from '@/lib/bookings';
import { getSiteContent } from '@/lib/content';
import { getServices } from '@/lib/services';
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

/** Hero 轮播候选数：太少重复感强，太多首屏要排队加载 */
const HERO_SLIDE_COUNT = 8;

export default async function HomePage() {
  // 四个数据源互相独立，任何一个失败都有各自的兜底，不会拖垮整页
  const [{ works }, { content }, { services }, slotsResult] = await Promise.all([
    getWorks(),
    getSiteContent(),
    getServices(),
    getBookingSlots(),
  ]);

  // 轮播候选：随机抽 N 张。每次都随机，首页每次打开看到的顺序都不一样
  const slides = [...works]
    .sort(() => Math.random() - 0.5)
    .slice(0, HERO_SLIDE_COUNT);

  return (
    <>
      <Header showSchedule={slotsResult.available} />
      <main id="top">
        <Hero
          slides={slides}
          totalCount={works.length}
          titleA={content.heroTitleA}
          titleB={content.heroTitleB}
          lead={content.heroLead}
          servedClients={content.servedClients}
        />
        <PortfolioSection artworks={works} artistIntro={content.artistIntro} />
        {/* 看完作品接着想知道价格与耗时，所以服务项目紧跟画廊 */}
        <Services items={services} />
        <About
          quoteA={content.aboutQuoteA}
          quoteB={content.aboutQuoteB}
          quoteC={content.aboutQuoteC}
          text1={content.aboutText1}
          text2={content.aboutText2}
          hoursNote={content.hoursNote}
          addressNote={content.addressNote}
        />
        {/* 预约时间表：数据源可用才渲染，没跑 schema-v2.sql 时整个区块不出现 */}
        {slotsResult.available ? <BookingSchedule slots={slotsResult.slots} /> : null}
        <BookingCTA
          wechat={content.wechat}
          eyebrow={content.bookingEyebrow}
          title={content.bookingTitle}
          lead={content.bookingLead}
          hint={content.bookingHint}
        />
      </main>
      <Footer />
      {/* 移动端专用浮标，桌面端由 CSS 隐藏 */}
      <WeChatFloat wechatId={content.wechat} />
    </>
  );
}
