# 极简管理后台

## 现在是什么状态

代码全部写完、类型检查与生产构建通过。**但还没接你的 Supabase** —— 建项目、拿 key 这两步必须你本人操作，我不能代持账号。

所以现在的行为是：

| 访问 | 表现 |
| --- | --- |
| `http://localhost:3000` | 完全正常，23 张作品照旧（读本地 `artworks.json`） |
| `http://localhost:3000/admin` | 显示一份五步配置指引，照着做完就能用 |

配好 `.env.local` 并重启后，`/admin` 会自动变成登录页，前台改为从 `nail_works` 表读数据。

## 新增了什么

```
supabase/schema.sql              建表 + RLS + 存储桶，一次跑完，可重复执行
middleware.ts                    后台守卫 + 登录态刷新
lib/works.ts                     数据源：Supabase 优先，本地 JSON 兜底
lib/supabase/{config,client,server}.ts
app/admin/
  layout.tsx / admin.css         后台外壳与样式（中性工具风，不污染前台）
  page.tsx                       主面板 / 或配置指引
  actions.ts                     Server Action：新建、删除、退出
  login/page.tsx + LoginForm.tsx 邮箱密码登录
components/admin/
  UploadForm.tsx                 上传表单
  WorkList.tsx                   作品列表 + 删除
scripts/migrate-to-supabase.mjs  把现有 23 张导入 Supabase
scripts/admin-check.mjs          自检
```

## 数据流

```
前台 ─┐
      ├─→ lib/works.ts getWorks() ─┬─ 配了且成功 → nail_works 表（created_at 倒序）
后台 ─┘                            ├─ 没配        → data/artworks.json（23 张）
                                   └─ 配了但报错  → 回退 json + 控制台记 error
```

**"表为空"不触发回退**。空就是空 —— 否则删光作品后前台又冒出本地 23 张，会以为删除没生效。

## 三个设计决定

### 1. 上传是浏览器直传 Storage，不走服务端

Vercel 的 Server Action 有请求体大小限制，一张手机原图就可能顶到上限。
所以图片由浏览器直传，元数据（分类、描述、宽高）再通过 Server Action 写表 ——
这样服务端仍能校验一次权限和分类，安全不打折。

写表失败时会删掉刚上传的文件，不留孤儿文件占额度。

### 2. 表里多加了 width / height 两列

你给的字段清单是 `id / image_url / style_category / description / created_at` 五个。
多这两列是因为瀑布流靠真实宽高算比例，缺了会先按 3:4 撑开、图片加载完再跳变（CLS 抖动）。
上传表单会读 `naturalWidth/naturalHeight` 写进去；手工插数据留空也能跑，走兜底比例。

### 3. "只有我能进"做了三层

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 1 | `middleware.ts` | 未登录访问 `/admin` 跳登录页 |
| 2 | `checkAdmin()` | 校验登录态 + 邮箱白名单 |
| 3 | `schema.sql` 的 RLS | `auth.jwt() ->> 'email' = 'usagi520x@gmail.com'` |

第 3 层才是真边界。Supabase 默认允许任何人自助注册，只在代码里判断"已登录"的话，
别人注册个号就能调 API 删你的作品。

**代价**：改 `ADMIN_EMAIL` 必须同时改 `schema.sql` 里的 4 处邮箱并重跑脚本。
只改一处会出现"能登录但写不进去"。`npm run check:admin` 有断言盯着这个不一致。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `next build` | 通过，`/` `/admin` `/admin/login` 均为动态渲染（ƒ） |
| `npm run check:admin` | **17/17 通过** |
| `npm run check:booking` | 回归通过（改动过 Hero / PortfolioSection / Lightbox） |
| 未配 env 的降级 | 前台 23 张正常；`/admin` 显示 5 步指引 |
| 假凭据下的中间件 | `/admin` → 307 → `/admin/login`；登录页 200 且表单齐全 |
| Supabase 不可达 | 前台回退本地数据，错误只进控制台不进页面 |
| 源码硬编码密码扫描 | 0 处 |
| `.env.local` 被 git 忽略 | 是 |

### 一个只有生产模式才暴露的坑

第一次构建后 `/admin` 被标成 **○ Static**（静态预渲染）。因为构建时没有环境变量，
Next 把「配置指引页」当成静态结果固化进了产物 —— 线上配好 Supabase 后，`/admin`
会永远显示指引页，改配置毫无反应，极难排查。

修法是给页面加 `export const dynamic = 'force-dynamic'`，重新构建后变成 **ƒ Dynamic**。
已在生产模式下实测确认。

## 你要做的三件事

### 1. 建 Supabase 项目并跑脚本

按 `/admin` 页面里的五步走，或看 README 第四节六。核心就两句：

- SQL Editor 粘贴 `supabase/schema.sql` 全文，Run
- Authentication → Users 里建 `usagi520x@gmail.com`，并把 **Confirm email 关掉**
  （不关的话账号卡在未验证状态登不进去）

### 2. 填 `.env.local`

```bash
cp .env.example .env.local
```

填 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（Project Settings → API）。

⚠️ **改完必须重启 dev**。用 build+start 模式的话必须**重新构建** ——
`NEXT_PUBLIC_*` 在构建时就写进 JS 了，只重启进程不生效。

### 3. 把现有 23 张导进去（不导的话前台会空白）

```bash
# .env.local 里临时加两行
SUPABASE_MIGRATE_EMAIL=usagi520x@gmail.com
SUPABASE_MIGRATE_PASSWORD=你的密码

npm run db:migrate
```

跑完删掉那两行密码。脚本可重复执行，已存在的会跳过。

## ⚠️ 关于密码

任务描述里带了明文密码。我**没有把它写进任何文件**（自检脚本会扫源码确认），
但有两件事建议你处理：

1. **那个密码已经出现在任务描述里了**，如果项目有其他成员可见，等于已经泄露。
   建议在 Supabase 建账号时换一个新密码。
2. 登录密码只存在于两处：Supabase 控制台（你设的）和 `.env.local`（迁移时临时用）。
   代码里永远不需要它。

## 部署到 Vercel

Settings → Environment Variables 里加 `NEXT_PUBLIC_SUPABASE_URL`、
`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`ADMIN_EMAIL` 三项，Production / Preview / Development 都勾上。

`SUPABASE_MIGRATE_*` 不要加 —— 那是本地迁移脚本专用的。

## 没验证到的部分

**登录 → 上传 → 前台出现新图** 这条完整链路，需要真实的 Supabase 项目才能跑。
我验证到了它的每一段（中间件跳转、登录页渲染、上传表单逻辑、Server Action 校验、
降级路径、生产构建），但没有你的项目就无法端到端跑一遍。

你配好之后，最快的确认方式就是跑一次验收标准里的动作：`/admin` 登录 → 传一张图 →
前台刷新看它是否出现在第一张。如果有问题，把 `/admin` 页面上的报错文字发我。
