/**
 * リーグ基準値と調整係数。
 * 打席結果は「ロジット（対数オッズ）＝リーグ基準＋打者補正＋投手補正＋状況補正」で計算する。
 * これは log5 / オッズ比法と同値（odds = oddsB * oddsP / oddsL）。
 * ここの数値を変えることで、リーグ全体の打撃環境を再調整できる。
 */
export interface EngineTuning {
  hbp: number; // 死球 / 打席
  bb: number; // 四球（敬遠除く）/ (打席-死球)
  k: number; // 三振 / (打席-死球-四球)
  hr: number; // 本塁打 / 打球(三振・四死球以外)
  gb: number; // 本塁打以外の打球のうちゴロ
  ld: number; // ライナー（ゴロ以外のうち）
  iffb: number; // 内野フライ（フライのうち）
  hitGB: number; // ゴロの安打率
  hitLD: number;
  hitFB: number;
  hitIFFB: number;
  dblLD: number; // 外野への安打のうち二塁打（ライナー）
  dblFB: number;
  dblGB: number;
  triple: number; // 外野への長打のうち三塁打
  error: number; // 凡打のうち失策になる率
  wildPitch: number; // 走者ありの打席あたり暴投・捕逸
}

export const DEFAULT_TUNING: EngineTuning = {
  hbp: 0.0085,
  bb: 0.0642,
  k: 0.2335,
  hr: 0.0169,
  gb: 0.455,
  ld: 0.33,
  iffb: 0.26,
  hitGB: 0.2468,
  hitLD: 0.6829,
  hitFB: 0.1871,
  hitIFFB: 0.01,
  dblLD: 0.2291,
  dblFB: 0.4006,
  dblGB: 0.055,
  triple: 0.0685,
  error: 0.026,
  wildPitch: 0.012,
};

/** 打席ごとの平均投球数（結果別） */
export const PITCHES_PER_RESULT = {
  K: 4.9,
  BB: 5.7,
  HBP: 3.3,
  BIP: 3.45,
  IBB: 0,
  BUNT: 2.2,
} as const;

/** 延長の上限イニング（NPB公式戦は12回） */
export const MAX_INNINGS_REGULAR = 12;
