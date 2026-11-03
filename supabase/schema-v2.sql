-- ===========================================================================
-- BOBO 美甲作品集 · Supabase 升级脚本 v2（预约 + 文案 + 服务项目）
--
-- 用法：Supabase 控制台 → SQL Editor → New query → 全文粘贴 → Run
-- 前置：已经跑过 supabase/schema.sql（v1 的作品表和 nail-images 桶）。
--
-- 这个脚本同样是**可重复执行**的，跑第二遍不会报错。
-- 它一次做完五件事：
--   1. 建 site_content 表（前台文案，key-value，已带种子数据）
--   2. 建 services 表（服务项目，已带种子数据）
--   3. 建 bookings 表（预约记录，仅站主可见）+ booking_slots 视图
--      （只暴露时间字段，给前台「预约时间表」用，不含备注和样图）
--   4. 建 booking-images 私有存储桶（预约样图，只有站主能看）
--   5. 补齐以上对象的 RLS 策略
--
-- ⚠️ 邮箱必须和 .env.local 里的 ADMIN_EMAIL 一致（与 v1 相同）。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 前台文案表
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- 前台公开读
drop policy if exists "content_public_read" on public.site_content;
create policy "content_public_read"
  on public.site_content
  for select
  using (true);

-- 只有站主能改
drop policy if exists "content_owner_insert" on public.site_content;
create policy "content_owner_insert"
  on public.site_content
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "content_owner_update" on public.site_content;
create policy "content_owner_update"
  on public.site_content
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "content_owner_delete" on public.site_content;
create policy "content_owner_delete"
  on public.site_content
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

-- 种子数据：与 data/site.ts 的当前值一致，只插不覆盖（后台改过的不动）
insert into public.site_content (key, value) values
  ('hero.title_a', '指尖上的'),
  ('hero.title_b', '小画廊'),
  ('hero.lead', '这里收着我自己做过的款式：从最基础的纯色，到需要一笔一笔画的碎花。按分类点开就能看细节。喜欢哪一款，记下编号加微信告诉我，我按你的甲型重做一遍。'),
  ('artist.intro', '武汉 · 专注手绘与晕染的独立美甲师'),
  ('about.quote_a', '我不做“网红款”，只做'),
  ('about.quote_b', '能安心戴满三周'),
  ('about.quote_c', '的指甲。'),
  ('about.text_1', 'BOBO NAIL 是我一个人的小工作室——没有前台，也没有驻店团队。从沟通、修型、打底到最后一层封层，都是我一个人做完，不会做到一半换人接手。所有甲油胶与工具按单人单套消毒，卸甲免费。做之前会先聊清楚你的日常：是否常打字、是否带娃、指甲是否容易断，再决定甲型与长度，而不是硬套图片。'),
  ('about.text_2', '工作室刚起步，到现在服务过一百多位客人。没有连锁店的流水线，换来的是每个人的手都记得住——你上次做过什么、哪根手指容易起翘，我都留着记录。'),
  ('contact.wechat', 'hbobo1001_'),
  ('contact.hours_note', '10:00 — 20:00，周一休息 · 一天最多三位 · 建议提前 3 天预约'),
  ('contact.address_note', '确认好时间后，微信发你具体位置'),
  ('booking.eyebrow', 'Booking'),
  ('booking.title', '喜欢某款？'),
  ('booking.lead', '加我微信，告诉我你想做的风格。'),
  ('booking.hint', '发作品编号或截图都行，会先帮你确认甲型适不适合。'),
  ('studio.served_clients', '100')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 服务项目表
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text not null default '',
  -- 展示顺序，小的在前；后台直接改数字
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

drop policy if exists "services_public_read" on public.services;
create policy "services_public_read"
  on public.services
  for select
  using (true);

drop policy if exists "services_owner_insert" on public.services;
create policy "services_owner_insert"
  on public.services
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "services_owner_update" on public.services;
create policy "services_owner_update"
  on public.services
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "services_owner_delete" on public.services;
create policy "services_owner_delete"
  on public.services
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

-- 种子数据：只在表为空时插入，避免覆盖后台改过的内容
insert into public.services (name, note, sort_order)
select v.name, v.note, v.sort_order
from (values
  ('纯色 / 猫眼', '单色到底或加一道猫眼，最省时间也最百搭，约 60 — 90 分钟。', 1),
  ('法式 / 微法式', '白边宽度按甲床调，甲面窄也能拉出细线，约 70 — 95 分钟。', 2),
  ('晕染 / 大理石', '用胶一层层叠出过渡，边缘是化开的，没有生硬分界，约 90 — 120 分钟。', 3),
  ('手绘 / 立体装饰', '一笔一笔画，碎花、格纹、小图案都能定制，约 110 — 150 分钟。', 4),
  ('延长甲 / 甲型修复', '本甲断得厉害时做，长度和形状按你的手型与日常习惯定，约 150 — 180 分钟。', 5)
) as v(name, note, sort_order)
where not exists (select 1 from public.services);

-- ---------------------------------------------------------------------------
-- 3. 预约表 + 前台公开的时间视图
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- 预约开始时间（带时区）
  starts_at timestamptz not null,
  -- 时长（分钟），默认 120
  duration_minutes integer not null default 120,
  -- 给自己的备注：客人喜好、要做的款。前台不可见。
  note text,
  -- 顾客想做的样图，指向 booking-images 桶里的对象路径。前台不可见。
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_starts_at_idx
  on public.bookings (starts_at);

alter table public.bookings enable row level security;

-- 预约的全部字段只有站主能读写。前台通过下面的视图只看时间。
drop policy if exists "bookings_owner_select" on public.bookings;
create policy "bookings_owner_select"
  on public.bookings
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "bookings_owner_insert" on public.bookings;
create policy "bookings_owner_insert"
  on public.bookings
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "bookings_owner_update" on public.bookings;
create policy "bookings_owner_update"
  on public.bookings
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

drop policy if exists "bookings_owner_delete" on public.bookings;
create policy "bookings_owner_delete"
  on public.bookings
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'usagi520x@gmail.com');

-- 前台「预约时间表」专用视图：只有时间，没有备注、没有样图。
-- 视图以建表者身份运行，绕过 bookings 的 RLS，但只暴露这三列。
create or replace view public.booking_slots
with (security_invoker = false) as
select id, starts_at, duration_minutes
from public.bookings;

-- 允许匿名与登录用户读这个视图
grant select on public.booking_slots to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 预约样图的私有存储桶
-- ---------------------------------------------------------------------------
-- public = false：不生成公开地址，前台拿不到图，
-- 后台用带签名的临时 URL 查看（签名只有站主能签）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-images',
  'booking-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

-- 对象级策略：读写删都只有站主
drop policy if exists "booking_images_owner_select" on storage.objects;
create policy "booking_images_owner_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'booking-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

drop policy if exists "booking_images_owner_insert" on storage.objects;
create policy "booking_images_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'booking-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

drop policy if exists "booking_images_owner_update" on storage.objects;
create policy "booking_images_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'booking-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

drop policy if exists "booking_images_owner_delete" on storage.objects;
create policy "booking_images_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'booking-images'
    and (auth.jwt() ->> 'email') = 'usagi520x@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- 自检：跑完执行下面几句，应该看到
--   site_content 17 行、services 5 行、booking_slots 视图可查
-- ---------------------------------------------------------------------------
-- select count(*) from public.site_content;
-- select count(*) from public.services;
-- select * from public.booking_slots limit 5;
