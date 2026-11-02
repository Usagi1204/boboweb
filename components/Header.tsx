import Link from 'next/link';

/** 站点顶栏：品牌 + 锚点导航 + 预约入口。纯静态，无需客户端状态 */
export default function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="#top" className="brand">
          <span className="brand__mark">BOBO</span>
          <span className="brand__sub">Nail Studio</span>
        </Link>

        {/* 导航顺序与页面区块顺序一致，避免点了之后往回跳 */}
        <nav className="site-nav" aria-label="主导航">
          <Link href="#gallery">作品集</Link>
          <Link href="#services">服务项目</Link>
          <Link href="#about">关于</Link>
          <Link href="#contact">联系预约</Link>
        </nav>

        <Link href="#contact" className="btn btn--primary btn--sm">
          微信预约
        </Link>
      </div>
    </header>
  );
}
