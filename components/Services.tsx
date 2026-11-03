import { SERVICES, type ServiceItem } from '@/data/site';

/**
 * 服务项目区块（画廊下方）
 *
 * 刻意做得极简：一行一项，只给「名称 + 一句话说明」，不标价。
 * 不做卡片、不做图标、不堆卖点——访客看完作品往下滑，需要的只是
 * 「我要做的这一款大概花多久」。
 *
 * 不标价是有意的：甲型、长度、是否加固都会影响报价，写成固定数字反而要在
 * 店里反复解释。想知道的直接微信问，一句话能答，也顺便成了咨询入口。
 *
 * 默认用 data/site.ts 的静态清单；page.tsx 会传入数据库里的版本（后台可改）。
 */
interface ServicesProps {
  items?: ServiceItem[];
}

export default function Services({ items = SERVICES }: ServicesProps) {
  return (
    <section className="section services" id="services">
      <div className="container">
        <div className="section__head">
          <div>
            <p className="eyebrow">Services</p>
            <h2 className="section__title">服务项目</h2>
          </div>
          <p className="section__desc">
            时长按甲型与加固需求会有浮动。想做的款式和价格，微信问一句就能给你准数。
          </p>
        </div>

        {items.length === 0 ? (
          /* 后台把项目全删了时如实说明，不偷换成静态清单 */
          <p className="svc-list__empty">项目正在整理，直接微信问我就行。</p>
        ) : (
          <ul className="svc-list">
            {items.map((item, index) => (
              <li className="svc-list__row" key={`${item.name}-${index}`}>
                <span className="svc-list__idx" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="svc-list__body">
                  <h3 className="svc-list__name">{item.name}</h3>
                  <p className="svc-list__note">{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
