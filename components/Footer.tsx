import Link from 'next/link';

/**
 * 页脚
 *
 * 只放品牌、导航与版权。
 *
 * 微信号曾经也在这里，但正上方的预约区块已经给了微信号和复制按钮，
 * 一屏之内出现两遍同样的号码是纯冗余——删掉，联系方式全站只在预约区块一处。
 * （营业信息同理，只保留「到店须知」一处，不再在页脚重复。）
 */
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <Link href="#top" className="brand">
            <span className="brand__mark">BOBO</span>
            <span className="brand__sub">Nail Studio</span>
          </Link>

          <div className="site-footer__links">
            <Link href="#gallery">作品集</Link>
            <Link href="#services">服务项目</Link>
            <Link href="#about">关于</Link>
            <Link href="#contact">联系预约</Link>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} BOBO NAIL STUDIO · 保留所有权利</span>
          <span className="site-footer__hint">图片均为工作室实拍，请勿转载</span>
        </div>
      </div>
    </footer>
  );
}
