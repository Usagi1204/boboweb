'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { deleteWorkAction, updateWorkAction, type ActionState } from '@/app/admin/actions';
import { REAL_CATEGORIES, type Artwork, type Category } from '@/data/portfolio';

/**
 * 删除按钮
 *
 * 每条单独一个 useActionState：共用一个的话，删 A 时报的错会显示在 B 上。
 * 用 <form> 而不是 onClick + fetch，这样键盘操作、Enter 提交都能正常工作。
 */
function DeleteButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteWorkAction, {
    ok: true,
    message: '',
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // 删除不可撤销，加一道确认。没有这一步，误触就没了
        if (!window.confirm('删除这张作品？图片文件也会一起删掉，不能恢复。')) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="admin-btn admin-btn--danger" disabled={pending}>
        {pending ? '删除中…' : '删除'}
      </button>

      {!state.ok && state.message ? (
        <p className="admin-status admin-status--err" role="alert" style={{ marginTop: 6 }}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * 行内编辑：改分类和描述
 *
 * 图片本身不提供「换图」——换图意味着新尺寸、新文件，
 * 和「删除后重新上传」是同一个成本，但后者流程只有一条，不容易出错。
 */
function EditRow({ item, onDone }: { item: Artwork; onDone: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>(item.category);
  const [description, setDescription] = useState(item.summary);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setStatus(null);

    const result = await updateWorkAction({ id: item.id, category, description });
    setBusy(false);

    if (!result.ok) {
      setStatus({ kind: 'err', text: result.message });
      return;
    }

    setStatus({ kind: 'ok', text: result.message });
    router.refresh();
    // 保存成功后稍等一下再收起，让「已保存」被看见
    window.setTimeout(onDone, 600);
  }

  return (
    <div className="admin-edit">
      <div className="admin-field">
        <label className="admin-label" htmlFor={`edit-cat-${item.id}`}>
          分类
        </label>
        <select
          id={`edit-cat-${item.id}`}
          className="admin-select"
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          disabled={busy}
        >
          {REAL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor={`edit-desc-${item.id}`}>
          一句话描述 <span>· 会显示在卡片和灯箱上</span>
        </label>
        <textarea
          id={`edit-desc-${item.id}`}
          className="admin-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={200}
          disabled={busy}
        />
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

/** 上传时间：只到日，后台不需要精确到秒 */
function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function WorkItem({ item }: { item: Artwork }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="admin-item">
      <div className="admin-item__thumb">
        {/*
          列表缩略图固定 64×64，用 next/image 让它按这个尺寸取图，
          而不是把 1600px 的原图整张拉下来
        */}
        <Image src={item.imageUrl} alt={item.alt} width={64} height={64} />
      </div>

      <div className="admin-item__body">
        {editing ? (
          <EditRow item={item} onDone={() => setEditing(false)} />
        ) : (
          <>
            <p className="admin-item__desc">{item.summary}</p>
            <p className="admin-item__meta">
              <span className="admin-item__cat">{item.category}</span>
              <span>
                {item.width} × {item.height}
              </span>
              {item.createdAt ? <span>{formatDate(item.createdAt)}</span> : null}
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
            <DeleteButton id={item.id} />
          </>
        ) : null}
      </div>
    </li>
  );
}

export default function WorkList({ works }: { works: Artwork[] }) {
  if (works.length === 0) {
    return (
      <p className="admin-empty">
        还没有作品。用上面的表单传第一张，或者跑 <code>npm run db:migrate</code> 把现有的 23 张导进来。
      </p>
    );
  }

  return (
    <ul className="admin-list">
      {works.map((item) => (
        <WorkItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
