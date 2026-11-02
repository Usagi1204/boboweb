import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container">
        <div className="site-footer__top">
          <div>
            <Link href="#top" className="brand">
              <span className="brand__mark">BOBO</span>
              <span className="brand__sub">Nail Studio</span>
            </Link>
            <p className="site-footer__hint" style={{ marginTop: 14, maxWidth: '28em' }}>
              营业时间 10:00 — 20:00（周一休息）· 建议提前 3 天预约
            </p>
          </div>

          <div className="site-footer__links">
            <a href="tel:+8613800000000">电话 138-0000-0000</a>
            <a href="mailto:hello@bobonail.example">hello@bobonail.example</a>
            <Link href="#gallery">作品集</Link>
            <Link href="#about">关于</Link>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} BOBO NAIL STUDIO · 保留所有权利</span>
          <span className="site-footer__hint">
            图片来源：本地生成的占位图（public/placeholders）
          </span>
        </div>
      </div>
    </footer>
  );
}
