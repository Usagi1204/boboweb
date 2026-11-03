'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from '@/app/admin/actions';
import type { ServiceRow } from '@/lib/services';

/**
 * 服务项目编辑器
 *
 * 每一行就是前台「服务项目」区块的一项：名称 + 说明 + 排序号。
 * 排序号小的排前面，可以相同（相同的按创建时间排）。
 * 前台的序号角标（01 / 02…）是按渲染顺序自动生成的，不用在这里维护。
 */

interface RowState {
  name: string;
  note: string;
  sortOrder: string;
  status: { kind: 'ok' | 'err'; text: string } | null;
  busy: boolean;
}

function ServiceEditRow({ row }: { row: ServiceRow }) {
  const router = useRouter();
  const [state, setState] = useState<RowState>({
    name: row.name,
    note: row.note,
    sortOrder: String(row.sort_order),
    status: null,
    busy: false,
  });
  const [deleting, setDeleting] = useState(false);

  const dirty =
    state.name !== row.name ||
    state.note !== row.note ||
    state.sortOrder !== String(row.sort_order);

  async function handleSave() {
    if (state.busy || !dirty) return;
    setState((prev) => ({ ...prev, busy: true, status: null }));

    const result = await updateServiceAction({
      id: row.id,
      name: state.name,
      note: state.note,
      sortOrder: Number(state.sortOrder),
    });

    setState((prev) => ({
      ...prev,
      busy: false,
      status: { kind: result.ok ? 'ok' : 'err', text: result.message },
    }));
    if (result.ok) router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`删除「${row.name}」？前台服务项目里会少这一项。`)) return;
    setDeleting(true);
    const result = await deleteServiceAction(row.id);
    setDeleting(false);
    if (!result.ok) {
      setState((prev) => ({ ...prev, status: { kind: 'err', text: result.message } }));
      return;
    }
    router.refresh();
  }

  return (
    <li className="admin-service">
      <div className="admin-service__grid">
        <div className="admin-field">
          <label className="admin-label" htmlFor={`svc-name-${row.id}`}>
            名称
          </label>
          <input
            id={`svc-name-${row.id}`}
            className="admin-input"
            value={state.name}
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
            maxLength={30}
            disabled={state.busy}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor={`svc-sort-${row.id}`}>
            排序号 <span>· 小的在前</span>
          </label>
          <input
            id={`svc-sort-${row.id}`}
            className="admin-input"
            type="number"
            value={state.sortOrder}
            onChange={(event) => setState((prev) => ({ ...prev, sortOrder: event.target.value }))}
            disabled={state.busy}
          />
        </div>
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor={`svc-note-${row.id}`}>
          一句话说明
        </label>
        <textarea
          id={`svc-note-${row.id}`}
          className="admin-textarea"
          value={state.note}
          onChange={(event) => setState((prev) => ({ ...prev, note: event.target.value }))}
          maxLength={120}
          disabled={state.busy}
        />
      </div>
      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleSave}
          disabled={state.busy || !dirty}
        >
          {state.busy ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          onClick={handleDelete}
          disabled={deleting || state.busy}
        >
          {deleting ? '删除中…' : '删除'}
        </button>
        {state.status ? (
          <span
            className={`admin-status ${state.status.kind === 'ok' ? 'admin-status--ok' : 'admin-status--err'}`}
            role="status"
          >
            {state.status.text}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function NewServiceRow({ nextSort }: { nextSort: number }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleAdd() {
    if (busy) return;
    setBusy(true);
    setStatus(null);

    const result = await createServiceAction({ name, note, sortOrder: nextSort });
    setBusy(false);

    if (!result.ok) {
      setStatus({ kind: 'err', text: result.message });
      return;
    }
    setName('');
    setNote('');
    setStatus({ kind: 'ok', text: result.message });
    router.refresh();
  }

  return (
    <div className="admin-service admin-service--new">
      <div className="admin-service__grid">
        <div className="admin-field">
          <label className="admin-label" htmlFor="svc-new-name">
            新项目名称
          </label>
          <input
            id="svc-new-name"
            className="admin-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={30}
            placeholder="例如：足部护理"
            disabled={busy}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="svc-new-note">
            一句话说明
          </label>
          <input
            id="svc-new-note"
            className="admin-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={120}
            placeholder="做什么、适合谁、大概多久"
            disabled={busy}
          />
        </div>
      </div>
      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleAdd}
          disabled={busy || !name.trim()}
        >
          {busy ? '添加中…' : `添加（排在第 ${nextSort} 位）`}
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

export default function ServicesEditor({ rows }: { rows: ServiceRow[] }) {
  const nextSort = rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;

  return (
    <div>
      {rows.length === 0 ? (
        <p className="admin-empty">还没有服务项目。在下面添加第一项。</p>
      ) : (
        <ul className="admin-list admin-list--services">
          {rows.map((row) => (
            <ServiceEditRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      <NewServiceRow nextSort={nextSort} />
    </div>
  );
}
