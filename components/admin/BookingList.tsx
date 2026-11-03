'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteBookingAction, updateBookingAction } from '@/app/admin/actions';
import type { AdminBooking } from '@/lib/bookings';
import { removeBookingImageFile, uploadBookingImage } from './booking-image';
import ImageZoom from './ImageZoom';

/**
 * 预约列表（后台）
 *
 * 分两组：
 * - 「即将到来」：今天及以后，按时间正序，是最常看的
 * - 「更早」：过去的记录收进 <details>，默认折叠，避免刷屏
 *
 * 样图显示规则（与服务端一致）：最近 7 天内（含未来）的才有签名 URL；
 * 更早的历史预约只显示「已归档」，不再加载图片。
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → datetime-local 的本地值（浏览器在店内时区，直接按本地算） */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 列表行的时间展示：11-03（周一）14:00 – 16:00 · 2 小时 */
function formatRowTime(booking: AdminBooking): string {
  const start = new Date(booking.starts_at);
  const end = new Date(start.getTime() + booking.duration_minutes * 60_000);
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][start.getDay()];
  const hours = booking.duration_minutes / 60;
  return `${pad(start.getMonth() + 1)}-${pad(start.getDate())}（周${weekday}）${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())} · ${hours % 1 === 0 ? hours : hours.toFixed(1)} 小时`;
}

function EditBooking({ booking, onDone }: { booking: AdminBooking; onDone: () => void }) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(toLocalInput(booking.starts_at));
  const [duration, setDuration] = useState(booking.duration_minutes);
  const [note, setNote] = useState(booking.note ?? '');
  const [removeImage, setRemoveImage] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleSave() {
    if (busy) return;

    const starts = new Date(startsAt);
    if (Number.isNaN(starts.getTime())) {
      setStatus({ kind: 'err', text: '预约时间格式不对。' });
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      let imagePath: string | null | undefined;
      if (newImage) {
        // 换图：先传新图，保存成功后服务端会把旧图清掉
        const uploaded = await uploadBookingImage(newImage);
        if (!uploaded.ok) {
          setStatus({ kind: 'err', text: uploaded.message });
          return;
        }
        imagePath = uploaded.path;
      } else if (removeImage) {
        imagePath = null;
      }

      const result = await updateBookingAction(booking.id, {
        startsAt: starts.toISOString(),
        durationMinutes: duration,
        note,
        imagePath,
      });

      if (!result.ok) {
        if (typeof imagePath === 'string') await removeBookingImageFile(imagePath);
        setStatus({ kind: 'err', text: result.message });
        return;
      }

      setStatus({ kind: 'ok', text: result.message });
      router.refresh();
      window.setTimeout(onDone, 500);
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
    <div className="admin-edit">
      <div className="admin-form__row">
        <div className="admin-field">
          <label className="admin-label" htmlFor={`bk-time-${booking.id}`}>
            预约时间
          </label>
          <input
            id={`bk-time-${booking.id}`}
            className="admin-input"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={busy}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor={`bk-dur-${booking.id}`}>
            时长（分钟）
          </label>
          <input
            id={`bk-dur-${booking.id}`}
            className="admin-input"
            type="number"
            min={30}
            max={480}
            step={15}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            disabled={busy}
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor={`bk-note-${booking.id}`}>
          备注
        </label>
        <textarea
          id={`bk-note-${booking.id}`}
          className="admin-textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          disabled={busy}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor={`bk-img-${booking.id}`}>
          样图
        </label>
        {booking.image_path ? (
          <label className="admin-check">
            <input
              type="checkbox"
              checked={removeImage}
              onChange={(event) => setRemoveImage(event.target.checked)}
              disabled={busy || !!newImage}
            />
            移除当前样图
          </label>
        ) : null}
        <input
          id={`bk-img-${booking.id}`}
          className="admin-file__input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(event) => {
            setNewImage(event.target.files?.[0] ?? null);
            if (event.target.files?.[0]) setRemoveImage(false);
          }}
          disabled={busy}
        />
        {newImage ? (
          <p className="admin-card__hint" style={{ margin: 0 }}>
            已选择新图：{newImage.name}（保存后替换）
          </p>
        ) : null}
      </div>

      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? '保存中…' : '保存'}
        </button>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onDone} disabled={busy}>
          取消
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
    </div>
  );
}

function BookingItem({ booking }: { booking: AdminBooking }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm('删除这条预约？样图文件也会一起删掉，不能恢复。')) return;
    setDeleting(true);
    setError(null);
    const result = await deleteBookingAction(booking.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <li className="admin-item admin-item--booking">
      {booking.signedImageUrl ? (
        <div className="admin-item__thumb">
          {/* 签名 URL 是临时的且域名动态，用原生 img 加载 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* 单击放大：适应窗口 → 再点图片看原图细节 */}
          <ImageZoom src={booking.signedImageUrl} alt="顾客样图">
            <img src={booking.signedImageUrl} alt="顾客样图" />
          </ImageZoom>
        </div>
      ) : (
        <div className="admin-item__thumb admin-item__thumb--empty" aria-hidden="true">
          {booking.image_path ? '归档' : '无图'}
        </div>
      )}

      <div className="admin-item__body">
        {editing ? (
          <EditBooking booking={booking} onDone={() => setEditing(false)} />
        ) : (
          <>
            <p className="admin-item__desc">{formatRowTime(booking)}</p>
            <p className="admin-item__meta">
              {booking.note ? <span>{booking.note}</span> : <span style={{ opacity: 0.6 }}>无备注</span>}
            </p>
          </>
        )}
      </div>

      <div className="admin-item__action">
        {!editing ? (
          <>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '删除中…' : '删除'}
            </button>
            {error ? (
              <p className="admin-status admin-status--err" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

export default function BookingList({ bookings }: { bookings: AdminBooking[] }) {
  if (bookings.length === 0) {
    return <p className="admin-empty">还没有预约记录。用上面的表单记第一条。</p>;
  }

  // 三组：今天单独突出（最常看的）、之后、更早（折叠）
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = todayStart + 24 * 3600 * 1000;

  const byStartAsc = (a: AdminBooking, b: AdminBooking) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  const startsAt = (b: AdminBooking) => new Date(b.starts_at).getTime();

  const today = bookings
    .filter((b) => {
      const t = startsAt(b);
      return t >= todayStart && t < tomorrowStart;
    })
    .sort(byStartAsc);
  const future = bookings.filter((b) => startsAt(b) >= tomorrowStart).sort(byStartAsc);
  const past = bookings.filter((b) => startsAt(b) < todayStart).sort(byStartAsc);

  return (
    <div className="admin-bookings">
      {/* 今天的预约：独立区域 + 强调色，进后台第一眼就能看到 */}
      <section className="admin-today" aria-label="今天的预约">
        <p className="admin-subhead admin-subhead--today">今天（{today.length}）</p>
        {today.length === 0 ? (
          <p className="admin-card__hint">今天还没有预约。</p>
        ) : (
          <ul className="admin-list">
            {today.map((booking) => (
              <BookingItem key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </section>

      <p className="admin-subhead">之后（{future.length}）</p>
      {future.length === 0 ? (
        <p className="admin-card__hint">之后暂时没有预约，可以在朋友圈营业一下。</p>
      ) : (
        <ul className="admin-list">
          {future.map((booking) => (
            <BookingItem key={booking.id} booking={booking} />
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <details className="admin-details">
          <summary>更早的记录（{past.length}）</summary>
          <ul className="admin-list">
            {past.map((booking) => (
              <BookingItem key={booking.id} booking={booking} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
