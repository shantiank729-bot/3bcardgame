/** アマチュア野球の世界を作る・1年ごとに入れ替える */
import { Rng } from '../engine/rng';
import type { FieldPos, Player } from '../engine/types';
import { allocPlayerId, generateBatter, generatePitcher, setNextPlayerId } from '../players/generate';
import { developPlayer, overall, rollPotential } from '../players/development';
import { CORPS, PREFS, REGIONS, SCHOOL_COLORS, schoolNames, SPLIT_NAMES, UNI_LEAGUES } from './data';
import type { AmStage, Amateur, AmateurWorld, School, ScoutStaff } from './types';
import { randomName } from '../players/generate';

const POS: Exclude<FieldPos, 'P'>[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SS', 'CF', 'C', '2B'];

export function makeAmateur(rng: Rng, school: School, stage: AmStage, grade: number, pitcher: boolean, pos?: Exclude<FieldPos, 'P'>): Amateur {
  const age = stage === 'HS' ? 15 + grade : stage === 'UNI' ? 18 + grade : 18 + grade + (rng.chance(0.4) ? 4 : 0);
  const base = stage === 'HS' ? 4 + grade * 4 : stage === 'UNI' ? 20 + grade * 2.5 : 30 + Math.min(grade, 4) * 1.5;
  const level = base + school.strength * (stage === 'HS' ? 0.12 : 0.08) + rng.normal(0, 5);
  const p: Player = pitcher
    ? generatePitcher(rng, rng.chance(0.6) ? 'SP' : 'RP', { level, age, spread: 8 })
    : generateBatter(rng, pos ?? rng.pick(POS), { level, age, spread: 8 });
  if (pitcher && p.pit) p.pit.velocity = Math.round((p.pit.velocity - (stage === 'HS' ? 10 - grade * 1.5 : stage === 'UNI' ? 3 : 1)) * 10) / 10;
  const pr = rollPotential(rng, p);
  // 有望な素材は強豪校に集まりやすい
  const pot = Math.min(99, Math.round(pr.pot + (stage === 'HS' ? school.strength * 0.05 + (rng.chance(0.04) ? rng.int(4, 12) : 0) : 0)));
  return {
    ...p, stage, schoolId: school.id, grade, pos: pitcher ? 'P' : (Object.keys(p.bat.positions)[0] as FieldPos), pot, growth: pr.growth,
    hype: 0, shibou: false, path: [], sbat: {}, spit: {}, notes: [],
  };
}

function rosterFor(rng: Rng, s: School, out: Record<number, Amateur>, year: number) {
  const grades = s.kind === 'HS' ? 3 : s.kind === 'UNI' ? 4 : 6;
  const perGrade = s.kind === 'HS' ? 7 : s.kind === 'UNI' ? 5 : 3;
  for (let g = 1; g <= grades; g++) {
    for (let i = 0; i < perGrade; i++) {
      const pitcher = i < (s.kind === 'SHA' ? 1 : 2);
      const a = makeAmateur(rng, s, s.kind, g, pitcher, i === 2 ? 'C' : undefined);
      if (s.kind !== 'HS') {
        a.path.push(`${fakeHS(rng)}`);
        a.notes.push({ year: year - g + 1, text: `${s.name}に${s.kind === 'UNI' ? '進学' : '入社'}` });
      } else a.notes.push({ year: year - g + 1, text: `${s.name}に入学` });
      out[a.id] = a;
    }
  }
}

function fakeHS(rng: Rng) {
  const pref = rng.pick(PREFS)[0];
  return schoolNames(pref, 1, () => rng.next())[0];
}

export function createAmateurWorld(seed: number, year: number, nextId: number): { am: AmateurWorld; nextId: number } {
  const rng = new Rng(seed ^ 0x51ed);
  setNextPlayerId(nextId);
  const schools: Record<number, School> = {};
  let sid = 1;
  PREFS.forEach(([name, region, n], pi) => {
    const names = schoolNames(name, n, () => rng.next());
    const split = SPLIT_NAMES[name];
    names.forEach((nm, i) => {
      // 各県に強豪校が1〜2校
      const strength = Math.round(i === 0 ? 70 + rng.next() * 25 : i === 1 && rng.chance(0.6) ? 55 + rng.next() * 20 : 15 + rng.next() * 45);
      schools[sid] = {
        id: sid, name: nm, kind: 'HS', pref: pi, district: split ? split[i % 2] : name, region, strength,
        coach: Math.round(Math.min(95, strength * 0.6 + rng.next() * 40)), facility: Math.round(Math.min(95, strength * 0.7 + rng.next() * 30)),
        colors: SCHOOL_COLORS[sid % SCHOOL_COLORS.length], koshien: { apps: Math.round(strength > 60 ? rng.next() * strength / 4 : rng.next() * 3), wins: 0, titles: strength > 85 && rng.chance(0.4) ? rng.int(1, 3) : 0 }, history: [],
      };
      schools[sid].koshien.wins = Math.round(schools[sid].koshien.apps * (0.6 + rng.next()));
      sid++;
    });
  });
  UNI_LEAGUES.forEach((lg, li) => lg.unis.forEach((nm, i) => {
    const strength = Math.round(30 + rng.next() * 60 - i * 3);
    schools[sid] = { id: sid, name: nm, kind: 'UNI', pref: -1, district: lg.name, region: 'uni', league: li, strength, coach: 40 + rng.int(0, 50), facility: 40 + rng.int(0, 50), colors: SCHOOL_COLORS[(sid * 7) % SCHOOL_COLORS.length], koshien: { apps: 0, wins: 0, titles: 0 }, history: [] };
    sid++;
  }));
  for (const nm of CORPS) {
    schools[sid] = { id: sid, name: nm, kind: 'SHA', pref: -1, district: '社会人', region: 'sha', strength: 40 + rng.int(0, 40), coach: 50 + rng.int(0, 30), facility: 50 + rng.int(0, 30), colors: SCHOOL_COLORS[(sid * 5) % SCHOOL_COLORS.length], koshien: { apps: 0, wins: 0, titles: 0 }, history: [] };
    sid++;
  }
  const players: Record<number, Amateur> = {};
  for (const s of Object.values(schools)) rosterFor(rng, s, players, year);
  const scouts: ScoutStaff[] = REGIONS.filter((_, i) => i % 2 === 0).map((r, i) => ({ id: i + 1, name: randomName(rng), skill: 45 + rng.int(0, 40), area: r.key }));
  scouts.push({ id: 6, name: randomName(rng), skill: 50 + rng.int(0, 35), area: 'uni' });
  const am: AmateurWorld = { schools, players, tourneys: {}, lastTick: `${year}-03-01`, pitchLog: {}, scouts, watch: {}, seen: {}, senbatsu: {} };
  for (const p of Object.values(players)) p.hype = baseHype(p);
  return { am, nextId: allocPlayerId() };
}

/** 能力から見た注目度の下地 */
export function baseHype(p: Amateur): number {
  const o = overall(p);
  const expect = p.stage === 'HS' ? 18 + p.grade * 6 : p.stage === 'UNI' ? 32 + p.grade * 3 : 44;
  return Math.max(0, Math.min(100, Math.round((o - expect) * 4 + (p.pot - 50) * 1.2 + 20)));
}

export const schoolsOf = (am: AmateurWorld, kind: AmStage) => Object.values(am.schools).filter((s) => s.kind === kind);
export const rosterOfSchool = (am: AmateurWorld, sid: number) => Object.values(am.players).filter((p) => p.schoolId === sid);

/** 半年ごとの成長（4月と8月） */
export function amateurGrowth(am: AmateurWorld, rng: Rng, half: boolean) {
  for (const p of Object.values(am.players)) {
    const s = am.schools[p.schoolId];
    const bonus = ((s.coach - 50) / 50) * 0.5 + ((s.facility - 50) / 50) * 0.3;
    developPlayer(rng, p, bonus, half ? 0.35 : 0.75);
  }
}

/**
 * 新年度（4月1日）: 卒業・進学・入学。
 * draftedIds: 前年のドラフトで指名されてプロへ行く選手（すでに世界から外れている）
 */
export function newSchoolYear(am: AmateurWorld, rng: Rng, year: number, alloc: () => number) {
  const hsGrads: Amateur[] = [];
  const uniGrads: Amateur[] = [];
  for (const p of Object.values(am.players)) {
    p.age++;
    p.shibou = false;
    p.retiredFromClub = false;
    if (p.stage === 'HS' && p.grade >= 3) hsGrads.push(p);
    else if (p.stage === 'UNI' && p.grade >= 4) uniGrads.push(p);
    else if (p.stage === 'SHA' && (p.grade >= 8 || p.age >= 31 || (p.grade >= 5 && rng.chance(0.3)))) delete am.players[p.id];
    else p.grade++;
  }
  // 大学・社会人へ（能力の高い順に、各大学5人・各社会人2人）
  const unis = schoolsOf(am, 'UNI').sort((a, b) => b.strength - a.strength);
  const corps = schoolsOf(am, 'SHA');
  const hsSorted = hsGrads.sort((a, b) => overall(b) + b.pot * 0.5 - (overall(a) + a.pot * 0.5));
  let k = 0;
  for (const u of unis) {
    for (let i = 0; i < 5 && k < hsSorted.length; i++, k++) moveTo(am, hsSorted[k], u, 'UNI', 1, year);
  }
  let c = 0;
  for (const corp of corps) {
    for (let i = 0; i < 2 && k < hsSorted.length; i++, k++, c++) moveTo(am, hsSorted[k], corp, 'SHA', 1, year);
  }
  for (; k < hsSorted.length; k++) delete am.players[hsSorted[k].id];
  const uSorted = uniGrads.sort((a, b) => overall(b) - overall(a));
  let ci = 0;
  for (const p of uSorted) {
    if (ci < corps.length * 2 && overall(p) >= 36) moveTo(am, p, corps[ci++ % corps.length], 'SHA', 1, year);
    else delete am.players[p.id];
  }
  // 中学から新入生
  for (const s of schoolsOf(am, 'HS')) {
    for (let i = 0; i < 7; i++) {
      setNextPlayerId(alloc());
      const a = makeAmateur(rng, s, 'HS', 1, i < 2, i === 2 ? 'C' : undefined);
      a.age = 16;
      a.notes.push({ year, text: `${s.name}に入学` });
      a.hype = baseHype(a);
      am.players[a.id] = a;
    }
  }
  // 各校の伝統の強さは実績で少しずつ変わる
  for (const s of Object.values(am.schools)) s.strength = Math.max(10, Math.min(98, s.strength * 0.97 + 1.5 + rng.normal(0, 1.5)));
}

function moveTo(am: AmateurWorld, p: Amateur, s: School, stage: AmStage, grade: number, year: number) {
  p.path.push(am.schools[p.schoolId].name);
  p.notes.push({ year, text: `${s.name}に${stage === 'UNI' ? '進学' : '入社'}` });
  p.schoolId = s.id;
  p.stage = stage;
  p.grade = grade;
}
