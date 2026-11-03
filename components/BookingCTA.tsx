import CopyButton from './CopyButton';
import { BOOKING_CTA, WECHAT_ID } from '@/data/site';

/**
 * 底部预约引导（原模板 CommissionsCTA 的位置与作用）
 *
 * 全站只留一个联系方式：微信号。没有电话、没有邮箱、没有第三方表单——
 * 独立美甲师的实际沟通本来就发生在微信里，多留渠道只会增加维护成本。
 *
 * 这里只负责「怎么联系」这一件事。营业时间、接待量、预约提前量属于「到店须知」，
 * 由紧挨着的 About 区块统一说明，此处不再重复一遍。
 *
 * 文案与微信号默认取 data/site.ts 的出厂值；page.tsx 会传入后台改过的值。
 */
interface BookingCTAProps {
  wechat?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  hint?: string;
}

export default function BookingCTA({
  wechat = WECHAT_ID,
  eyebrow = BOOKING_CTA.eyebrow,
  title = BOOKING_CTA.title,
  lead = BOOKING_CTA.lead,
  hint = BOOKING_CTA.hint,
}: BookingCTAProps) {
  return (
    <section className="booking" id="contact">
      <div className="container">
        <div className="booking__inner">
          <div className="booking__copy">
            <p className="eyebrow eyebrow--invert">{eyebrow}</p>
            <h2 className="booking__title">{title}</h2>
            <p className="booking__lead">{lead}</p>
          </div>

          <div className="booking__card">
            <p className="booking__label">微信号</p>
            <div className="booking__row">
              <span className="booking__id" id="wechat-text-inline">
                {wechat}
              </span>
              <CopyButton value={wechat} variant="inline" />
            </div>
            <p className="booking__hint">{hint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
