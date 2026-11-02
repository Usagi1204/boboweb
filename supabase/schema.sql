-- ===========================================================================
-- BOBO 美甲作品集 · Supabase 初始化脚本
--
-- 用法：Supabase 控制台 → SQL Editor → New query → 全文粘贴 → Run
--
-- 这个脚本是**可重复执行**的：表、索引、策略、存储桶都带 if not exists
-- 或先 drop 再 create，跑第二遍不会报"已存在"。
--
-- 它一次做完四件事：
--   1. 建 nail_works 表（+ 分类约束 + 排序索引）
--   2. 开 RLS 并建策略：所有人可读，只有站主可写
--   3. 建 nail-images 存储桶，公开可读，限制 10MB / 4 种图片格式
--   4. 建存储桶的对象级策略：所有人可读，只有站主可增删
--
-- ⚠️ 邮箱必须和 .env.local 里的 ADMIN_EMAIL 一致。
--    只改代码不改这里，攻击者可以绕过前端直接调 API 写库。
-- 如果要换邮箱，把下面 4 处 'usagi520x@gmail.com' 全部替换掉。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 作品表
-- ---------------------------------------------------------------------------
create table if not exists public.nail_works (
  id uuid primary key default gen_random_uuid(),
  -- 指向 nail-images 桶里的公开地址
  image_url text not null,
  -- 分类，与前端 CATEGORIES 一致
  style_category text not null,
  -- 一句话描述，前台当标题用，可空
  description text,
  -- 前台按这个字段倒序，最新的排最前
  created_at timestamptz not null default now(),
  -- 宽高：瀑布流靠它算宽高比避免布局抖动。
  -- 需求给的字段清单里没有这两列，但 next/image 必须有尺寸才能稳定排版，
  -- 所以作为附加列存在（可空，缺失时前端按 3:4 兜底）。
  width integer,
  height integer
);

-- 分类只允许这五个值。约束放在数据库层，比只在前端校验可靠
alter table public.nail_works drop constraint if exists nail_works_style_category_check;
alter table public.nail_works add constraint nail_works_style_category_check
  check (style_category in ('纯色', '法式', '晕染', '手绘', '延长甲'));

-- 前台查询固定是 order by created_at desc，没有索引会全表扫
create index if not exists nail_works_created_at_idx
  on public.nail_works (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. 表的行级安全（RLS）
-- ---------------------------------------------------------------------------
alter table public.nail_works enable row level security;

-- 前台是公开页面，任何人（包括未登录访客）都要能读
drop policy if exists "works_public_read" on public.nail_works;
create policy "works_public_read"
  on public.nail_works
  for select
  using (true);

-- 写操作只给站主。auth.jwt() ->> 'email' 读的是当前登录态的邮箱，
-- 所以别人注册了账号也写不进来 —— 这是"只有我能进后台"的最后一道防线。
drop policy if exists "works_owner_insert" on public.nail_works;
create policy "works_owner_insert"
  on public.nail_works
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "works_owner_update" on public.nail_works;
create policy "works_owner_update"
  on public.nail_works
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "works_owner_delete" on public.nail_works;
create policy "works_owner_delete"
  on public.nail_works
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

-- ---------------------------------------------------------------------------
-- 3. 存储桶
-- ---------------------------------------------------------------------------
-- public = true：图片走公开 URL，前台 next/image 才能直接取，
-- 不需要为每张图签名（签名的 URL 会过期，无法缓存）。
-- file_size_limit / allowed_mime_types 是服务端兜底：
-- 前端校验能被绕过，这里的限制绕不过。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nail-images',
  'nail-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- ---------------------------------------------------------------------------
-- 4. 存储对象的访问策略
-- ---------------------------------------------------------------------------
-- 读：公开（bucket 是 public，但仍需要 select 策略才读得到对象列表）
drop policy if exists "nail_images_public_read" on storage.objects;
create policy "nail_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'nail-images');

-- 上传：只有站主
drop policy if exists "nail_images_owner_insert" on storage.objects;
create policy "nail_images_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'nail-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

-- 覆盖上传（upsert 时才用得到，正常上传是 insert）
drop policy if exists "nail_images_owner_update" on storage.objects;
create policy "nail_images_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'nail-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

-- 删除：后台删作品时要连图片一起删，没这条权限会留下孤儿文件
drop policy if exists "nail_images_owner_delete" on storage.objects;
create policy "nail_images_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'nail-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- 自检：跑完可以执行下面这句，应该看到 4 条策略（1 读 + 3 写）
-- ---------------------------------------------------------------------------
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'nail_works';
