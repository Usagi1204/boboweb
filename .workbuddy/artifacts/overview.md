# Supabase 链路打通 · 完成报告（2026-11-03）

> 上一份报告（替换真实作品照片）已完成归档，本文件更新为管理后台联调收尾。

## 结果

23/23 作品已迁移至 Supabase（`nail_works` 表 + `nail-images` 存储桶），前台、图片、后台自检全部通过：

| 验证项 | 结果 |
| --- | --- |
| 迁移上传 + 写库 | 23/23 成功，库内复核 23 条 |
| 前台读 Supabase | ✅ 卡片 src 已指向 Storage 公开地址 |
| 图片可达 | ✅ 200 image/jpeg（经代理） |
| check:admin 端到端 | 16/16 通过 |
| tsc --noEmit | 通过 |

## 过程中解决的问题（按顺序）

1. **`*.supabase.co` 被墙**：代理规则表缺 `DOMAIN-SUFFIX,supabase.co` → 用户已加规则
2. **代理端口漂移**：客户端 HTTP 端口 56840→6478，项目改为从 `.env.local` 读 `SUPABASE_PROXY_URL`
3. **Node 22 代理支持无效**：`NODE_USE_ENV_PROXY` 实测不工作 → 引入 undici `fetch` + `ProxyAgent`，新建 `lib/supabase/proxy-fetch.ts`，接入 server.ts / middleware / 迁移脚本
4. **middleware 切 Node runtime**（edge 跑不了 undici），并给 `getUser()` 加网络异常兜底
5. **上传 MIME 丢失**：storage-js 把 Blob 包进 FormData，经代理序列化 content-type 变 text/plain 被拒 → 改传 Uint8Array
6. **图片优化器 500**：`/next/image` 服务端取图不走代理 → 设 `SUPABASE_PROXY_URL` 时自动 `images.unoptimized`

## 改动文件

- 新增 `lib/supabase/proxy-fetch.ts`
- 修改 `lib/supabase/server.ts`、`middleware.ts`、`next.config.js`、`scripts/migrate-to-supabase.mjs`、`README.md`（新增排障文档）、`.env.local`（追加 SUPABASE_PROXY_URL）

## 待办 / 提醒

- [ ] `.env.local` 里的 `SUPABASE_MIGRATE_PASSWORD` 建议删除（迁移已完成）
- [ ] 用户在浏览器实际登录 `/admin` 验收
- [ ] 局域网无代理设备看图会退化成色块（网络环境限制，非 bug，README 已说明）
- [ ] 部署 Vercel 时**不要**带 `SUPABASE_PROXY_URL` 和 `SUPABASE_MIGRATE_*`
