/** アマチュアの世界からドラフト候補を作る */
import { overall } from '../players/development';
import type { Prospect } from '../players/prospects';
import type { AmateurCareer, World } from '../league/world';
import type { Amateur } from './types';

/** 社会人がドラフト対象になるまでの年数（高卒3年・大卒2年） */
function shaEligible(a: Amateur) {
  const fromUni = a.notes.some((n) => n.text.includes('大学') && n.text.endsWith('入社')) || a.path.some((s) => s.includes('大学'));
  return a.grade >= (fromUni ? 2 : 3);
}

export function amateurCareer(w: World, a: Amateur): AmateurCareer {
  const am = w.amateur;
  const cur = am.schools[a.schoolId]?.name ?? '';
  // 年ごとの所属（入学・進学・入社のメモから）
  const moves = a.notes.filter((n) => /に(進学|入社)$/.test(n.text)).map((n) => ({ year: n.year, school: n.text.replace(/に(進学|入社)$/, '') }));
  const first = a.path[0] ?? cur;
  const schoolIn = (y: number) => {
    let s = first;
    for (const m of moves) if (m.year <= y) s = m.school;
    return s;
  };
  const keys = [...new Set([...Object.keys(a.sbat), ...Object.keys(a.spit)])].sort();
  const lines = keys.map((k) => {
    const year = Number(k.slice(0, 4));
    const label = k.endsWith('K') ? '甲子園' : k.endsWith('N') ? '全国大会' : '公式戦';
    return { year, label, school: schoolIn(year), bat: a.sbat[k], pit: a.spit[k] };
  });
  return { path: [...a.path, cur].filter((x, i, arr) => arr.indexOf(x) === i), lines };
}

export function draftClassFromAmateur(w: World): Prospect[] {
  const am = w.amateur;
  const all = Object.values(am.players);
  const sha = all.filter((p) => p.stage === 'SHA' && shaEligible(p)).sort((a, b) => overall(b) + b.pot * 0.3 - (overall(a) + a.pot * 0.3)).slice(0, 45);
  const list = [...all.filter((p) => p.shibou), ...sha];
  return list.map((a) => {
    const best = [...a.notes].reverse().find((n) => /優勝|甲子園|全国|大会|ヒーロー|本塁打|奪三振/.test(n.text));
    return {
      id: a.id, player: a, kind: a.stage === 'UNI' ? 'COL' : a.stage, school: am.schools[a.schoolId].name, pos: a.pos, pot: a.pot, growth: a.growth,
      hype: Math.round(a.hype), note: best ? best.text.replace(/（.*）.*$/, '') : '', amateurCareer: amateurCareer(w, a),
    };
  });
}

/** 指名された選手をアマチュアの世界から外す */
export function removeDrafted(w: World, ids: number[]) {
  for (const id of ids) {
    delete w.amateur.players[id];
    delete w.amateur.watch[id];
    delete w.amateur.seen[id];
  }
}
