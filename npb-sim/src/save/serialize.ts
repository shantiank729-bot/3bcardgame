import { SAVE_VERSION, type World } from '../league/world';

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
  // version 1 が最初の形式
  w.history ??= {};
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
