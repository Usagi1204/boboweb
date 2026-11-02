'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { deleteWorkAction, type ActionState } from '@/app/admin/actions';
import type { Artwork } from '@/data/portfolio';

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

/** 上传时间：只到日，后台不需要精确到秒 */
function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
        <li className="admin-item" key={item.id}>
          <div className="admin-item__thumb">
            {/*
              列表缩略图固定 64×64，用 next/image 让它按这个尺寸取图，
              而不是把 1600px 的原图整张拉下来
            */}
            <Image src={item.imageUrl} alt={item.alt} width={64} height={64} />
          </div>

          <div className="admin-item__body">
            <p className="admin-item__desc">{item.summary}</p>
            <p className="admin-item__meta">
              <span className="admin-item__cat">{item.category}</span>
              <span>
                {item.width} × {item.height}
              </span>
              {item.createdAt ? <span>{formatDate(item.createdAt)}</span> : null}
            </p>
          </div>

          <div className="admin-item__action">
            <DeleteButton id={item.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
