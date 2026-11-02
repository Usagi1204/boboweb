import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: '管理后台 · BOBO Nail',
  // 后台不需要被搜索引擎收录，也不能被收录
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
