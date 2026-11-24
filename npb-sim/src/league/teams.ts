import type { Park } from '../engine/types';

export type LeagueId = 'C' | 'P';
export const LEAGUE_NAMES: Record<LeagueId, string> = { C: 'セ・リーグ', P: 'パ・リーグ' };

export interface TeamInfo {
  id: number;
  league: LeagueId;
  city: string;
  nickname: string;
  /** 1文字の略称（順位表・スコアボード用） */
  short: string;
  /** 3文字の英字略称 */
  abbr: string;
  primary: string;
  secondary: string;
  /** ロゴの図案 */
  emblem: 'phoenix' | 'shark' | 'owl' | 'bolt' | 'star' | 'comet' | 'falcon' | 'wolf' | 'gull' | 'tree' | 'flame' | 'bison';
  park: Park;
  /** 小技を好む度合い（采配AI） */
  smallBall: number;
  /** 本拠地の人口規模（観客動員・財政用、1.0=平均） */
  market: number;
}

const park = (
  id: number, name: string, lf: number, cf: number, rf: number, hr: number, hit: number, dbl: number, tri: number, dome: boolean, turf: boolean,
): Park => ({ id, name, lf, cf, rf, hrFactor: hr, hitFactor: hit, doubleFactor: dbl, tripleFactor: tri, dome, turf });

/** 架空の12球団 */
export const TEAMS: TeamInfo[] = [
  { id: 1, league: 'C', city: '東京', nickname: 'スカイフェニックス', short: '東', abbr: 'TSP', primary: '#1d3f8f', secondary: '#f5a623', emblem: 'phoenix',
    park: park(1, '帝都ドーム', 100, 122, 100, 1.18, 1.0, 0.96, 0.8, true, true), smallBall: 40, market: 1.4 },
  { id: 2, league: 'C', city: '横浜', nickname: 'ベイシャークス', short: '浜', abbr: 'YBS', primary: '#0a6fb5', secondary: '#ffffff', emblem: 'shark',
    park: park(2, '港の見える丘スタジアム', 94, 118, 94, 1.2, 1.01, 0.97, 0.7, false, true), smallBall: 45, market: 1.15 },
  { id: 3, league: 'C', city: '名古屋', nickname: 'オウルズ', short: '名', abbr: 'NGO', primary: '#13318a', secondary: '#9fc3e8', emblem: 'owl',
    park: park(3, '金鯱ドーム', 100, 122, 100, 0.78, 0.98, 1.05, 1.15, true, true), smallBall: 60, market: 1.05 },
  { id: 4, league: 'C', city: '浪速', nickname: 'サンダーボルツ', short: '浪', abbr: 'NSB', primary: '#f2c200', secondary: '#111111', emblem: 'bolt',
    park: park(4, '浪速球場', 95, 118, 95, 0.86, 1.03, 1.04, 1.1, false, false), smallBall: 55, market: 1.3 },
  { id: 5, league: 'C', city: '瀬戸内', nickname: 'マリンスターズ', short: '瀬', abbr: 'SMS', primary: '#c8102e', secondary: '#ffffff', emblem: 'star',
    park: park(5, '瀬戸内ボールパーク', 101, 122, 100, 0.98, 1.02, 1.03, 1.2, false, false), smallBall: 65, market: 0.85 },
  { id: 6, league: 'C', city: '武蔵野', nickname: 'コメッツ', short: '武', abbr: 'MSC', primary: '#00804a', secondary: '#e4002b', emblem: 'comet',
    park: park(6, '武蔵野の杜球場', 91, 120, 91, 1.22, 1.01, 0.98, 0.9, false, true), smallBall: 45, market: 0.95 },
  { id: 7, league: 'P', city: '博多', nickname: 'ファルコンズ', short: '博', abbr: 'HKF', primary: '#f4c300', secondary: '#1a1a1a', emblem: 'falcon',
    park: park(7, '玄界灘ドーム', 100, 122, 100, 1.05, 0.99, 1.0, 0.85, true, true), smallBall: 40, market: 1.2 },
  { id: 8, league: 'P', city: '北海道', nickname: 'スノーウルブズ', short: '北', abbr: 'HSW', primary: '#00264d', secondary: '#b7a36b', emblem: 'wolf',
    park: park(8, '大雪ボールパーク', 97, 121, 99, 1.1, 1.0, 1.02, 1.0, true, false), smallBall: 50, market: 0.9 },
  { id: 9, league: 'P', city: '房総', nickname: 'シーガルズ', short: '房', abbr: 'BSG', primary: '#111111', secondary: '#c0c0c0', emblem: 'gull',
    park: park(9, '房総マリンフィールド', 99, 122, 99, 0.95, 1.0, 1.01, 0.95, false, true), smallBall: 55, market: 0.95 },
  { id: 10, league: 'P', city: '埼玉', nickname: 'フォレスターズ', short: '埼', abbr: 'STF', primary: '#102961', secondary: '#4fa3d8', emblem: 'tree',
    park: park(10, '狭山の森ドーム', 100, 122, 100, 1.0, 0.99, 1.0, 1.0, true, true), smallBall: 50, market: 0.95 },
  { id: 11, league: 'P', city: '仙台', nickname: 'ブレイズ', short: '仙', abbr: 'SDB', primary: '#860010', secondary: '#f2b700', emblem: 'flame',
    park: park(11, '杜の都スタジアム', 100, 122, 100, 0.94, 1.0, 1.02, 1.05, false, false), smallBall: 50, market: 0.85 },
  { id: 12, league: 'P', city: '京阪', nickname: 'バイソンズ', short: '京', abbr: 'KHB', primary: '#000e3c', secondary: '#c9a961', emblem: 'bison',
    park: park(12, '淀川ドーム', 100, 122, 100, 0.9, 0.99, 1.02, 1.0, true, true), smallBall: 50, market: 1.1 },
];

export const teamName = (t: TeamInfo) => `${t.city}${t.nickname}`;
