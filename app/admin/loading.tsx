/**
 * 后台加载骨架
 *
 * 为什么要这个文件：后台全部是动态页面，切换 tab 时要等服务器把数据查完
 * 才会出现新页面，中间没有任何反馈，体感就是「点了没反应」。
 * 有了 loading.tsx，点击后立刻显示骨架，数据到了再替换内容；
 * 同时 Next 的 Link 预取也会把它当占位壳，进一步缩短白等时间。
 */
export default function AdminLoading() {
  return (
    <main className="admin-wrap" aria-busy="true" aria-label="正在加载">
      <header className="admin-bar">
        <div className="admin-bar__left">
          <h1 className="admin-bar__title">管理后台</h1>
          <nav className="admin-tabs" aria-hidden="true">
            <span className="admin-tabs__tab is-active">加载中…</span>
          </nav>
        </div>
      </header>

      <div className="admin-skeleton" role="status">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="admin-skeleton__row">
            <span className="admin-skeleton__thumb" />
            <span className="admin-skeleton__lines">
              <span className="admin-skeleton__line" />
              <span className="admin-skeleton__line admin-skeleton__line--short" />
            </span>
          </div>
        ))}
        <span className="admin-skeleton__sr">正在加载数据…</span>
      </div>
    </main>
  );
}
