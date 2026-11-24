// 端末ごとの設定（小さな値なので localStorage。対局記録などは IndexedDB に保存する）
export interface Settings {
  sound: boolean;
  timePreset: string;
  /** 0 = 先手, 1 = 後手, 2 = ランダム */
  side: 0 | 1 | 2;
  showCoords: boolean;
  opponent: "ai" | "human";
  aiLevel: number;
}

const DEFAULTS: Settings = { sound: true, timePreset: "none", side: 2, showCoords: true, opponent: "ai", aiLevel: 5 };
const KEY = "shogi-dojo:settings";

let cache: Settings | null = null;

export const settings = {
  get(): Settings {
    if (cache) return cache;
    try {
      cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    } catch {
      cache = { ...DEFAULTS };
    }
    return cache!;
  },
  set(patch: Partial<Settings>) {
    cache = { ...settings.get(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 保存できなくても動作は続ける */ }
  },
};
