import { CONTACT } from '@/data/site';

/**
 * 关于区块
 *
 * 原来的右侧价目表已移到画廊下方的「服务项目」区块，
 * 这里换成「到店须知」——访客看完介绍，紧接着需要知道的就是怎么约、什么时候来。
 *
 * 「到店须知」是全站营业信息的唯一出处：营业时间、每日接待量、预约提前量
 * 合成一条显示，预约区块与页脚都不再重复（详见 data/site.ts 的 CONTACT.hoursNote）。
 */
export default function About() {
  return (
    <section className="section about" id="about">
      <div className="container">
        <div className="section__head">
          <div>
            <p className="eyebrow">About the studio</p>
            <h2 className="section__title">关于这间小店</h2>
          </div>
        </div>

        <div className="about__grid">
          <div>
            <p className="about__quote">
              我不做“网红款”，只做<span>能安心戴满三周</span>的指甲。
            </p>
            <p className="about__text">
              BOBO NAIL 是我一个人的小工作室——没有前台，也没有驻店团队。
              从沟通、修型、打底到最后一层封层，都是我一个人做完，不会做到一半换人接手。
              所有甲油胶与工具按单人单套消毒，卸甲免费。
              做之前会先聊清楚你的日常：是否常打字、是否带娃、指甲是否容易断，
              再决定甲型与长度，而不是硬套图片。
            </p>
            <p className="about__text">
              工作室刚起步，到现在服务过一百多位客人。没有连锁店的流水线，
              换来的是每个人的手都记得住——你上次做过什么、哪根手指容易起翘，我都留着记录。
            </p>
          </div>

          <div className="about__facts">
            <p className="about__facts-title">到店须知</p>
            <ul>
              <li>
                <strong>营业与预约</strong>
                {CONTACT.hoursNote}
              </li>
              <li>
                <strong>地址</strong>
                {CONTACT.addressNote}
              </li>
              <li>
                <strong>关于款式</strong>
                自带参考图或作品编号都能聊，卸甲免费
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
