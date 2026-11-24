import type { World } from '../league/world';
import { teamById } from '../league/world';
import { deserializeWorld, serializeWorld, type SaveMeta } from './serialize';

const DB_NAME = 'npb-sim';
const DB_VER = 1;
export const SLOT_COUNT = 5;
/** オートセーブ用のスロット番号 */
export const AUTO_SLOT = 0;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const r = fn(t);
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function listSaves(): Promise<SaveMeta[]> {
  const db = await open();
  const all = (await tx<SaveMeta[]>(db, ['meta'], 'readonly', (t) => t.objectStore('meta').getAll())) ?? [];
  db.close();
  return all.sort((a, b) => a.slot - b.slot);
}

export function metaFor(w: World, slot: number, name?: string): SaveMeta {
  const team = teamById(w, w.userTeamId);
  return {
    slot, name: name ?? `${team.city}${team.nickname} ${w.year}年`, savedAt: Date.now(), year: w.year, date: w.date,
    userTeamId: w.userTeamId, summary: `${w.year}年 ${w.date}`, version: w.version,
  };
}

export async function saveWorld(w: World, slot: number, name?: string): Promise<SaveMeta> {
  const db = await open();
  const meta = metaFor(w, slot, name);
  const json = serializeWorld(w);
  await tx(db, ['meta', 'data'], 'readwrite', (t) => {
    t.objectStore('meta').put(meta);
    t.objectStore('data').put({ slot, json });
  });
  db.close();
  return meta;
}

export async function loadWorld(slot: number): Promise<World> {
  const db = await open();
  const rec = await tx<{ slot: number; json: string }>(db, ['data'], 'readonly', (t) => t.objectStore('data').get(slot));
  db.close();
  if (!rec) throw new Error('セーブデータがありません');
  return deserializeWorld(rec.json);
}

export async function deleteSave(slot: number): Promise<void> {
  const db = await open();
  await tx(db, ['meta', 'data'], 'readwrite', (t) => {
    t.objectStore('meta').delete(slot);
    t.objectStore('data').delete(slot);
  });
  db.close();
}
