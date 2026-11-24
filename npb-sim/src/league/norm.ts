/** リーグ基準補正の計算（毎シーズン・定期的に更新） */
import { NORM_REF, pitcherStuff, type RatingNorm } from '../engine/pa';
import { pitcherValue } from '../engine/ai';
import { autoLineup } from './roster';
import { rosterOf, type World } from './world';

export function computeNorm(w: World): RatingNorm {
  const H: { contact: number; power: number; eye: number; speed: number; fielding: number }[] = [];
  const P: { stuff: number; control: number }[] = [];
  for (const t of w.teams) {
    const active = rosterOf(w, t.id).filter((p) => p.status === 'active' || (p.status === 'farm' && !p.injury));
    const hitters = active.filter((p) => !p.isPitcher);
    const lu = autoLineup(hitters, true);
    for (const o of lu.order) H.push(w.players[o.playerId].bat);
    const pit = active.filter((p) => p.isPitcher);
    const sp = pit.filter((p) => p.pit!.stamina >= 50).sort((a, b) => pitcherValue(b) - pitcherValue(a)).slice(0, 6);
    const rp = pit.filter((p) => !sp.includes(p)).sort((a, b) => pitcherValue(b) - pitcherValue(a)).slice(0, 5);
    for (const p of [...sp, ...sp, ...rp]) P.push({ stuff: pitcherStuff(p.pit!), control: p.pit!.control });
  }
  const m = <T,>(xs: T[], f: (x: T) => number) => (xs.length ? xs.reduce((s, x) => s + f(x), 0) / xs.length : 0);
  return {
    contact: m(H, (x) => x.contact) - NORM_REF.contact,
    power: m(H, (x) => x.power) - NORM_REF.power,
    eye: m(H, (x) => x.eye) - NORM_REF.eye,
    speed: m(H, (x) => x.speed) - NORM_REF.speed,
    fielding: m(H, (x) => x.fielding) - NORM_REF.fielding,
    stuff: m(P, (x) => x.stuff) - NORM_REF.stuff,
    control: m(P, (x) => x.control) - NORM_REF.control,
  };
}
