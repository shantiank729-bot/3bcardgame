/**
 * ドラフト候補（プロ志望届を出した高校生・大学生と、社会人選手）。
 * フェーズ6でアマチュア野球の世界から供給するように差し替える。それまでは毎年ここで生成する。
 */
import { Rng } from '../engine/rng';
import type { FieldPos, Player } from '../engine/types';
import { generateBatter, generatePitcher } from './generate';
import { overall, rollPotential } from './development';

export type AmateurKind = 'HS' | 'COL' | 'SHA';

export interface Prospect {
  /** 選手ID（入団後もそのまま使う） */
  id: number;
  player: Player;
  kind: AmateurKind;
  school: string;
  pos: FieldPos;
  pot: number;
  growth: 'early' | 'normal' | 'late';
  /** 注目度（0-100）。甲子園・大学での活躍で上がる */
  hype: number;
  /** 経歴のひとこと（例: 「夏の甲子園優勝投手」） */
  note: string;
  /** フェーズ6用: アマチュア時代の成績・経歴 */
  amateurCareer?: unknown;
}

const HS_PREFIX = ['北', '南', '東', '西', '中央', '城', '桜', '青葉', '緑', '若葉', '旭', '松', '白樺', '光', '星'];
const HS_PLACE = ['海', '山', '丘', '川', '原', '台', '浜', '森', '野', '谷'];
const HS_SUFFIX = ['高校', '学園', '実業高校', '工業高校', '商業高校', '学院'];
const UNIV = ['関東文理大学', '東都工科大学', '中央学芸大学', '北陸体育大学', '関西国際大学', '九州産業技術大学', '東北学院工業大学', '六甲大学', '湘南経済大学', '瀬戸内大学', '武蔵学院大学', '京洛大学'];
const CORP = ['日の出製鉄', '大和重工', '東洋自動車', '関西ガス', '北海電力', '新星化学', '中部鉄道', '九州通運', '城南銀行', '富士精機'];

export function fakeSchool(rng: Rng, kind: AmateurKind): string {
  if (kind === 'COL') return rng.pick(UNIV);
  if (kind === 'SHA') return rng.pick(CORP);
  return `${rng.pick(HS_PREFIX)}${rng.pick(HS_PLACE)}${rng.pick(HS_SUFFIX)}`;
}

const POS: Exclude<FieldPos, 'P'>[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SS', 'CF'];

export function makeProspect(rng: Rng, kind: AmateurKind, quality: number): Prospect {
  const age = kind === 'HS' ? 18 : kind === 'COL' ? 22 : rng.int(22, 26);
  const level = (kind === 'HS' ? 26 : kind === 'COL' ? 35 : 40) + quality * (kind === 'HS' ? 16 : kind === 'COL' ? 14 : 13);
  const pitcher = rng.chance(0.5);
  const pos: FieldPos = pitcher ? 'P' : rng.pick(POS);
  const player = pitcher
    ? generatePitcher(rng, rng.chance(0.65) ? 'SP' : 'RP', { level, age, spread: 9 })
    : generateBatter(rng, pos as Exclude<FieldPos, 'P'>, { level, age, spread: 9 });
  if (pitcher && player.pit) player.pit.velocity = Math.round(player.pit.velocity - (kind === 'HS' ? 4 : 1.5));
  const ovr = overall(player);
  const pr = rollPotential(rng, player, ovr);
  // 高校生は伸びしろ大きめ
  const pot = Math.min(99, Math.round(pr.pot + (kind === 'HS' ? 2 : kind === 'COL' ? 1 : -1) + quality * 6));
  const hype = Math.max(0, Math.min(100, Math.round(quality * 70 + rng.normal(10, 12))));
  return { id: player.id, player, kind, school: fakeSchool(rng, kind), pos, pot, growth: pr.growth, hype, note: '' };
}

/** その年のドラフト候補を作る（質は上位ほど高い） */
export function generateDraftClass(rng: Rng): Prospect[] {
  const out: Prospect[] = [];
  const add = (kind: AmateurKind, n: number) => {
    for (let i = 0; i < n; i++) {
      // 上位候補は少なく、多くは中位以下
      const q = Math.pow(rng.next(), 2.2);
      out.push(makeProspect(rng, kind, q));
    }
  };
  add('HS', 95);
  add('COL', 70);
  add('SHA', 40);
  for (const p of out) {
    if (p.hype >= 70) p.note = p.kind === 'HS' ? rng.pick(['甲子園を沸かせた', '世代No.1と評判の', '高校通算本塁打を量産した', '最速150km超の']) : p.kind === 'COL' ? rng.pick(['大学日本代表の', 'リーグ戦で記録を作った', '神宮を沸かせた']) : rng.pick(['即戦力と評判の', '都市対抗で活躍した']);
  }
  return out;
}
