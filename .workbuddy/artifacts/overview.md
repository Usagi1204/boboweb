# 交付说明 · 替换真实作品照片（todo r2xSiZ）

一句话：画廊里的 18 张占位图，已经全部换成 `~/Desktop/Photo` 里的 23 张真实作品照，
并且**照片是自动接入的**——以后加图只要重跑一条命令。

---

## 1. 做了什么

| 要求 | 做法 | 状态 |
| --- | --- | --- |
| 占位图 URL 换成本地真实照片 | 23 张 → `public/works/work-01..23.jpg`，`data/artworks.json` 统一登记 | ✅ |
| 每张加 alt：`美甲作品：{分类}，{描述}` | 由 `category` + `summary` 自动拼，不手写，格式不会跑偏 | ✅ |
| `next/image` 用 `sizes` 控制移动端取图 | 卡片按 3/2/1 栏真实宽度声明，手机只下 384px 档 | ✅ |
| 加载失败换柔和色块 + 控制台报文件名 | 失败时换成该作品主色的色块，`console.warn` 打出路径与 alt | ✅ |
| 画廊顶部一句话自我介绍 | `武汉 · 专注手绘与晕染的独立美甲师`，衬线体、比正文浅一档 | ✅ |

---

## 2. 新增的两个工具

```bash
npm run photos:import    # 重跑导入：压缩、改名、读尺寸、提主色、写清单
npm run check:ui         # 无头 Chrome 真点一遍：筛选 / 灯箱 / 键盘 / 滚动锁
```

`photos:import` 是**幂等**的：以原始文件名为合并键，你在 JSON 里改过的标题、分类、文案不会被覆盖；
新照片只追加编号，不重排已有作品。

---

## 3. 一个必须说清楚的限制

**我这个环境看不到图片内容**（没有图像预览能力），所以：

- ✅ 尺寸、宽高比、主色调、背景明暗 —— 全部是**从像素算出来的**，真实可靠
- ⚠️ 分类（纯色/法式/…）和标题（如「深底豆沙」）—— 是**按画面特征推断的初值**，不是看图判断的

我做了配额均衡，保证每个分类都有作品、不会出现空标签，但**这 23 张的分类需要你过一眼**：

打开 `http://localhost:3000`，对照画布把不对的改掉，只改 `data/artworks.json` 里两行：

```jsonc
{ "id": "work-07", "category": "延长甲", "title": "深底奶茶" }
//                  ↑ 改成 纯色/法式/晕染/手绘/延长甲    ↑ 随便起名
```

保存即热更新，重跑导入也不会被覆盖。这是这次唯一没闭环的点，大概五分钟能收尾。

---

## 4. 验证结果（都是真跑出来的）

- `tsc --noEmit`：通过
- `next build`：通过，首页 First Load JS **115 kB**
- `npm run check:ui`：**12/12 通过** —— 23 张卡片渲染、tagline 文案、sizes 属性、alt 格式、
  筛选到「法式」剩 4 张、灯箱打开、元信息字段、→ 键翻页、Esc 关闭、筛回全部、滚动锁恢复
- 图片兜底专项：临时把一张图指向不存在的路径 → DOM 里出现
  `span[role=img][data-fallback]`（保留原宽高比、无破图标），控制台输出
  `[画廊] 图片加载失败，已用色块顶替：/works/__missing__.jpg（美甲作品：晕染，豆沙甲面，深底）`
- 图片体积：原始 3.4 MB → 站点 3.0 MB；`next/image` 384px 档 **webp 10 KB / avif 6.5 KB**

---

## 5. 顺手改掉的两个旧问题

1. **灯箱不再写臆造配方**。原来每张都配「底色 #E8C4C4 叠两层半透粉」这种文案——换成真实照片后就是假话。
   现在「质感」改成**实测主色调**，「耗时」改成**该分类的常规耗时**（与 About 价目表一致），
   说明文字只写可核实的：背景明暗 + 编号 + 到店按甲型调整。
2. **Hero 封面裁切比例 16:7 → 3:2**。作品照都是竖构图，16:7 会把甲面裁掉大半。

---

## 6. 文件清单

```
新增  scripts/import-photos.mjs      照片导入流水线（sharp）
新增  scripts/ui-check.mjs           无头 Chrome 交互自检
新增  components/ArtworkImage.tsx    next/image + 失败兜底色块
新增  data/artworks.json             23 张照片的事实与文案（你要改的就是它）
新增  public/works/work-01..23.jpg   优化后的作品图
改动  data/portfolio.ts              改为读 JSON，派生 alt / note / duration
改动  MasonryGallery / Lightbox / PortfolioSection / Hero
改动  Portfolio.module.css           新增 tagline 与兜底色块样式
改动  app/globals.css                Hero 封面比例
改动  README.md                      照片导入流程、23 张清单、自检命令
```

`public/placeholders/` 已无任何引用，想清就在终端 `rm -rf public/placeholders`（我这边的安全策略不允许删桌面目录下的文件）。
