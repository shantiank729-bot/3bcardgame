export type Hand = 'L' | 'R';
export type BatSide = 'L' | 'R' | 'S';
export type FieldPos = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
export type Pos = FieldPos | 'DH';
export const FIELD_POSITIONS: readonly FieldPos[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/** 能力値は 1〜100、50 がリーグ平均（一軍レギュラー級の平均） */
export interface BatterRatings {
  contact: number; // ミート
  power: number; // パワー
  eye: number; // 選球眼
  speed: number; // 走力
  fielding: number; // 守備力（守備範囲）
  arm: number; // 肩
  catching: number; // 捕球（失策の少なさ）
  /** 守れるポジションと適性(0-100)。100=本職 */
  positions: Partial<Record<FieldPos, number>>;
  /** 左右の相性の強さ（50=平均的、高いほど苦手な側への弱さが小さい） */
  platoon?: number;
}

export type PitchType =
  | 'FB' // ストレート
  | 'SL' // スライダー
  | 'CT' // カットボール
  | 'CB' // カーブ
  | 'CH' // チェンジアップ
  | 'FK' // フォーク
  | 'SF' // スプリット
  | 'SI' // シンカー/ツーシーム
  | 'SH'; // シュート

export const PITCH_NAMES: Record<PitchType, string> = {
  FB: 'ストレート', SL: 'スライダー', CT: 'カットボール', CB: 'カーブ', CH: 'チェンジアップ',
  FK: 'フォーク', SF: 'スプリット', SI: 'シンカー', SH: 'シュート',
};

export interface Pitch {
  type: PitchType;
  quality: number; // 1-100
}

export interface PitcherRatings {
  velocity: number; // 最速 km/h（球威の元）
  control: number; // 制球
  stamina: number; // スタミナ
  /** ゴロ/フライ傾向 -50(フライ)〜+50(ゴロ) */
  groundball: number;
  pitches: Pitch[]; // ストレート以外の変化球
}

export interface Player {
  id: number;
  name: string;
  age: number;
  bats: BatSide;
  throws: Hand;
  /** 投手として登録されているか */
  isPitcher: boolean;
  bat: BatterRatings;
  pit?: PitcherRatings;
  /** 調子 -1(絶不調)〜+1(絶好調) */
  form?: number;
  /** 外国人選手か */
  foreign?: boolean;
}

export interface Park {
  id: number;
  name: string;
  /** 両翼・中堅 m（見た目と三塁打・二塁打の出やすさに使う） */
  lf: number;
  cf: number;
  rf: number;
  /** 本塁打の出やすさ 1.0=平均 */
  hrFactor: number;
  /** 単打・ゴロ/ライナー安打の出やすさ 1.0=平均 */
  hitFactor: number;
  /** 二塁打・三塁打 */
  doubleFactor: number;
  tripleFactor: number;
  dome: boolean;
  /** 人工芝（ゴロが抜けやすい） */
  turf: boolean;
}

export type BullpenRole = 'CL' | 'SU1' | 'SU2' | 'MID' | 'LONG';

/** 1試合分の起用プラン（采配AIの入力） */
export interface GameLineup {
  /** 打順 9人と守備位置 */
  order: { playerId: number; pos: Pos }[];
  startingPitcher: number;
  bench: number[];
  bullpen: { playerId: number; role: BullpenRole }[];
}

/** 試合前の投手の疲労（チーム側で管理） */
export interface PitcherAvailability {
  /** 直近日の登板投球数。[0]=前日、[1]=2日前... */
  recent: number[];
}

export interface TeamGameInput {
  teamId: number;
  name: string;
  players: Map<number, Player>;
  lineup: GameLineup;
  availability: Map<number, PitcherAvailability>;
  /** 采配の積極性 0-100（バント・盗塁の多さ） */
  smallBall?: number;
}
