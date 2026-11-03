'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createBookingAction } from '@/app/admin/actions';
import { removeBookingImageFile, uploadBookingImage } from './booking-image';

/**
 * 新增预约
 *
 * 字段刻意精简：时间 + 时长 + 备注 + 可选样图。
 * 客人姓名/联系方式不进系统——独立工作室的客人都在微信里，
 * 这里只是「这块时间被占了」的记账本，字段越多越没人坚持填。
 */

/** 默认时长（分钟）：一个常规款式的大致耗时 */
const DEFAULT_DURATION = 120;

/** 时长快捷选项，覆盖常见项目 */
const DURATION_PRESETS = [60, 90, 120, 150, 180];

export default function BookingForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function resetForm() {
    setStartsAt('');
    setDuration(DEFAULT_DURATION);
    setNote('');
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!startsAt) {
      setStatus({ kind: 'err', text: '先选一个预约时间。' });
      return;
    }

    const starts = new Date(startsAt);
    if (Number.isNaN(starts.getTime())) {
      setStatus({ kind: 'err', text: '预约时间格式不对。' });
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      // 有样图先传图（直传私有桶），失败了就不继续建记录
      let imagePath: string | undefined;
      if (imageFile) {
        const uploaded = await uploadBookingImage(imageFile);
        if (!uploaded.ok) {
          setStatus({ kind: 'err', text: uploaded.message });
          return;
        }
        imagePath = uploaded.path;
      }

      const result = await createBookingAction({
        startsAt: starts.toISOString(),
        durationMinutes: duration,
        note,
        imagePath,
      });

      if (!result.ok) {
        // 记录没建成，把刚传的样图回收掉
        if (imagePath) await removeBookingImageFile(imagePath);
        setStatus({ kind: 'err', text: result.message });
        return;
      }

      setStatus({ kind: 'ok', text: result.message });
      resetForm();
      router.refresh();
    } catch (cause) {
      setStatus({
        kind: 'err',
        text: cause instanceof Error ? cause.message : '保存失败，请重试。',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form__row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="booking-time">
            预约时间
          </label>
          <input
            id="booking-time"
            className="admin-input"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={busy}
            required
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="booking-duration">
            时长（分钟）
          </label>
          <input
            id="booking-duration"
            className="admin-input"
            type="number"
            min={30}
            max={480}
            step={15}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            disabled={busy}
            required
          />
          <div className="admin-chips">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`admin-chip${duration === preset ? ' is-active' : ''}`}
                onClick={() => setDuration(preset)}
                disabled={busy}
              >
                {preset / 60}h
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="booking-note">
          备注 <span>· 客人想做的款、注意事项等，只有你能看到</span>
        </label>
        <textarea
          id="booking-note"
          className="admin-textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder="例如：想做 work-03 那款晕染，本甲偏短"
          disabled={busy}
        />
      </div>

      <div className="admin-file">
        <label className="admin-label" htmlFor="booking-image">
          顾客样图 <span>· 可选，只在后台显示，前台看不到</span>
        </label>
        {previewUrl ? (
          <div className="admin-file__picked">
            {/* 本地预览是 blob 地址，用原生 img */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-file__thumb" src={previewUrl} alt="样图预览" />
            <div style={{ color: 'var(--adm-muted)', fontSize: '0.78rem' }}>
              {imageFile ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
            </div>
          </div>
        ) : null}
        <input
          ref={fileRef}
          id="booking-image"
          className="admin-file__input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileChange}
          disabled={busy}
        />
      </div>

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
          {busy ? '保存中…' : '添加预约'}
        </button>
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
