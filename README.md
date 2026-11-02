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
| `npm run dev` | 开发模式，端口 3000 |
| `npm run build` / `npm run start` | 生产构建 / 跑构建产物 |
| `npm run photos:import` | **从 `~/Desktop/Photo` 重新导入照片**（压缩 + 重命名 + 生成清单） |
| `npm run photos:report` | 打印每张照片的色调/明暗统计，核对主色用 |
| `npm run check:ui` | 无头 Chrome 跑一遍交互（筛选/灯箱/键盘/滚动锁），输出 PASS/FAIL |
| `npm run dev:fresh` | 用独立输出目录启动（`.next` 被占用时的兜底） |

---

## 二、目录结构

```
BOBO_WEB/
├── app/
│   ├── layout.tsx              # 根布局：metadata / viewport / 全局样式
│   ├── page.tsx                # 首页装配
│   └── globals.css             # 设计令牌、导航、Hero、About、Footer 样式
├── components/
│   ├── Header.tsx              # 顶栏
│   ├── Hero.tsx                # 首屏（封面图复用作品数据）
│   ├── PortfolioSection.tsx    # ★ 作品集容器（唯一持状态：分类 + 灯箱索引）
│   ├── FilterBar.tsx           # ★ 分类筛选栏（标签来自数据，不硬编码）
│   ├── MasonryGallery.tsx      # ★ CSS columns 瀑布流 + sizes 计算
│   ├── ArtworkImage.tsx        # ★ 作品图：next/image + 失败兜底色块
│   ├── Lightbox.tsx            # ★ 灯箱（Esc / ←→ / 遮罩点击 / 滚动锁 / 焦点管理）
│   ├── About.tsx / Footer.tsx
│   ├── Portfolio.module.css
│   └── Lightbox.module.css
├── data/
│   ├── artworks.json           # ★★ 每张照片的事实与文案（可手改）
│   └── portfolio.ts            # ★★ 类型、分类枚举、自我介绍、筛选工具
├── public/works/               # 23 张已优化的作品照（work-01.jpg … work-23.jpg）
├── public/placeholders/        # 早期占位图，已不再被引用，可删
├── scripts/
│   ├── import-photos.mjs       # ★ 照片导入流水线
│   └── analyze-photos.mjs      # 色调报告
└── next.config.js              # remotePatterns 白名单 + avif/webp
```

---

## 三、照片是怎么接进来的

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
3. **`.next` 无法删除**：dev 卡在 `Starting...` 时用 `npm run dev:fresh`（输出到 `.next-dev`），
   或在终端 `rm -rf .next` 后重试。
4. **`public/placeholders/`** 是上一版占位图，已无引用。想删就在终端 `rm -rf public/placeholders`。

---

## 八、下一步可以加的

- 作品详情页 `/works/[id]`（现在是灯箱，可升级成可分享的独立链接）
- 现在分类是像素推断的，人工核一遍后把 `category` 定下来（五分钟的活，效果最直接）
- 后台 / CMS 录入，避免每次改文案都要动 JSON
- 预约表单 + 企业微信/邮件通知
