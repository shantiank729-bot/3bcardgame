import type { Player } from '../engine/types';
import type { RegionKey } from './data';

export type AmStage = 'HS' | 'UNI' | 'SHA';

export interface School {
  id: number;
  name: string;
  kind: AmStage;
  /** 都道府県の番号（PREFS）。大学・社会人は -1 */
  pref: number;
  /** 夏の大会の区分（北海道・東京は2つ） */
  district: string;
  region: RegionKey | 'uni' | 'sha';
  /** 大学リーグの番号 */
  league?: number;
  /** 伝統的な強さ（新入生の質に影響） 0-100 */
  strength: number;
  /** 監督の腕（成長に影響） */
  coach: number;
  /** 練習環境 */
  facility: number;
  colors: [string, string];
  koshien: { apps: number; wins: number; titles: number };
  /** 大会の実績メモ */
  history: { year: number; text: string }[];
}

/** 成績（コンパクト）: 打撃 [試合,打数,安打,二塁打,三塁打,本塁打,打点,四死球,三振,盗塁] / 投手 [登板,アウト,被安打,自責点,四死球,奪三振,勝,敗] */
export type BatArr = number[];
export type PitArr = number[];

export interface Amateur extends Player {
  stage: AmStage;
  schoolId: number;
  /** 学年（高校1-3、大学1-4）、社会人は在籍年数 */
  grade: number;
  pos: import('../engine/types').FieldPos;
  pot: number;
  growth: 'early' | 'normal' | 'late';
  /** 注目度 0-100 */
  hype: number;
  /** プロ志望届を出した */
  shibou: boolean;
  /** 出身高校など */
  path: string[];
  /** 年度・区分ごとの成績。キー: "2028" "2028K"(甲子園) "2028N"(大学全国) */
  sbat: Record<string, BatArr>;
  spit: Record<string, PitArr>;
  /** 実績（「2028年夏の甲子園優勝」など） */
  notes: { year: number; text: string }[];
  /** 高校の部活動を引退した（3年夏以降） */
  retiredFromClub?: boolean;
}

export interface TGame {
  a: number;
  b: number; // 0 = 不戦勝
  date: string;
  round: number;
  winner?: number;
  score?: [number, number];
  innings?: number;
  /** 試合のヒーロー */
  hero?: number;
}

export interface Tourney {
  id: string;
  name: string;
  short: string;
  stage: AmStage;
  level: 'pref' | 'region' | 'national' | 'league';
  year: number;
  /** 都道府県大会・地区大会の区分名 */
  area?: string;
  entrants: number[];
  games: TGame[];
  rounds: number;
  champion?: number;
  runnerUp?: number;
  /** 各チームが勝ち上がった回戦（地区大会→センバツ選考） */
  reached: Record<number, number>;
  done: boolean;
  /** 個人の大会成績（全国大会のみ）pid -> [安打,打数,本塁打,打点,奪三振,アウト,自責点] */
  leaders?: Record<number, number[]>;
  /** リーグ戦の勝敗 */
  table?: Record<number, [number, number, number]>;
  /** トーナメントの枠（回戦ごとの並び、0 は空き） */
  bracket?: number[][];
  /** 回戦ごとの日程 */
  roundDates?: string[][];
}

export interface ScoutStaff {
  id: number;
  name: string;
  skill: number;
  area: RegionKey | 'uni' | 'sha';
}

export interface AmateurWorld {
  schools: Record<number, School>;
  players: Record<number, Amateur>;
  tourneys: Record<string, Tourney>;
  /** 最後に処理した日 */
  lastTick: string;
  /** 投手の登板記録（日付→球数） pid -> { dayKey: pitches } */
  pitchLog: Record<number, Record<string, number>>;
  scouts: ScoutStaff[];
  /** 注目リスト: pid -> 視察回数 */
  watch: Record<number, { visits: number; best: number; added: string }>;
  /** 視察の記録（リスト外も含む） */
  seen: Record<number, { visits: number; best: number }>;
  /** センバツ出場校（年→学校ID） */
  senbatsu: Record<number, number[]>;
  /** 21世紀枠（年→学校ID） */
  senbatsu21?: Record<number, number[]>;
  /** 能力基準（年度初めに更新） */
  norm?: Record<AmStage, import('../engine/pa').RatingNorm>;
}
