import { useEffect, useState } from 'preact/hooks';
import { LEAGUE_NAMES, TEAMS } from '../../league/teams';
import { listSaves, loadWorld } from '../../save/db';
import type { SaveMeta } from '../../save/serialize';
import { deserializeWorld, readSaveFile } from '../../save/serialize';
import { startNewGame } from '../actions';
import { Logo } from '../components/Logo';
import { go, setWorld, toast } from '../store';

export function Title() {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    listSaves().then(setSaves).catch(() => setSaves([]));
  }, []);
  const load = async (slot: number) => {
    try {
      setWorld(await loadWorld(slot), slot === 0 ? 1 : slot);
      go('home');
    } catch (e) {
      toast(String((e as Error).message));
    }
  };
  const importFile = async (f: File) => {
    try {
      setWorld(deserializeWorld(await readSaveFile(f)), 1);
      go('home');
    } catch (e) {
      toast('読み込めませんでした: ' + (e as Error).message);
    }
  };
  return (
    <div class="title">
      <header class="hero">
        <div class="hero-light" />
        <h1>プロ野球<br /><span>ペナント・マネージャー</span></h1>
        <p>GM兼監督として、架空の12球団の1つを率いてください</p>
      </header>
      {saves.length > 0 && (
        <section class="card">
          <h2>続きから</h2>
          <ul class="savelist">
            {saves.map((s) => {
              const t = TEAMS.find((x) => x.id === s.userTeamId)!;
              return (
                <li key={s.slot}>
                  <button class="saveitem" onClick={() => load(s.slot)}>
                    <Logo team={t} size={28} />
                    <span>
                      <b>{s.slot === 0 ? 'オートセーブ' : `スロット${s.slot}`}</b> {s.name}
                      <small>{s.summary}・{new Date(s.savedAt).toLocaleString('ja-JP')}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section class="card">
        <h2>新しく始める（2027年シーズン）</h2>
        <p class="muted">率いる球団を選んでください。選手はすべて架空です。</p>
        {(['C', 'P'] as const).map((lg) => (
          <div key={lg}>
            <h3>{LEAGUE_NAMES[lg]}</h3>
            <div class="teamgrid">
              {TEAMS.filter((t) => t.league === lg).map((t) => (
                <button key={t.id} class={`teampick ${pick === t.id ? 'on' : ''}`} style={{ '--tc': t.primary } as never} onClick={() => setPick(t.id)}>
                  <Logo team={t} size={48} />
                  <b>{t.city}</b>
                  <span>{t.nickname}</span>
                  <small>{t.park.name}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button class="btn primary big" disabled={pick === null} onClick={() => { startNewGame(pick!); go('home'); }}>
          この球団で始める
        </button>
      </section>
      <section class="card">
        <h2>ファイルから読み込む</h2>
        <input type="file" accept=".json,.gz,application/json,application/gzip" onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) void importFile(f);
        }} />
      </section>
    </div>
  );
}
