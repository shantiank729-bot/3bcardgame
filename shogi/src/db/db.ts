// IndexedDB の小さなラッパー。対局記録・プロフィール（レーティング）・詰将棋の進み具合などを保存する。

const DB_NAME = "shogi-dojo";
const DB_VERSION = 1;
export const STORES = ["games", "kv"] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("games")) {
        const s = db.createObjectStore("games", { keyPath: "id", autoIncrement: true });
        s.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

/** テスト用: 接続を閉じて次回開き直す */
export async function closeDb() {
  if (dbp) (await dbp).close();
  dbp = null;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  const db = await openDb();
  return wrap(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).get(key));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await wrap(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

/** 全データを JSON にする（書き出し用） */
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const s of STORES) data[s] = await getAll(s);
  return JSON.stringify({ app: "shogi-dojo", version: DB_VERSION, exportedAt: new Date().toISOString(), data });
}

/** 書き出した JSON から読み込む（今のデータは置き換える） */
export async function importAll(json: string): Promise<{ games: number }> {
  const parsed = JSON.parse(json);
  if (parsed?.app !== "shogi-dojo" || typeof parsed.data !== "object") throw new Error("このアプリの書き出しファイルではありません");
  const db = await openDb();
  const tx = db.transaction([...STORES], "readwrite");
  for (const s of STORES) {
    const os = tx.objectStore(s);
    os.clear();
    for (const v of parsed.data[s] ?? []) os.put(v);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { games: (parsed.data.games ?? []).length };
}
