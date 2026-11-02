const SERVICES = [
  { name: '纯色 / 猫眼', note: '60 — 90 分钟' },
  { name: '法式 / 微法式', note: '70 — 95 分钟' },
  { name: '晕染 / 大理石', note: '90 — 120 分钟' },
  { name: '手绘 / 立体装饰', note: '110 — 150 分钟' },
  { name: '延长甲 / 甲型修复', note: '150 — 180 分钟' },
];

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
              我们不做“网红款”，只做<span>能安心戴满三周</span>的指甲。
            </p>
            <p className="about__text">
              BOBO NAIL 是一间只有四个座位的小工作室。每位客人固定一位美甲师从头做到尾，
              不做流水线交接。所有甲油胶与工具都按单人单套消毒，卸甲免费。
              做之前会先聊清楚你的日常——是否常打字、是否带娃、指甲是否容易断，
              再决定甲型与长度，而不是硬套图片。
            </p>
          </div>

          <div id="services">
            <ul className="service-list">
              {SERVICES.map((item, index) => (
                <li key={item.name}>
                  <span className="service-list__idx">{String(index + 1).padStart(2, '0')}</span>
                  <span className="service-list__name">{item.name}</span>
                  <span className="service-list__note">{item.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
