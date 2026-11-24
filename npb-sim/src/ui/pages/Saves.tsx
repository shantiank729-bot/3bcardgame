import { useEffect, useState } from 'preact/hooks';
import { LEAGUE_NAMES } from '../../league/teams';
import { deleteSave, listSaves, loadWorld, saveWorld, SLOT_COUNT } from '../../save/db';
import { deserializeWorld, gzip, readSaveFile, serializeWorld, type SaveMeta } from '../../save/serialize';
import { go, notify, setWorld, state, toast, useWorld } from '../store';

export function Saves() {
  const w = useWorld();
  const [metas, setMetas] = useState<SaveMeta[]>([]);
  const refresh = () => listSaves().then(setMetas).catch(() => setMetas([]));
  useEffect(() => void refresh(), []);
  const bySlot = new Map(metas.map((m) => [m.slot, m]));
  const save = async (slot: number) => {
    await saveWorld(w, slot);
    state.slot = slot;
    toast(`スロット${slot}に保存しました`);
    refresh();
  };
  const load = async (slot: number) => {
    if (!confirm('今の進行状況は保存されていなければ失われます。読み込みますか？')) return;
    setWorld(await loadWorld(slot), slot || 1);
    toast('読み込みました');
    go('home');
  };
  const del = async (slot: number) => {
    if (!confirm(`スロット${slot}を削除しますか？`)) return;
    await deleteSave(slot);
    refresh();
  };
  const exportFile = async () => {
    const blob = await gzip(serializeWorld(w));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `npb-sim-${w.year}-${w.date}.json${blob.type === 'application/json' ? '' : '.gz'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importFile = async (f: File) => {
    try {
      setWorld(deserializeWorld(await readSaveFile(f)), state.slot);
      toast('ファイルから読み込みました');
      go('home');
    } catch (e) {
      toast('読み込めませんでした: ' + (e as Error).message);
    }
  };
  return (
    <div class="page">
      <section class="card">
        <h2>セーブ・ロード</h2>
        <ul class="slots">
          {[0, ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)].map((slot) => {
            const m = bySlot.get(slot);
            return (
              <li key={slot}>
                <div>
                  <b>{slot === 0 ? 'オートセーブ' : `スロット${slot}`}</b>
                  <small>{m ? `${m.name}・${m.summary}・${new Date(m.savedAt).toLocaleString('ja-JP')}` : '空き'}</small>
                </div>
                <div class="btns">
                  {slot !== 0 && <button class="btn" onClick={() => save(slot)}>保存</button>}
                  {m && <button class="btn" onClick={() => load(slot)}>読込</button>}
                  {m && slot !== 0 && <button class="btn danger" onClick={() => del(slot)}>削除</button>}
                </div>
              </li>
            );
          })}
        </ul>
        <p class="muted small">日付を進めるたびにオートセーブされます。データはこのブラウザ（IndexedDB）に保存されます。</p>
      </section>
      <section class="card">
        <h2>ファイルに書き出し／読み込み</h2>
        <div class="btns">
          <button class="btn primary" onClick={exportFile}>ファイルに書き出す</button>
          <label class="btn">
            ファイルを読み込む
            <input type="file" hidden accept=".json,.gz,application/json,application/gzip" onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) void importFile(f);
            }} />
          </label>
        </div>
      </section>
      <section class="card">
        <h2>設定</h2>
        {(['C', 'P'] as const).map((lg) => (
          <label class="check" key={lg}>
            <input type="checkbox" checked={w.settings.dh[lg]} onChange={(e) => { w.settings.dh[lg] = (e.target as HTMLInputElement).checked; notify(); }} />
            {LEAGUE_NAMES[lg]}でDH制を使う
          </label>
        ))}
        <p class="muted small">2027年からは両リーグともDH制が初期設定です。交流戦はホーム球団のリーグのルールに従います。</p>
        <button class="btn danger" onClick={() => { if (confirm('タイトルに戻りますか？（保存していない進行は失われます）')) { setWorld(null); go(''); } }}>タイトルに戻る</button>
      </section>
    </div>
  );
}
