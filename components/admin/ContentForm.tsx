'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateContentAction } from '@/app/admin/actions';

/**
 * 前台文案编辑
 *
 * 所有可改文案平铺在一张表单里，一次保存。
 * 清空某一栏 = 恢复出厂文案（前台读库时空串会回退默认值），
 * 所以表单留了一个「恢复全部默认」的出口。
 */

interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  multiline?: boolean;
}

const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: '首页大标题（Hero）',
    fields: [
      { key: 'hero.title_a', label: '标题第一行' },
      { key: 'hero.title_b', label: '标题第二行（高亮）' },
      { key: 'hero.lead', label: '导语', multiline: true },
    ],
  },
  {
    title: '画廊与关于',
    fields: [
      { key: 'artist.intro', label: '画廊顶部自我介绍' },
      { key: 'about.quote_a', label: '引言（前半句）' },
      { key: 'about.quote_b', label: '引言（高亮部分）' },
      { key: 'about.quote_c', label: '引言（后半句）' },
      { key: 'about.text_1', label: '介绍第一段', multiline: true },
      { key: 'about.text_2', label: '介绍第二段', multiline: true },
    ],
  },
  {
    title: '联系与营业',
    fields: [
      { key: 'contact.wechat', label: '微信号', hint: '改这里，预约区块和右下角浮层会一起变' },
      { key: 'contact.hours_note', label: '营业与预约说明' },
      { key: 'contact.address_note', label: '地址说明' },
    ],
  },
  {
    title: '预约区块',
    fields: [
      { key: 'booking.eyebrow', label: '小标（英文）' },
      { key: 'booking.title', label: '标题' },
      { key: 'booking.lead', label: '引导语' },
      { key: 'booking.hint', label: '微信号下方的小字', multiline: true },
    ],
  },
  {
    title: '数字',
    fields: [
      { key: 'studio.served_clients', label: '服务客人数量级', hint: '只填数字，例如 100' },
    ],
  },
];

export default function ContentForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const dirty = GROUPS.some((group) =>
    group.fields.some((field) => (values[field.key] ?? '') !== (initial[field.key] ?? '')),
  );

  async function handleSave() {
    if (busy || !dirty) return;
    setBusy(true);
    setStatus(null);

    const result = await updateContentAction(values);
    setBusy(false);

    setStatus({ kind: result.ok ? 'ok' : 'err', text: result.message });
    if (result.ok) router.refresh();
  }

  function handleResetAll() {
    if (!window.confirm('把全部文案恢复成出厂默认？你在后台改过的内容都会被清掉。')) return;
    const cleared: Record<string, string> = {};
    for (const group of GROUPS) {
      for (const field of group.fields) cleared[field.key] = '';
    }
    setValues(cleared);
  }

  return (
    <div className="admin-form">
      {GROUPS.map((group) => (
        <fieldset className="admin-fieldset" key={group.title}>
          <legend className="admin-fieldset__legend">{group.title}</legend>
          {group.fields.map((field) => (
            <div className="admin-field" key={field.key}>
              <label className="admin-label" htmlFor={`ct-${field.key}`}>
                {field.label}
                {field.hint ? <span> · {field.hint}</span> : null}
              </label>
              {field.multiline ? (
                <textarea
                  id={`ct-${field.key}`}
                  className="admin-textarea"
                  value={values[field.key] ?? ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                  maxLength={1000}
                  disabled={busy}
                />
              ) : (
                <input
                  id={`ct-${field.key}`}
                  className="admin-input"
                  value={values[field.key] ?? ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                  maxLength={200}
                  disabled={busy}
                />
              )}
            </div>
          ))}
        </fieldset>
      ))}

      <p className="admin-card__hint" style={{ margin: 0 }}>
        提示：把某一栏清空，前台会恢复成出厂默认文案。
      </p>

      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          {busy ? '保存中…' : dirty ? '保存全部修改' : '没有修改'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={handleResetAll}
          disabled={busy}
        >
          全部恢复默认
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
