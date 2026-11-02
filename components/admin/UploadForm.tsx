'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { REAL_CATEGORIES, type Category } from '@/data/portfolio';
import { createWorkAction } from '@/app/admin/actions';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { SUPABASE_BUCKET } from '@/lib/supabase/config';

/** 允许的图片类型。加新格式时这里和 <input accept> 要一起改 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** 单张上限。超过这个体积上传会很慢，Storage 免费额度也经不起 */
const MAX_BYTES = 10 * 1024 * 1024;

interface PickedFile {
  file: File;
  /** 本地预览地址，选完立刻能看到，不用等上传 */
  previewUrl: string;
  width: number;
  height: number;
}

/** 读取图片的像素尺寸 —— 瀑布流靠它算宽高比，缺了会先撑开再跳变 */
async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 从 MIME 取扩展名。不用原文件名：微信导出的名字带中文和空格，Storage key 里很难看 */
function extensionOf(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/avif') return 'avif';
  return 'jpg';
}

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [category, setCategory] = useState<Category>('纯色');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function resetPicked() {
    if (picked) URL.revokeObjectURL(picked.previewUrl);
    setPicked(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus({ kind: 'err', text: '只支持 JPG / PNG / WebP / AVIF 四种格式。' });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setStatus({ kind: 'err', text: `这张 ${mb} MB，超过 10 MB 上限。先压缩一下再传。` });
      event.target.value = '';
      return;
    }

    try {
      const size = await readImageSize(file);
      if (picked) URL.revokeObjectURL(picked.previewUrl);
      setPicked({
        file,
        previewUrl: URL.createObjectURL(file),
        width: size.width,
        height: size.height,
      });
    } catch {
      setStatus({ kind: 'err', text: '这张图读不出来，可能文件损坏了，换一张试试。' });
      event.target.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !picked) return;

    setBusy(true);
    setStatus(null);

    const supabase = getBrowserSupabase();
    const objectPath = `${crypto.randomUUID()}.${extensionOf(picked.file)}`;

    try {
      /**
       * 第一步：把文件直传 Storage
       *
       * 不走服务端中转，是因为 Vercel 的 Server Action 有请求体大小限制，
       * 一张手机原图就可能顶到上限。
       * cacheControl 给一年：key 是 UUID，内容永不变，可以放心长缓存。
       */
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(objectPath, picked.file, {
          contentType: picked.file.type,
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        setStatus({ kind: 'err', text: `图片上传失败：${uploadError.message}` });
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);

      // 第二步：写元数据（服务端会再校验一次权限、地址归属和分类）
      const result = await createWorkAction({
        imageUrl: publicUrl,
        width: picked.width,
        height: picked.height,
        category,
        description,
      });

      if (!result.ok) {
        /**
         * 元数据没写成就把刚传的文件删掉。
         * 否则 Storage 里会堆一批没人引用的孤儿文件，还会占用免费额度。
         */
        await supabase.storage.from(SUPABASE_BUCKET).remove([objectPath]);
        setStatus({ kind: 'err', text: result.message });
        return;
      }

      // 成功：清空表单，刷新服务端数据让列表立刻出现这一条
      setStatus({ kind: 'ok', text: result.message });
      resetPicked();
      setDescription('');
      router.refresh();
    } catch (cause) {
      setStatus({
        kind: 'err',
        text: cause instanceof Error ? cause.message : '上传失败，请重试。',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-file">
        <label className="admin-label" htmlFor="work-file">
          图片 <span>· 支持 JPG / PNG / WebP / AVIF，单张不超过 10 MB</span>
        </label>

        {picked ? (
          <div className="admin-file__picked">
            {/* 本地预览用原生 img：这是 blob 地址，next/image 处理不了也不需要 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-file__thumb" src={picked.previewUrl} alt="待上传预览" />
            <div>
              <div>
                {picked.file.name.length > 34
                  ? `${picked.file.name.slice(0, 34)}…`
                  : picked.file.name}
              </div>
              <div style={{ color: 'var(--adm-muted)', fontSize: '0.78rem' }}>
                {picked.width} × {picked.height} · {(picked.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
        ) : null}

        <input
          ref={inputRef}
          id="work-file"
          className="admin-file__input"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={busy}
          required={!picked}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="work-category">
          分类
        </label>
        <select
          id="work-category"
          className="admin-select"
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          disabled={busy}
        >
          {REAL_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="work-desc">
          一句话描述 <span>· 会显示在卡片和灯箱上，也可用来记款号</span>
        </label>
        <textarea
          id="work-desc"
          className="admin-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={200}
          placeholder="例如：奶茶色底，手绘碎花，食指做了延长"
          disabled={busy}
        />
      </div>

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || !picked}>
          {busy ? '上传中…' : '上传作品'}
        </button>

        {picked && !busy ? (
          <button type="button" className="admin-btn admin-btn--ghost" onClick={resetPicked}>
            重新选择
          </button>
        ) : null}

        {status ? (
          <span
            className={`admin-status ${status.kind === 'ok' ? 'admin-status--ok' : 'admin-status--err'}`}
            role="status"
          >
            {status.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
