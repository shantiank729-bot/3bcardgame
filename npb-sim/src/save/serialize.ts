import { SAVE_VERSION, type World } from '../league/world';
import { Rng } from '../engine/rng';
import { rollPotential } from '../players/development';
import { initContract, SEASON_DAYS } from '../league/contracts';

export interface SaveMeta {
  slot: number;
  name: string;
  savedAt: number;
  year: number;
  date: string;
  userTeamId: number;
  summary: string;
  version: number;
}

export function serializeWorld(w: World): string {
  return JSON.stringify(w);
}

/** 読み込み（古い版のデータは必要に応じて変換） */
export function deserializeWorld(json: string): World {
  const w = JSON.parse(json) as World;
  if (!w || typeof w !== 'object' || !w.players || !w.calendar) throw new Error('セーブデータの形式が正しくありません');
  if (w.version > SAVE_VERSION) throw new Error('新しいバージョンのセーブデータです');
  return migrate(w);
}

function migrate(w: World): World {
  // version 1 → 2: ポストシーズン・表彰・新聞
  w.history ??= {};
  w.post ??= null;
  w.postStats ??= {};
  w.allStar ??= null;
  w.awards ??= {};
  w.news ??= {};
  w.flags ??= {};
  // version 2 → 3: 契約・潜在能力・ケガ・登録日数・オフシーズン
  if (w.version < 3) {
    for (const p of Object.values(w.players)) {
      const rng = new Rng(p.id * 7919 + 13);
      if (p.pot === undefined) Object.assign(p, rollPotential(rng, p));
      p.injury ??= null;
      p.events ??= [];
      p.entry ??= p.foreign ? 'FOR' : 'HS';
      if (p.service === undefined) {
        const yrs = Math.max(0, w.year - (p.debutYear ?? w.year) - 1);
        p.service = Math.round(yrs * SEASON_DAYS * (p.status === 'active' ? 0.7 : 0.2));
      }
      p.contract ??= initContract(rng, p);
    }
    w.inbox ??= [];
    w.draft ??= null;
    w.off ??= null;
    w.trades ??= [];
    if (!w.budget) {
      w.budget = {};
      for (const t of w.teams) w.budget[t.id] = Math.round(Object.values(w.players).filter((p) => p.teamId === t.id).reduce((s2, p) => s2 + p.contract.salary, 0) * 1.08 / 1000) * 1000;
    }
  }
  w.version = SAVE_VERSION;
  return w;
}

/** gzip 圧縮（ブラウザの CompressionStream があれば） */
export async function gzip(text: string): Promise<Blob> {
  const blob = new Blob([text], { type: 'application/json' });
  if (typeof CompressionStream === 'undefined') return blob;
  const cs = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(cs).blob();
}

export async function readSaveFile(file: Blob): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const ds = file.stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(ds).text();
  }
  return file.text();
}
