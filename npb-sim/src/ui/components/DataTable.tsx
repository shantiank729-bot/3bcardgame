import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface Column<T> {
  key: string;
  label: string;
  /** 並べ替え用の値 */
  value?: (r: T) => number | string;
  render: (r: T) => ComponentChildren;
  help?: string;
  /** 小さいほど良い指標（防御率など）は昇順が初期 */
  asc?: boolean;
  cls?: string;
}

/** 並べ替えできる一覧表。列見出しのツールチップで指標の意味を表示 */
export function DataTable<T>({ cols, rows, initial, limit, rowKey, rank = true }: {
  cols: Column<T>[]; rows: T[]; initial?: string; limit?: number; rowKey: (r: T) => string | number; rank?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; asc: boolean }>(() => {
    const c = cols.find((c) => c.key === initial);
    return { key: initial ?? cols[0].key, asc: !!c?.asc };
  });
  const [help, setHelp] = useState<string | null>(null);
  const col = cols.find((c) => c.key === sort.key);
  const sorted = col?.value
    ? [...rows].sort((a, b) => {
        const va = col.value!(a), vb = col.value!(b);
        const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja');
        return sort.asc ? d : -d;
      })
    : rows;
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <div class="tablewrap">
      {help && (
        <div class="helpbox" onClick={() => setHelp(null)}>
          {help} <span class="close">×</span>
        </div>
      )}
      <table class="data">
        <thead>
          <tr>
            {rank && <th class="rank">#</th>}
            {cols.map((c) => (
              <th
                key={c.key}
                class={`${c.value ? 'sortable' : ''} ${sort.key === c.key ? 'sorted' : ''} ${c.cls ?? ''}`}
                title={c.help}
                onClick={() => c.value && setSort((s) => ({ key: c.key, asc: s.key === c.key ? !s.asc : !!c.asc }))}
              >
                {c.label}
                {c.help && (
                  <button class="q" onClick={(e) => { e.stopPropagation(); setHelp(`${c.label}: ${c.help}`); }} aria-label="説明">?</button>
                )}
                {sort.key === c.key && <span class="arrow">{sort.asc ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={rowKey(r)}>
              {rank && <td class="rank">{i + 1}</td>}
              {cols.map((c) => (
                <td key={c.key} class={c.cls}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p class="muted">該当する選手がいません</p>}
    </div>
  );
}
