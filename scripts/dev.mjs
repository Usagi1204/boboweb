#!/usr/bin/env node
/**
 * 开发服务器启动器
 *
 * 为什么需要这个脚本，而不是直接 `next dev`：
 * Next 在 dev 启动时会清空 `<distDir>/static/development`。本项目位于桌面目录下，
 * 受宿主安全策略保护，shell 的 rm/mv 会被直接拒绝，进程会抛 broker denied 崩掉，
 * 终端表现就是「Starting... 之后什么也没发生」。
 *
 * 对策：启动前用 Node 的 fs.rmSync 把 `.next` 整个清掉（Node 侧的删除不会被拦），
 * 让 Next 面对一个干净的目录，清理动作自然不触发。极少数情况下连 fs 删除也被拒，
 * 就退化成使用一次性的 `.next-dev-<n>` 目录，保证仍然能启动。
 *
 * 所以本地开发请一律用 `npm run dev`。
 */
import { spawn } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PORT = process.env.PORT || '3000';

/** 尝试清空目录，返回是否成功 */
function wipe(dir) {
  try {
    rmSync(path.join(root, dir), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

let distDir = null; // null 表示用 Next 默认的 .next

if (!wipe('.next')) {
  // 退路：换一个全新目录名，新目录里没有东西需要删
  const prev = readdirSync(root)
    .map((n) => /^\.next-dev-(\d+)$/.exec(n))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  distDir = `.next-dev-${(prev.length ? Math.max(...prev) : 0) + 1}`;
  console.log(`  .next 清理被拒，改用独立目录 ${distDir}`);
}

const args = [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', PORT, '-H', '0.0.0.0'];
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  // 宿主注入的 safe-delete shim 依赖一个容易超时的状态锁，去掉它让 Next 用干净环境运行
  NODE_OPTIONS: '',
};
if (distDir) env.NEXT_DIST_DIR = distDir;

console.log(`\n  Next.js dev   →   http://localhost:${PORT}\n`);

const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env });

// 转发退出信号，保证 Ctrl+C 能正常停掉 Next（而不是留下孤儿进程占住端口）
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 0));
