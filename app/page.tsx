import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PortfolioSection from '@/components/PortfolioSection';
import About from '@/components/About';
import Footer from '@/components/Footer';
import { artworks } from '@/data/portfolio';

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="top">
        {/* Hero 的封面图直接取作品集里的一张，避免再维护一份图片配置 */}
        <Hero cover={artworks[7]} totalCount={artworks.length} />
        <PortfolioSection artworks={artworks} />
        <About />
      </main>
      <Footer />
    </>
  );
}
