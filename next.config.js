/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 构建输出目录，默认 .next。
   * 支持用 NEXT_DIST_DIR 覆盖：在只读/受限环境里想另开一份输出时用得上，
   * 例如 NEXT_DIST_DIR=.next-preview npm run dev。
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  images: {
    /**
     * remotePatterns 白名单
     *
     * next/image 只会代理这里声明过的外链域名，没声明的会在运行时报
     * "hostname ... is not configured under images in your next.config.js"。
     *
     * 换成真实照片时：
     * 1. 把 data/portfolio.ts 里的 imageUrl 改成外链地址
     * 2. 在这里补上对应域名（照抄下面的格式）
     * 3. 重启 dev server
     */
    remotePatterns: [
      // Unsplash（模板原型用的图源，最常用）
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },
      // Pexels / Pixabay / Picsum 等免费图库
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.pixabay.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'fastly.picsum.photos', pathname: '/**' },
      // 图床 / CDN
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.imgur.com', pathname: '/**' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com', pathname: '/**' },
      // Vercel Blob（如果你之后传到 Vercel 存储）
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com', pathname: '/**' },
      // Supabase Storage（公共 bucket）
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
    // 输出格式优先 avif/webp，减小首屏体积
    formats: ['image/avif', 'image/webp'],

    /**
     * 本地开发时关掉图片优化器（unoptimized）。
     *
     * 为什么：/next/image 的优化请求由 Next 服务端发出去取图，
     * 不经过 lib/supabase/proxy-fetch 的代理通道，境内直连 supabase.co
     * 会被重置，所有卡片图都会 500 退化成兜底色块。
     * 关掉后 <img> 直接指向 Supabase 公开地址，由访客浏览器自己加载
     * （浏览器走系统代理，没问题）。
     *
     * 生产环境（Vercel 等海外平台）不设 SUPABASE_PROXY_URL，
     * 优化器保持开启，享受 CDN 裁剪压缩。
     */
    unoptimized: Boolean((process.env.SUPABASE_PROXY_URL ?? '').trim()),
  },
};

module.exports = nextConfig;
