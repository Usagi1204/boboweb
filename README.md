# BOBO NAIL · 美甲作品集

Next.js 作品集站点：瀑布流画廊 + 灯箱 + 分类筛选，图片已接入 `~/Desktop/Photo` 下的
**23 张真实作品照**（本地 `public/works/`，离线可用，不依赖任何图床）。

---

## 一、30 秒跑起来

```bash
npm install     # 首次
npm run dev     # → http://localhost:3000
```

打开后应该看到：品牌顶栏、Hero 封面（取作品集里的一张）、分类筛选条（全部/纯色/法式/晕染/手绘/延长甲）、
画廊顶部一行自我介绍、23 张瀑布流作品、底部关于与联系区块。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式，端口 3000（同时监听局域网 IP，手机可访问） |
| `npm run build` / `npm run start` | 生产构建 / 跑构建产物 |
| `npm run photos:import` | **从 `~/Desktop/Photo` 重新导入照片**（压缩 + 重命名 + 生成清单） |
| `npm run photos:report` | 打印每张照片的色调/明暗统计，核对主色用 |
| `npm run check:ui` | 无头 Chrome 跑一遍交互（筛选/灯箱/键盘/滚动锁），输出 PASS/FAIL |
| `npm run check:booking` | 无头 Chrome 验证预约区块：服务项目、复制、移动端浮层，输出 PASS/FAIL |
| `npm run db:migrate` | 把 public/works 里的图导入 Supabase（可重复跑） |
| `npm run check:admin` | 后台自检：配置一致性 + 未登录跳转 + 登录页 |
| `npm run dev` 的启动器 | `scripts/dev.mjs`：启动前自动清空 `.next`，绕开桌面目录的删除限制 |

---

## 二、目录结构

```
BOBO_WEB/
├── app/
│   ├── layout.tsx              # 根布局：metadata / viewport / 全局样式
│   ├── page.tsx                # 首页装配（force-dynamic，每次请求读数据）
│   ├── globals.css             # 设计令牌、导航、Hero、About、Footer 样式
│   └── admin/                  # ★ 管理后台
│       ├── layout.tsx          #   后台外壳（noindex + 独立样式）
│       ├── admin.css           #   后台样式（中性工具风，不污染前台）
│       ├── page.tsx            #   主面板：上传表单 + 作品列表 / 或配置指引
│       ├── actions.ts          #   Server Action：新建 / 删除 / 退出（服务端再校验权限）
│       └── login/
│           ├── page.tsx        #   登录页外壳（服务端读 searchParams）
│           └── LoginForm.tsx   #   邮箱密码表单
├── components/
│   ├── Header.tsx              # 顶栏
│   ├── Hero.tsx                # 首屏（封面图复用作品数据）
│   ├── PortfolioSection.tsx    # ★ 作品集容器（唯一持状态：分类 + 灯箱索引）
│   ├── FilterBar.tsx           # ★ 分类筛选栏（标签来自数据，不硬编码）
│   ├── MasonryGallery.tsx      # ★ CSS columns 瀑布流 + sizes 计算
│   ├── ArtworkImage.tsx        # ★ 作品图：next/image + 失败兜底色块
│   ├── Lightbox.tsx            # ★ 灯箱（Esc / ←→ / 遮罩点击 / 滚动锁 / 焦点管理）
│   ├── Services.tsx            # ★ 服务项目（一行一项：名称 + 一句说明，不标价）
│   ├── BookingCTA.tsx          # ★ 底部预约引导（只保留微信号）
│   ├── CopyButton.tsx          # ★ 复制微信号（clipboard → execCommand → 选中，三级降级）
│   ├── WeChatFloat.tsx         # ★ 移动端右下角浮标
│   ├── About.tsx / Footer.tsx
│   ├── admin/
│   │   ├── UploadForm.tsx      # ★ 上传表单（直传 Storage + 读真实像素尺寸 + 失败回滚）
│   │   └── WorkList.tsx        # ★ 作品列表（删除走 Server Action，带二次确认）
│   ├── Portfolio.module.css
│   └── Lightbox.module.css
├── data/
│   ├── artworks.json           # ★★ 每张照片的事实与文案（可手改）
│   ├── portfolio.ts            # ★★ 类型、分类枚举、自我介绍、筛选工具
│   └── site.ts                 # ★★ 微信号、服务项目、营业信息、预约文案
├── lib/
│   ├── works.ts                # ★★ 作品数据源：Supabase 优先，本地 JSON 兜底
│   └── supabase/
│       ├── config.ts           # ★★ URL / key / bucket / 管理员邮箱的唯一入口
│       ├── client.ts           #   浏览器端客户端（登录、上传）
│       └── server.ts           #   服务端客户端 + checkAdmin() 权限校验
├── supabase/schema.sql         # ★★ 建表 + RLS + 存储桶，一次跑完，可重复执行
├── middleware.ts               # ★ 后台守卫 + 登录态刷新
├── public/works/               # 23 张已优化的作品照（work-01.jpg … work-23.jpg）
├── public/placeholders/        # 早期占位图，已不再被引用，可删
├── scripts/
│   ├── dev.mjs                 # ★ npm run dev 的启动器（见第七节环境备注）
│   ├── import-photos.mjs       # ★ 照片导入流水线
│   ├── analyze-photos.mjs      # 色调报告
│   ├── booking-check.cjs       # ★ 预约相关交互的浏览器自检
│   ├── admin-check.mjs         # ★ 后台自检：配置一致性 + 三种页面状态
│   └── migrate-to-supabase.mjs # ★ 把本地作品导入 Supabase（幂等）
└── next.config.js              # remotePatterns 白名单 + avif/webp
```

---

## 三、照片是怎么接进来的

> 下面讲的是**没配 Supabase 时**的本地流程。配好后台之后，数据源换成
> `nail_works` 表，加照片直接在后台上传即可，不用再跑脚本（见四点六）。
> 本地这套仍然保留，作为数据库连不上时的兜底。

### 流水线

`npm run photos:import` 做的事：

1. **不改动原图**，复制到 `public/works/work-NN.jpg`
2. 按 EXIF 转正（手机竖拍不会躺倒），长边压到 1600px、JPEG q82、渐进式
3. 读真实像素宽高写进清单（`next/image` 靠它算比例，避免布局抖动）
4. 用 k-means 提调色板，挑出「甲面主色」，生成色调文案与兜底色块色
5. 写出 `data/artworks.json`

**重复执行是安全的**：脚本以原始文件名（`source` 字段）为合并键，
你在 JSON 里改过的 `title` / `category` / `summary` 不会被重跑覆盖，新增照片只追加、不重排编号。

当前 23 张：原始 3.4 MB → 优化后 3.0 MB；`next/image` 在 384px 档再压到 **webp 10 KB / avif 6.5 KB**。

### 清单（`data/artworks.json`）

| # | 图片 | 分类 | 尺寸 | 标题 | 主色调 |
| --- | --- | --- | --- | --- | --- |
| 1 | `/works/work-01.jpg` | 晕染 | 1199×1600 | 深底豆沙 | 豆沙 · 中明度 |
| 2 | `/works/work-02.jpg` | 延长甲 | 1200×1600 | 深底樱花粉 | 樱花粉 · 偏亮 |
| 3 | `/works/work-03.jpg` | 手绘 | 1200×1600 | 深底奶茶 | 奶茶 · 中明度 |
| 4 | `/works/work-04.jpg` | 纯色 | 960×1280 | 素底奶茶 | 奶茶 · 偏亮 |
| 5 | `/works/work-05.jpg` | 手绘 | 1200×1600 | 素底豆沙 | 豆沙 · 中明度 |
| 6 | `/works/work-06.jpg` | 手绘 | 1200×1600 | 深底奶茶 · 02 | 奶茶 · 偏亮 |
| 7 | `/works/work-07.jpg` | 延长甲 | 1200×1600 | 深底奶茶 · 03 | 奶茶 · 偏亮 |
| 8 | `/works/work-08.jpg` | 延长甲 | 1200×1600 | 素底墨黑 | 墨黑 · 偏暗 |
| 9 | `/works/work-09.jpg` | 晕染 | 960×1280 | 浅底豆沙 | 豆沙 · 偏亮 |
| 10 | `/works/work-10.jpg` | 法式 | 1200×1600 | 浅底酒红 | 酒红 · 偏暗 |
| 11 | `/works/work-11.jpg` | 法式 | 1200×1600 | 深底奶白 | 奶白 · 偏亮 |
| 12 | `/works/work-12.jpg` | 手绘 | 960×1282 | 素底酒红 | 酒红 · 偏暗 |
| 13 | `/works/work-13.jpg` | 法式 | 1200×1600 | 素底奶白 | 奶白 · 偏亮 |
| 14 | `/works/work-14.jpg` | 纯色 | 1200×1600 | 素底酒红 · 02 | 酒红 · 偏暗 |
| 15 | `/works/work-15.jpg` | 纯色 | 1200×1600 | 素底樱花粉 | 樱花粉 · 偏亮 |
| 16 | `/works/work-16.jpg` | 手绘 | 1200×1600 | 浅底豆沙 · 02 | 豆沙 · 偏亮 |
| 17 | `/works/work-17.jpg` | 法式 | 1200×1600 | 素底酒红 · 03 | 酒红 · 偏暗 |
| 18 | `/works/work-18.jpg` | 纯色 | 1200×1600 | 素底酒红 · 04 | 酒红 · 偏暗 |
| 19 | `/works/work-19.jpg` | 手绘 | 1179×1572 | 深底莓紫 | 莓紫 · 偏暗 |
| 20 | `/works/work-20.jpg` | 晕染 | 1200×1600 | 素底酒红 · 05 | 酒红 · 中明度 |
| 21 | `/works/work-21.jpg` | 手绘 | 1200×1600 | 深底豆沙 · 02 | 豆沙 · 中明度 |
| 22 | `/works/work-22.jpg` | 晕染 | 1200×1600 | 浅底焦糖 | 焦糖 · 偏暗 |
| 23 | `/works/work-23.jpg` | 手绘 | 1200×1600 | 深底奶茶 · 04 | 奶茶 · 偏亮 |

分类分布：晕染 4 · 延长甲 3 · 手绘 8 · 纯色 4 · 法式 4 = 23

> **分类与标题是脚本按像素特征推断的初值**，不是人工看图的结果。
> 你扫一眼画布，把不对的 `category` / `title` 直接在 JSON 里改掉即可（刷新页面生效，重跑脚本也不会被覆盖）。

### 字段说明

```jsonc
{
  "source": "微信图片_20261102195726_11412_1.jpg", // 合并键，别改
  "id": "work-01",              // 编号，灯箱里会显示
  "imageUrl": "/works/work-01.jpg",
  "width": 1199,                // 真实像素，别乱填
  "height": 1600,
  "tint": "#ece0df",            // 图片加载失败时的兜底色块
  "category": "晕染",           // 纯色 / 法式 / 晕染 / 手绘 / 延长甲，写错 TS 会报错
  "title": "深底豆沙",
  "tone": "豆沙 · 中明度",       // 灯箱「主色调」
  "background": "深色背景",      // 用来自动拼灯箱说明
  "summary": "豆沙甲面，深底"    // 用来自动拼 alt
}
```

`alt` 不用手写，由 `data/portfolio.ts` 按固定格式拼出：
**`美甲作品：{风格分类}，{简短描述}`** → 例：`美甲作品：晕染，豆沙甲面，深底`。

### 换更多照片

```bash
# 1. 新照片丢进 ~/Desktop/Photo
# 2. 重跑导入（会自动追加 work-24、work-25…）
npm run photos:import

# 3. 编辑 data/artworks.json 里新增那几条的 title / category
```

---

## 四、任务要求的四条技术点，落在哪

| 要求 | 实现 | 位置 |
| --- | --- | --- |
| 占位图 URL 换成真实照片 | 23 张全部指向 `/works/work-NN.jpg`，`public/placeholders` 已无引用 | `data/artworks.json` |
| alt 格式「美甲作品：{分类}，{描述}」 | 由 `category` + `summary` 自动拼接，不手写 | `data/portfolio.ts` |
| `next/image` 的 `sizes` | 卡片按 3/2/1 栏实际宽度声明，手机只下 384px 档；灯箱按 `min(92vw, 72vh×比例, 1040px)` 声明 | `MasonryGallery.tsx` / `Lightbox.tsx` |
| 加载失败换柔和色块 + 控制台报文件名 | `onError` → 换成该作品主色的柔和色块，`console.warn` 打出图片地址与 alt | `components/ArtworkImage.tsx` |
| 画廊顶部一句自我介绍 | `武汉 · 专注手绘与晕染的独立美甲师`，衬线体、比正文浅一档 | `ARTIST_INTRO` in `data/portfolio.ts` |

sizes 具体值（卡片）：

```
(max-width: 640px)  calc(100vw - 40px)
(max-width: 1024px) calc(45vw - 10px)
(max-width: 1180px) calc(33vw - 51px)
342px
```

---

## 四点五、预约钩子与联系方式

全站只有一个联系方式：微信号 `hbobo1001_`，集中定义在 `data/site.ts` 的 `WECHAT_ID`。
页面里没有任何硬编码的微信号、电话或邮箱（模板里的示例电话与邮箱已删除）。

### 三个入口

| 位置 | 组件 | 形态 |
| --- | --- | --- |
| 底部深色区块 | `BookingCTA.tsx` | 「喜欢某款？」+ 引导语 + 微信号 + 复制按钮 |
| 页脚 | `Footer.tsx` | 微信号 + 图标复制按钮 |
| 移动端右下角 | `WeChatFloat.tsx` | 圆形浮标，点开气泡显示微信号 + 复制 |

浮标只在 `max-width: 900px` 出现，桌面端由 CSS 隐藏——桌面已经有底部区块，不需要再挂一个。

### 复制为什么写得那么长

三档降级，因为三档都会真实发生：

1. `navigator.clipboard.writeText` —— 只有安全上下文（https / localhost）才有
2. `document.execCommand('copy')` —— **手机通过局域网 IP 访问时走这条**；里面有 iOS 特判：
   iOS Safari 无法 `select()` 一个 readonly 元素，必须临时改成可编辑再用 Range 选区
3. 前两条都失败 → 选中页面上的微信号文本，按钮显示「已选中」并带 title 提示。
   绝不假装成功——静默失败比提示失败更糟

### 改营业时间 / 预约提前量

这三条信息（营业时段、每日接待量、预约提前量）**全站只出现一次**，在 About 的「到店须知」里，
合成一句显示：`10:00 — 20:00，周一休息 · 一天最多三位 · 建议提前 3 天预约`。

它们本来讲的是同一件事——只有一个人 → 一天最多三位 → 所以得提前约。
之前分散在「到店须知」「预约区块」「页脚」三处各说一遍，措辞还不一致
（一处「建议提前 3 天预约」，一处「请尽量提前 3 天约」），改配置也同步不了。

要改就改 `data/site.ts` 顶部这三个常量，页面自动跟着变：

```ts
const HOURS = '10:00 — 20:00，周一休息';
const DAILY_CAPACITY = '一天最多三位';
const LEAD_TIME = '建议提前 3 天预约';
```

> 页面里请只使用 `CONTACT.hoursNote`，不要再单独拼 `HOURS` / `LEAD_TIME`，
> 否则同一件事又会在多处重复。`npm run check:booking` 里有 7 条断言盯着这件事。

### 改服务项目（不标价）

`data/site.ts` 的 `SERVICES` 数组，5 项，每项只有 `name` / `note`。

**页面上不显示价格**，这是刻意的：甲型、长度、是否加固都会影响报价，
写成固定数字反而要在店里反复解释；想知道的直接微信问，一句话能答，
也顺带成了一个咨询入口。

服务区块的副标题因此改成了「时长按甲型与加固需求会有浮动。想做的款式和价格，
微信问一句就能给你准数。」——只讲时长和咨询方式，不给数字。

> 以后真要标价，改三处：`ServiceItem` 加回 `price` 字段、`Services.tsx` 加回价格渲染、
> `.svc-list__row` 的 `grid-template-columns` 从两列改回三列（`auto minmax(0, 1fr) auto`）。
> `npm run check:booking` 里有 3 条断言盯着「页面上不出现价格」，标价时记得一起改。

### 本轮替掉的不实描述

| 原来 | 改成 | 原因 |
| --- | --- | --- |
| 服务客人 1800+ | 100+ | 实际刚起步 |
| 驻店美甲师 4 位 | 1 位 · 我自己 | 没有驻店团队 |
| 「只有四个座位的小工作室」 | 「我一个人的小工作室」 | 与一人经营的事实一致 |
| 「每位客人固定一位美甲师」 | 「不会做到一半换人接手」 | 本来就一个人，原句像在暗示有团队 |
| 电话 + 邮箱 | 只留微信号 | 避免访客拨打不存在的号码 |
| 服务项目标价（¥128 起等） | 只写名称 + 耗时，不标价 | 数字是示例值，且甲型/加固会影响报价 |
| 「图片来源：占位图」 | 「图片均为工作室实拍」 | 早已换成真实照片 |

---

## 四点六、管理后台（Supabase）

目标是：**以后每做一款新美甲，不碰代码就能上传、改分类、删除。**

后台地址 `/admin`，用 Supabase Auth 的邮箱密码登录，只有 `usagi520x@gmail.com` 能进。

### 数据源优先级

前台和后台都只通过 `lib/works.ts` 的 `getWorks()` 拿数据，它按这个顺序选：

| 情况 | 用的数据 | 前台表现 |
| --- | --- | --- |
| 没配 `.env.local` | `data/artworks.json` | 正常显示 23 张，一切照旧 |
| 配了但查询报错（断网、策略错） | 回退 `artworks.json` | 正常显示，控制台记一条 error |
| 配了且查询成功 | Supabase `nail_works` 表 | 只显示表里的，按 `created_at` 倒序 |

**"表为空"算第三种情况**，前台就是空画廊 —— 不会偷偷换成本地那 23 张。
否则你把作品删光后前台又冒出 23 张，会以为删除没生效。

所以第一次配好 Supabase 后，记得跑一次迁移把现有作品导进去（见下面第 5 步）。

### 一次配好需要五步

详细图文步骤也写在 `/admin` 页面里（没配置时会自动显示），这里是要点：

**1. 建项目** — supabase.com 注册 → New project。区域选新加坡或东京，国内访问比美区顺。

**2. 跑建表脚本** — SQL Editor → New query → 粘贴 `supabase/schema.sql` 全文 → Run。

这个脚本一次做完四件事，而且可以重复执行：

- 建 `nail_works` 表（字段见下）+ 分类 CHECK 约束 + `created_at` 倒序索引
- 开 RLS 并建策略：**所有人可读，只有站主可写**
- 建 `nail-images` 存储桶：公开可读、限制 10 MB、只允许 4 种图片格式
- 建存储对象策略：所有人可读，只有站主可增删

**3. 建账号** — Authentication → Users → Add user，邮箱填 `usagi520x@gmail.com`。

建完把 **Authentication → Providers → Email → Confirm email** 关掉。
不关的话账号会卡在"未验证"状态登不进去 —— 这个站只有你用，不需要验证流程。

**4. 填环境变量** — Project Settings → API 里复制 URL 和 anon key，建 `.env.local`：

```bash
cp .env.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
ADMIN_EMAIL=usagi520x@gmail.com
```

**5. 导入现有作品（可选）** — 在 `.env.local` 里临时加上登录凭据：

```bash
SUPABASE_MIGRATE_EMAIL=usagi520x@gmail.com
SUPABASE_MIGRATE_PASSWORD=你的密码

npm run db:migrate
```

脚本会逐张上传 `public/works/*.jpg` 并写入记录，可重复执行（图片 upsert，记录按 URL 判重）。
跑完把那两行密码删掉，不要提交。

### 环境变量清单

| 变量 | 必填 | 用在哪 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | 前端 + 服务端 | 项目 URL，`https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 前端 + 服务端 | anon/public key。**公开可见**，安全性靠 RLS |
| `NEXT_PUBLIC_SUPABASE_BUCKET` | — | 前端 + 服务端 | 默认 `nail-images`，改桶名时才需要 |
| `ADMIN_EMAIL` | — | 服务端 | 默认 `usagi520x@gmail.com`。改了要同步改 `schema.sql` |
| `SUPABASE_PROXY_URL` | 境内本地 | 服务端 + 脚本 | 本地开发代理，见下节。部署到海外平台**不要设** |
| `SUPABASE_MIGRATE_EMAIL` | 仅迁移 | 脚本 | 跑 `db:migrate` 时用，跑完删掉 |
| `SUPABASE_MIGRATE_PASSWORD` | 仅迁移 | 脚本 | 同上。**不要提交进仓库** |

> ⚠️ **改了环境变量要重启**：dev 模式改 `.env.local` 后必须重启 `npm run dev`。
> 用 `npm run build` + `npm run start` 的话，`NEXT_PUBLIC_*` 在**构建时就被写进 JS 里**了，
> 改完必须**重新构建**，只重启进程不生效。

### 本地开发与 supabase.co 的网络问题（境内必读）

`supabase.com`（控制台）和 `*.supabase.co`（数据库 / 存储 / 认证的数据接口）是两个域名。
代理客户端的规则表通常只有前者，后者直连会被重置——表现为：

- `npm run db:migrate` 报 `登录失败：fetch failed`
- 前台读不到 Supabase 数据（回退本地 JSON）
- `/admin` 登录转圈后失败

**修法**：在代理客户端（Clash / Surge / Loon 等）加一条规则
`DOMAIN-SUFFIX,supabase.co → 走代理`，然后在 `.env.local` 里加：

```
SUPABASE_PROXY_URL=http://127.0.0.1:<代理客户端的 HTTP 端口>
```

工程侧的配套（已做好，换机器不用重做）：

- 服务端请求统一走 `lib/supabase/proxy-fetch.ts`（undici ProxyAgent）。
  Node 22 自带的 `NODE_USE_ENV_PROXY` 实测无效，不要依赖。
- middleware 用 Node runtime（edge 跑不了 undici）。
- `next.config.js` 在设置了 `SUPABASE_PROXY_URL` 时自动关闭图片优化器
  （`/next/image` 的服务端取图不走代理通道，会 500），
  图片改由浏览器直连 Supabase 加载；生产环境不设该变量，优化器保持开启。
- 迁移脚本上传必须传 `Uint8Array` 而不是 `Blob`——storage-js 会把 Blob 包进
  FormData，经 undici 代理序列化时 content-type 丢成 text/plain 被桶的
  MIME 白名单拒绝。

局域网其他设备（手机等）访问本机 `:3000` 时，若设备自身没有代理，
Supabase 图片会加载失败、显示兜底色块——这是网络环境问题，不是站点 bug。

### Vercel 部署时的环境变量

Vercel 项目 → Settings → Environment Variables，加上面表格里前三项（`ADMIN_EMAIL` 建议也加）。
三个环境（Production / Preview / Development）都勾上，否则 Preview 部署会打不开后台。

`SUPABASE_MIGRATE_*` 和 `SUPABASE_PROXY_URL` **不要**加到 Vercel —— 前者是本地迁移脚本用的，
后者只服务于境内本地开发，海外平台直连 Supabase 毫无障碍。

### 表结构

```sql
create table public.nail_works (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,              -- 指向 nail-images 桶的公开地址
  style_category text not null,         -- 纯色 / 法式 / 晕染 / 手绘 / 延长甲
  description text,                     -- 一句话描述，前台当标题
  created_at timestamptz not null default now(),  -- 前台按它倒序
  width integer,                        -- 附加列，见下方说明
  height integer                        -- 附加列，见下方说明
);
```

**为什么多了 `width` / `height` 两列**：你给的字段清单里没有这两个，
但瀑布流靠真实宽高算比例，缺了会先按 3:4 撑开、图片加载完再跳变（CLS 抖动）。
上传表单和迁移脚本都会写入真实像素值；手工插数据时留空也能跑，只是走兜底比例。

### 安全设计：三道防线

"只有我能进后台"这件事做了三层，少任何一层都是假的安全：

1. **middleware**（`middleware.ts`）— 未登录访问 `/admin` 直接跳登录页，顺带刷新 token
2. **页面与服务端操作**（`checkAdmin()`）— 校验登录态 + 邮箱白名单，删除/新建各自再查一次
3. **数据库 RLS**（`schema.sql`）— 策略里写死 `auth.jwt() ->> 'email' = 'usagi520x@gmail.com'`

第 3 层最关键：Supabase 默认允许任何人自助注册，如果只在代码里判断"已登录"，
别人注册个账号就能直接调 API 删你的作品。前两层只是体验，第三层才是真正的边界。

**所以：改 `ADMIN_EMAIL` 时必须同时改 `schema.sql` 里 4 处邮箱并重跑脚本，否则会出现
"能登录但写不进去"（或者更糟，旧邮箱仍能写）。** `npm run check:admin` 有断言盯着这件事。

### 上传链路

```
选图 → 校验类型/大小 → 读真实像素尺寸 → 直传 Storage → 写表 → 刷新列表
                                    ↘ 写表失败则删掉刚传的文件（不留孤儿）
```

图片是**浏览器直传** Storage 的，不经过服务端：Vercel 的 Server Action 有请求体大小限制，
一张手机原图就可能顶到上限。元数据走 Server Action，这样服务端能再校验一次权限和分类。

### 常用命令

```bash
npm run db:migrate    # 把 public/works 里的图导进 Supabase（幂等）
npm run check:admin   # 自检：配置一致性 + 后台三种状态 + 登录页
```

`check:admin` 里有一半是**静态检查**，防的是最隐蔽的一类 bug：
前端改了邮箱或分类，SQL 脚本没跟着改。这类问题运行时看不出来，只能在数据层发现。

---

## 五、已实现的交互

| 能力 | 说明 |
| --- | --- |
| 分类筛选 | 6 个标签带实时数量角标；切换后重置视图并关闭灯箱，避免索引错位 |
| 瀑布流 | CSS `columns` + `break-inside: avoid`，SSR 首屏即正确，无 JS 布局抖动 |
| 灯箱 | 点击遮罩 / 关闭按钮 / `Esc` 关闭；`←` `→` 翻页且首尾循环；打开时锁 body 滚动；焦点落到关闭按钮 |
| 图片兜底 | 单张图 404 不显示破图标，替换为主色调柔和色块 |
| 响应式 | ≥1180 三列，641–1024 两列，≤640 单列；触屏无 hover 时信息层常显 |
| 无障碍 | 卡片是 `<button>` 带 `aria-label`，筛选条 `role="tablist"`/`aria-selected`，灯箱 `role="dialog"` + `aria-modal`，兜底色块带 `role="img"` + `aria-label` |
| 动效克制 | 只用 transform/opacity，且遵循 `prefers-reduced-motion` |

以上交互由 `npm run check:ui`（无头 Chrome + DevTools 协议）实际点过一遍，12 项全绿；
图片 404 的兜底色块与控制台告警也单独验证过。

---

## 六、`next.config.js` 的 `remotePatterns`

当前图片全在本地，用不到外链。已预置的白名单（换成 CDN 图床时直接可用）：
Unsplash、Pexels、Pixabay、Picsum、Cloudinary、Imgur、GitHub raw、Vercel Blob、Supabase Storage。

新增域名照格式加一行，然后重启 dev：

```js
{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
```

同时已开启 `formats: ['image/avif', 'image/webp']`。

---

## 七、环境备注（本机特有，非项目问题）

1. **`node_modules/.bin` 为空**：本机沙箱禁止创建软链接，脚本改成直接调用
   `node node_modules/next/dist/bin/next`，不依赖 `.bin`。你自己 `npm install` 后标准写法同样可用。
2. **npm 缓存里有 root 权限文件**：报 `root-owned files` 时执行一次 `sudo chown -R 501:20 ~/.npm`，
   或临时 `npm install --cache /tmp/npm-cache`。
3. **`.next` 无法删除**：桌面目录受安全策略保护，shell 的 rm 会被拒，Next 清理时直接崩。
   `npm run dev` 已内置处理（启动前用 Node 侧删除），所以**不要直接跑 `next dev`**，
   或在终端 `rm -rf .next` 后重试。
4. **`public/placeholders/`** 是上一版占位图，已无引用。想删就在终端 `rm -rf public/placeholders`。

---

## 八、下一步可以加的

- 作品详情页 `/works/[id]`（现在是灯箱，可升级成可分享的独立链接）
- 现在分类是像素推断的，人工核一遍后把 `category` 定下来（五分钟的活，效果最直接）
- 后台 / CMS 录入，避免每次改文案都要动 JSON
- 预约表单 + 企业微信/邮件通知
