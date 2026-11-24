import { DEFAULT_TUNING, MAX_INNINGS_REGULAR, PITCHES_PER_RESULT, type EngineTuning } from './constants';
import { emptyBat, emptyField, emptyPitch, type BatLine, type FieldLine, type PitchLine } from './box';
import { isOutfield, logit, resolvePA, sigmoid, type BipResult, type DefenseMap, type PAOutcome } from './pa';
import { Rng } from './rng';
import { FIELD_POSITIONS, type BullpenRole, type FieldPos, type Park, type Player, type Pos, type TeamGameInput } from './types';
import * as AI from './ai';

export interface Runner {
  id: number;
  /** この走者の責任投手 */
  pitcher: number;
  /** 自責点になるか（失策で出塁した走者は false） */
  earned: boolean;
}
export type Bases = [Runner | null, Runner | null, Runner | null];

export interface PitcherState {
  id: number;
  role: BullpenRole | 'SP';
  pitches: number;
  outs: number;
  bf: number;
  limit: number;
  entryInning: number;
  /** 登板時の自チームのリード */
  entryLead: number;
  saveSituation: boolean;
  /** 同点の走者が塁上・打席・次打者にいる状態で登板 */
  tyingClose: boolean;
  /** 降板時のリード（未降板は null） */
  exitLead: number | null;
  /** 試合前からの疲労（連投など） */
  baseFatigue: number;
  facedCount: Map<number, number>;
}

export interface Slot {
  playerId: number;
  pos: Pos;
}

export interface SideState {
  team: TeamGameInput;
  isHome: boolean;
  order: Slot[];
  next: number; // 次打者の打順インデックス
  pitcher: PitcherState;
  pitchers: PitcherState[];
  defense: Record<FieldPos, number>;
  bench: number[];
  bullpen: { playerId: number; role: BullpenRole }[];
  used: Set<number>;
  /** 投手に代打を出したので次の守備で投手を交代する */
  needPitcher: boolean;
  phUsed: number;
  runs: number;
  hits: number;
  errors: number;
  lineScore: number[];
  lob: number;
  /** ボックススコア用: 出場順（打順・守備位置・途中出場か） */
  appearances: { pid: number; slot: number; pos: Pos; sub: boolean }[];
}

export type GameEvent =
  | {
      t: 'pa';
      inning: number; top: boolean; outsBefore: number; batter: number; pitcher: number;
      result: PAResultCode; bip?: BipResult; angle?: number; distance?: number;
      basesBefore: (number | null)[]; basesAfter: (number | null)[]; runs: number; rbi: number;
      scorers: number[]; outsAfter: number; scoreAway: number; scoreHome: number;
      /** 進塁などの補足（例: 'DP', 'SF', 'FC', 'outHome'） */
      notes: string[];
      pitches: number;
    }
  | { t: 'steal'; inning: number; top: boolean; runner: number; base: 2 | 3; success: boolean; outsAfter: number }
  | { t: 'wp'; inning: number; top: boolean; pitcher: number; runs: number; scorers: number[] }
  | { t: 'pitchChange'; inning: number; top: boolean; team: number; out: number; in: number; role: string }
  | { t: 'sub'; inning: number; top: boolean; team: number; kind: 'PH' | 'PR' | 'DEF'; out: number; in: number; pos: Pos }
  | { t: 'inningEnd'; inning: number; top: boolean; runs: number; scoreAway: number; scoreHome: number }
  | { t: 'end'; scoreAway: number; scoreHome: number; innings: number };

export type PAResultCode =
  | 'K' | 'BB' | 'IBB' | 'HBP' | '1B' | '2B' | '3B' | 'HR' | 'GO' | 'FO' | 'LO' | 'PO'
  | 'DP' | 'FC' | 'E' | 'SH' | 'SHFC' | 'SHHIT' | 'SF' | 'SQZ';

export interface GameOptions {
  dh: boolean;
  /** 延長の上限（これを超えて同点なら引き分け）。null で決着まで */
  maxInnings?: number | null;
  seed: number;
  tuning?: EngineTuning;
  /** イベントログを残す（観戦・新聞用）。一括計算では false で高速化 */
  log?: boolean;
  /** アマチュア用の打撃環境補正 */
  offenseShift?: number;
}

/** 打席前の作戦（ユーザーやAIが指定） */
export type OffenseTactic = 'none' | 'bunt' | 'steal' | 'steal3' | 'hitrun' | 'squeeze';

export interface PAObserver {
  /** 打席結果ごとに、打席前後のアウト・塁状況（RE24・線形加重の計算用） */
  onPA?(code: PAResultCode, outsBefore: number, basesBefore: number, outsAfter: number, basesAfter: number, runs: number): void;
  /** ハーフイニングの終了時、各打席開始時点から回終了までの得点 */
  onHalfInning?(states: { outs: number; bases: number; runsToEnd: number }[]): void;
}

export interface GameResult {
  awayRuns: number;
  homeRuns: number;
  innings: number;
  tie: boolean;
  lineAway: number[];
  lineHome: number[];
  hitsAway: number; hitsHome: number; errorsAway: number; errorsHome: number;
  bat: Map<number, BatLine>;
  pitch: Map<number, PitchLine>;
  field: Map<number, FieldLine>;
  /** 各チームの投手の登板記録（投球数）— 次の試合の疲労管理用 */
  pitchCounts: Map<number, number>;
  winningPitcher: number | null;
  losingPitcher: number | null;
  savePitcher: number | null;
  events: GameEvent[];
  /** 出場した選手（チームID→選手ID） */
  appeared: Map<number, number[]>;
  startersAway: number; startersHome: number;
  walkoff: boolean;
  appearancesAway: SideState['appearances'];
  appearancesHome: SideState['appearances'];
}

const basesMask = (b: Bases) => (b[0] ? 1 : 0) | (b[1] ? 2 : 0) | (b[2] ? 4 : 0);

export class GameSim {
  readonly rng: Rng;
  readonly tuning: EngineTuning;
  readonly away: SideState;
  readonly home: SideState;
  inning = 1;
  top = true;
  outs = 0;
  bases: Bases = [null, null, null];
  over = false;
  walkoff = false;
  events: GameEvent[] = [];
  readonly bat = new Map<number, BatLine>();
  readonly pitch = new Map<number, PitchLine>();
  readonly field = new Map<number, FieldLine>();
  /** 次の打席で使う作戦（ユーザー指示）。null ならAIが決める */
  pendingTactic: OffenseTactic | null = null;
  pendingIBB: boolean | null = null;
  /** ユーザーが操作するチームID（このチームのAI采配を止める項目を制御） */
  manualTeam: number | null = null;
  manualAuto = { pitching: true, subs: true, tactics: true };
  private lead: { side: 'home' | 'away' | null; winP: number | null; loseP: number | null } = { side: null, winP: null, loseP: null };
  private halfStates: { outs: number; bases: number; runsBefore: number }[] = [];
  private halfRuns = 0;
  private maxInn: number | null;
  observer?: PAObserver;
  infieldIn = false;
  private started = false;
  private halfPushed = false;

  constructor(awayIn: TeamGameInput, homeIn: TeamGameInput, readonly park: Park, readonly opts: GameOptions) {
    this.rng = new Rng(opts.seed);
    this.tuning = opts.tuning ?? DEFAULT_TUNING;
    this.maxInn = opts.maxInnings === undefined ? MAX_INNINGS_REGULAR : opts.maxInnings;
    this.away = this.initSide(awayIn, false);
    this.home = this.initSide(homeIn, true);
  }

  // ---------- 初期化 ----------
  private initSide(team: TeamGameInput, isHome: boolean): SideState {
    const L = team.lineup;
    const order: Slot[] = L.order.map((o) => ({ ...o }));
    const defense = {} as Record<FieldPos, number>;
    for (const s of order) if (s.pos !== 'DH') defense[s.pos as FieldPos] = s.playerId;
    if (this.opts.dh || !defense.P) defense.P = L.startingPitcher;
    const sp = team.players.get(L.startingPitcher)!;
    const pitcher = this.newPitcherState(team, sp, 'SP', 1, 0);
    const side: SideState = {
      team, isHome, order, next: 0, pitcher, pitchers: [pitcher], defense,
      bench: [...L.bench], bullpen: L.bullpen.map((b) => ({ ...b })),
      used: new Set([...order.map((o) => o.playerId), L.startingPitcher]),
      needPitcher: false, phUsed: 0, runs: 0, hits: 0, errors: 0, lineScore: [], lob: 0,
      appearances: order.map((o, i) => ({ pid: o.playerId, slot: i, pos: o.pos, sub: false })),
    };
    for (const id of side.used) this.batLine(id).g = 1;
    for (const s of order) this.batLine(s.playerId);
    const pl = this.pitchLine(sp.id);
    pl.g = 1;
    pl.gs = 1;
    return side;
  }

  private newPitcherState(team: TeamGameInput, p: Player, role: BullpenRole | 'SP', inning: number, lead: number): PitcherState {
    const st = p.pit!.stamina;
    const av = team.availability.get(p.id);
    const yesterday = av?.recent[0] ?? 0;
    const dayBefore = av?.recent[1] ?? 0;
    const baseFatigue = role === 'SP' ? 0 : Math.min(0.6, yesterday / 60 + dayBefore / 150);
    const limit =
      role === 'SP'
        ? 48 + st * 0.78 + this.rng.normal(0, 7) + (p.form ?? 0) * 6
        : 14 + st * 0.35 + (role === 'LONG' ? 25 : 0) + this.rng.normal(0, 4);
    return {
      id: p.id, role, pitches: 0, outs: 0, bf: 0, limit, entryInning: inning, entryLead: lead, saveSituation: false, tyingClose: false, exitLead: null,
      baseFatigue, facedCount: new Map(),
    };
  }

  batLine(id: number) {
    let l = this.bat.get(id);
    if (!l) this.bat.set(id, (l = emptyBat()));
    return l;
  }
  pitchLine(id: number) {
    let l = this.pitch.get(id);
    if (!l) this.pitch.set(id, (l = emptyPitch()));
    return l;
  }
  fieldLine(id: number) {
    let l = this.field.get(id);
    if (!l) this.field.set(id, (l = emptyField()));
    return l;
  }

  get offense() {
    return this.top ? this.away : this.home;
  }
  get defenseSide() {
    return this.top ? this.home : this.away;
  }
  player(side: SideState, id: number): Player {
    return side.team.players.get(id)!;
  }
  /** 守備側から見たリード */
  leadFor(side: SideState) {
    return side.isHome ? this.home.runs - this.away.runs : this.away.runs - this.home.runs;
  }
  isManual(side: SideState, what: 'pitching' | 'subs' | 'tactics') {
    return this.manualTeam === side.team.teamId && !this.manualAuto[what];
  }

  // ---------- 守備 ----------
  defenseMap(side: SideState): DefenseMap {
    const m = {} as DefenseMap;
    for (const pos of FIELD_POSITIONS) {
      const id = side.defense[pos];
      const p = side.team.players.get(id)!;
      const prof = p.bat.positions[pos] ?? (pos === 'P' ? (p.isPitcher ? 100 : 20) : 15);
      const pen = (100 - prof) * 0.5;
      m[pos] = {
        playerId: id,
        range: p.bat.fielding - pen,
        arm: p.bat.arm - pen * 0.3,
        hands: p.bat.catching - pen * 0.6,
      };
    }
    return m;
  }

  pitcherFatigue(ps: PitcherState): number {
    const over = ps.pitches - ps.limit * 0.8;
    return Math.max(0, ps.baseFatigue + (over > 0 ? over / (ps.limit * 0.3) : 0));
  }

  // ---------- 進行 ----------
  /** 1打席分（打席前の作戦・交代を含む）進める。試合終了なら false */
  step(): boolean {
    if (this.over) return false;
    if (!this.started) {
      this.started = true;
      this.beginHalf();
    }
    const off = this.offense;
    const def = this.defenseSide;

    // 守備側の投手交代（イニング途中）
    if (!this.isManual(def, 'pitching')) AI.maybeChangePitcherMidInning(this, def);
    // 攻撃側の代打・代走
    if (!this.isManual(off, 'subs')) {
      AI.maybePinchRun(this, off);
      AI.maybePinchHit(this, off);
    }
    // 作戦
    let tactic: OffenseTactic = this.pendingTactic ?? (this.isManual(off, 'tactics') ? 'none' : AI.chooseTactic(this, off));
    this.pendingTactic = null;
    tactic = this.validateTactic(tactic);
    const ibb = this.pendingIBB ?? (this.isManual(def, 'tactics') ? false : AI.shouldIBB(this, def, off));
    this.pendingIBB = null;
    this.infieldIn = AI.infieldIn(this, def);

    // 暴投・捕逸（走者がいるとき）
    if (this.bases.some(Boolean) && tactic !== 'bunt' && tactic !== 'squeeze') this.maybeWildPitch(def);
    if (this.over) return false;

    if (tactic === 'steal' || tactic === 'steal3') {
      this.attemptSteal(tactic === 'steal' ? 2 : 3);
      if (this.outs >= 3) {
        this.endHalf();
        return !this.over;
      }
    }
    if (ibb) {
      this.doPA('IBB');
    } else if (tactic === 'bunt' || tactic === 'squeeze') {
      this.doPA(tactic === 'bunt' ? 'BUNT' : 'SQZ');
    } else {
      this.doPA(tactic === 'hitrun' ? 'HITRUN' : 'NORMAL');
    }
    return !this.over;
  }

  runToEnd(): GameResult {
    let guard = 0;
    while (this.step() && guard++ < 2000);
    return this.result();
  }

  private validateTactic(t: OffenseTactic): OffenseTactic {
    const [b1, b2, b3] = this.bases;
    if (t === 'steal' && !(b1 && !b2)) return 'none';
    if (t === 'steal3' && !(b2 && !b3)) return 'none';
    if (t === 'squeeze' && !(b3 && this.outs < 2)) return 'none';
    if (t === 'bunt' && !(b1 || b2)) return 'none';
    if (t === 'hitrun' && !b1) return 'none';
    return t;
  }

  private beginHalf() {
    const def = this.defenseSide;
    this.halfRuns = 0;
    this.halfStates = [];
    if (!this.isManual(def, 'pitching')) AI.beginDefenseHalf(this, def);
    else if (def.needPitcher) AI.beginDefenseHalf(this, def);
    if (!this.isManual(def, 'subs')) AI.defensiveSubs(this, def);
    AI.fixDefense(this, def);
  }

  private endHalf() {
    const off = this.offense;
    off.lob += this.bases.filter(Boolean).length;
    off.lineScore.push(this.halfRuns);
    this.halfPushed = true;
    // RE24 用：各打席開始時点から回終了までの得点
    if (this.observer?.onHalfInning) {
      const total = this.halfRuns;
      this.observer.onHalfInning(this.halfStates.map((s) => ({ outs: s.outs, bases: s.bases, runsToEnd: total - s.runsBefore })));
    }
    if (this.opts.log) this.events.push({ t: 'inningEnd', inning: this.inning, top: this.top, runs: this.halfRuns, scoreAway: this.away.runs, scoreHome: this.home.runs });
    this.outs = 0;
    this.bases = [null, null, null];
    this.halfStates = [];
    this.halfRuns = 0;
    if (this.top) {
      // 裏の攻撃が必要か
      if (this.inning >= 9 && this.home.runs > this.away.runs) return this.finish();
      this.top = false;
    } else {
      if (this.inning >= 9 && this.home.runs !== this.away.runs) return this.finish();
      if (this.maxInn !== null && this.inning >= this.maxInn) return this.finish();
      this.inning++;
      this.top = true;
    }
    this.halfPushed = false;
    this.beginHalf();
  }

  private finish() {
    if (!this.halfPushed) {
      this.offense.lineScore.push(this.halfRuns);
      this.halfPushed = true;
    }
    this.over = true;
    if (this.opts.log) this.events.push({ t: 'end', scoreAway: this.away.runs, scoreHome: this.home.runs, innings: this.inning });
  }

  // ---------- 打席 ----------
  private currentBatter(): Slot {
    const off = this.offense;
    return off.order[off.next];
  }

  private recordDefenseOuts(n: number) {
    if (n <= 0) return;
    const def = this.defenseSide;
    for (const pos of FIELD_POSITIONS) {
      const fl = this.fieldLine(def.defense[pos]);
      fl.outsAt[pos] = (fl.outsAt[pos] ?? 0) + n;
    }
    def.pitcher.outs += n;
    this.pitchLine(def.pitcher.id).outs += n;
  }

  private addPitches(ps: PitcherState, kind: keyof typeof PITCHES_PER_RESULT) {
    const mean = PITCHES_PER_RESULT[kind];
    const n = mean === 0 ? 0 : Math.max(1, Math.round(this.rng.normal(mean, kind === 'BIP' ? 1.9 : 1.5)));
    ps.pitches += n;
    this.pitchLine(ps.id).pitches += n;
    return n;
  }

  /** 得点の処理。サヨナラの場合は決勝点までで打ち切る */
  private score(runners: Runner[], rbiEligible: boolean, scorers: number[]): { runs: number; rbi: number } {
    let runs = 0;
    let rbi = 0;
    const off = this.offense;
    const def = this.defenseSide;
    for (const r of runners) {
      if (this.over) break;
      runs++;
      off.runs++;
      this.halfRuns++;
      scorers.push(r.id);
      this.batLine(r.id).r++;
      const pl = this.pitchLine(r.pitcher);
      pl.r++;
      if (r.earned) pl.er++;
      if (rbiEligible) rbi++;
      this.updateLead(r);
      if (!this.top && this.inning >= 9 && this.home.runs > this.away.runs && !this.hrInProgress) {
        this.walkoff = true;
        this.over = true;
      }
    }
    void def;
    return { runs, rbi };
  }
  private hrInProgress = false;

  private updateLead(scoringRunner: Runner) {
    const diff = this.home.runs - this.away.runs;
    const now: 'home' | 'away' | null = diff > 0 ? 'home' : diff < 0 ? 'away' : null;
    if (now !== this.lead.side) {
      if (now === null) {
        this.lead = { side: null, winP: null, loseP: null };
      } else {
        const leading = now === 'home' ? this.home : this.away;
        this.lead = { side: now, winP: leading.pitcher.id, loseP: scoringRunner.pitcher };
      }
    }
  }

  private doPA(mode: 'NORMAL' | 'HITRUN' | 'BUNT' | 'SQZ' | 'IBB') {
    const off = this.offense;
    const def = this.defenseSide;
    const slot = this.currentBatter();
    const batter = this.player(off, slot.playerId);
    const ps = def.pitcher;
    const pitcher = this.player(def, ps.id);
    const bl = this.batLine(batter.id);
    const pl = this.pitchLine(pitcher.id);
    const outsBefore = this.outs;
    const basesBeforeMask = basesMask(this.bases);
    const basesBefore = this.bases.map((r) => r?.id ?? null);
    const risp = !!(this.bases[1] || this.bases[2]);
    const scorers: number[] = [];
    const notes: string[] = [];
    let runs = 0;
    let rbi = 0;
    let code: PAResultCode;
    let pitches = 0;
    let bipOut: BipResult | undefined;
    let outcomeAngle: number | undefined;
    let outcomeDist: number | undefined;
    this.halfStates.push({ outs: this.outs, bases: basesBeforeMask, runsBefore: this.halfRuns });

    bl.pa++;
    pl.bf++;
    ps.bf++;
    const faced = (ps.facedCount.get(batter.id) ?? 0) + 1;
    ps.facedCount.set(batter.id, faced);
    const newRunner = (earned = true): Runner => ({ id: batter.id, pitcher: ps.id, earned });

    if (mode === 'IBB') {
      code = 'IBB';
      bl.bb++;
      bl.ibb++;
      pl.bb++;
      pl.ibb++;
      const r = this.forceAdvance(newRunner());
      ({ runs, rbi } = this.score(r, true, scorers));
    } else if (mode === 'BUNT' || mode === 'SQZ') {
      pitches = this.addPitches(ps, 'BUNT');
      const res = this.resolveBunt(batter, mode === 'SQZ', newRunner, notes);
      code = res.code;
      ({ runs, rbi } = this.score(res.scored, res.rbi, scorers));
      if (code === 'SH' || code === 'SQZ') bl.sh++;
      else bl.ab++;
      if (code === 'SHHIT') {
        bl.h++;
        pl.h++;
        off.hits++;
      }
      if (code === 'K') {
        bl.k++;
        pl.k++;
      }
      this.recordDefenseOuts(this.outs - outsBefore);
    } else {
      const outcome: PAOutcome = resolvePA(
        {
          batter, pitcher, fatigue: this.pitcherFatigue(ps), timesFaced: Math.ceil(faced),
          park: this.park, defense: this.defenseMap(def), tuning: this.tuning,
          hitAndRun: mode === 'HITRUN', infieldIn: this.infieldIn, offenseShift: this.opts.offenseShift,
        },
        this.rng,
      );
      outcomeAngle = outcome.angle;
      outcomeDist = outcome.distance;
      switch (outcome.kind) {
        case 'HBP': {
          code = 'HBP';
          pitches = this.addPitches(ps, 'HBP');
          bl.hbp++;
          pl.hbp++;
          ({ runs, rbi } = this.score(this.forceAdvance(newRunner()), true, scorers));
          break;
        }
        case 'BB': {
          code = 'BB';
          pitches = this.addPitches(ps, 'BB');
          bl.bb++;
          pl.bb++;
          ({ runs, rbi } = this.score(this.forceAdvance(newRunner()), true, scorers));
          break;
        }
        case 'K': {
          code = 'K';
          pitches = this.addPitches(ps, 'K');
          bl.ab++;
          bl.k++;
          pl.k++;
          this.outs++;
          // エンドランで空振り→走者は盗塁扱い
          if (mode === 'HITRUN' && this.outs < 3 && this.bases[0] && !this.bases[1]) this.stealCore(2, true);
          this.recordDefenseOuts(1);
          break;
        }
        case 'HR': {
          code = 'HR';
          pitches = this.addPitches(ps, 'BIP');
          bl.ab++;
          bl.h++;
          bl.hr++;
          pl.h++;
          pl.hr++;
          off.hits++;
          const runners = [this.bases[2], this.bases[1], this.bases[0]].filter(Boolean) as Runner[];
          runners.push(newRunner());
          this.bases = [null, null, null];
          this.hrInProgress = true;
          ({ runs, rbi } = this.score(runners, true, scorers));
          this.hrInProgress = false;
          if (!this.top && this.inning >= 9 && this.home.runs > this.away.runs) {
            this.walkoff = true;
            this.over = true;
          }
          break;
        }
        default: {
          const bip = outcome.bip!;
          bipOut = bip;
          pitches = this.addPitches(ps, 'BIP');
          const r = this.resolveBip(bip, batter, mode === 'HITRUN', newRunner, notes, def);
          code = r.code;
          ({ runs, rbi } = this.score(r.scored, r.rbi, scorers));
          if (code === 'SF') bl.sf++;
          else bl.ab++;
          if (bip.hit) {
            bl.h++;
            pl.h++;
            off.hits++;
            if (bip.hit === 2) bl.d++;
            if (bip.hit === 3) bl.t++;
          }
          if (code === 'DP') bl.gidp++;
          const bt = bip.type;
          bl[bt === 'GB' ? 'gb' : bt === 'FB' ? 'fb' : bt === 'LD' ? 'ld' : 'iffb']++;
          pl[bt === 'GB' ? 'gb' : bt === 'FB' ? 'fb' : bt === 'LD' ? 'ld' : 'iffb']++;
          pl.bip++;
          if (code === 'SF') pl.sf++;
          // 守備記録
          const fid = def.defense[bip.fielder];
          const fl = this.fieldLine(fid);
          fl.chances++;
          fl.outsAboveAvg += (bip.hit || bip.error ? 0 : 1) - bip.expOut;
          if (bip.error) {
            fl.e++;
            def.errors++;
          }
          this.recordDefenseOuts(this.outs - outsBefore);
        }
      }
    }
    if (risp && (code === '1B' || code === '2B' || code === '3B' || code === 'HR' || code === 'SHHIT')) bl.rispH++;
    if (risp && !['BB', 'IBB', 'HBP', 'SH', 'SF', 'SQZ'].includes(code)) bl.rispAb++;
    bl.rbi += rbi;
    off.next = (off.next + 1) % 9;
    this.observer?.onPA?.(code, outsBefore, basesBeforeMask, Math.min(3, this.outs), this.outs >= 3 ? 0 : basesMask(this.bases), runs);
    if (this.opts.log) {
      this.events.push({
        t: 'pa', inning: this.inning, top: this.top, outsBefore, batter: batter.id, pitcher: pitcher.id, result: code,
        bip: bipOut, angle: outcomeAngle, distance: outcomeDist, basesBefore, basesAfter: this.bases.map((r) => r?.id ?? null),
        runs, rbi, scorers, outsAfter: this.outs, scoreAway: this.away.runs, scoreHome: this.home.runs, notes, pitches,
      });
    }
    if (this.over) this.finish();
    else if (this.outs >= 3) this.endHalf();
  }

  /** 押し出し進塁（四死球など） */
  private forceAdvance(batter: Runner): Runner[] {
    const [b1, b2, b3] = this.bases;
    const scored: Runner[] = [];
    if (b1) {
      if (b2) {
        if (b3) scored.push(b3);
        this.bases[2] = b2;
      }
      this.bases[1] = b1;
    }
    this.bases[0] = batter;
    return scored;
  }

  private speedOf(r: Runner) {
    return this.player(this.offense, r.id).bat.speed;
  }

  private resolveBip(
    bip: BipResult, batter: Player, hitAndRun: boolean, newRunner: (earned?: boolean) => Runner, notes: string[], def: SideState,
  ): { code: PAResultCode; scored: Runner[]; rbi: boolean } {
    const rng = this.rng;
    const [b1, b2, b3] = this.bases;
    const outs = this.outs;
    const dm = this.defenseMap(def);
    const fd = dm[bip.fielder];
    const arm = fd.arm;
    const scored: Runner[] = [];
    const twoOut = outs === 2 ? 1 : 0;
    const of = isOutfield(bip.fielder);

    if (bip.error) {
      // 失策: 打者は出塁、走者は1つ（外野失策なら2つ）進む。以後の得点は自責点にならない
      const adv = of && rng.chance(0.5) ? 2 : 1;
      const runners = [b3, b2, b1];
      const nb: Bases = [null, null, null];
      runners.forEach((r, i) => {
        if (!r) return;
        const from = 2 - i;
        const to = from + adv;
        if (to >= 3) scored.push({ ...r, earned: false });
        else nb[to] = r;
      });
      const bto = adv === 2 && !nb[1] ? 1 : 0;
      nb[bto] = newRunner(false);
      this.bases = nb;
      notes.push('E:' + bip.fielder);
      return { code: 'E', scored, rbi: false };
    }

    if (bip.hit === 3) {
      for (const r of [b3, b2, b1]) if (r) scored.push(r);
      this.bases = [null, null, newRunner()];
      return { code: '3B', scored, rbi: true };
    }
    if (bip.hit === 2) {
      if (b3) scored.push(b3);
      if (b2) scored.push(b2);
      const nb: Bases = [null, newRunner(), null];
      if (b1) {
        const p = sigmoid(logit(0.42) + 0.035 * (this.speedOf(b1) - 50) + 1.0 * twoOut - 0.015 * (arm - 50) + (hitAndRun ? 1.2 : 0));
        if (rng.chance(p)) {
          if (rng.chance(0.04)) {
            this.outs++;
            notes.push('outHome');
          } else scored.push(b1);
        } else nb[2] = b1;
      }
      this.bases = nb;
      return { code: '2B', scored, rbi: true };
    }
    if (bip.hit === 1) {
      const nb: Bases = [newRunner(), null, null];
      if (b3) scored.push(b3);
      if (!of) {
        // 内野安打: 押し出される走者だけ進む
        scored.length = 0;
        if (b1 && b2 && b3) scored.push(b3);
        else if (b3) nb[2] = b3;
        if (b2) {
          if (b1) nb[2] = b2;
          else if (!nb[2] && rng.chance(0.25)) nb[2] = b2;
          else nb[1] = b2;
        }
        if (b1) nb[1] = b1;
        this.bases = nb;
        return { code: '1B', scored, rbi: true };
      }
      let thirdFree = true;
      if (b2) {
        const p = sigmoid(
          logit(0.58) + 0.035 * (this.speedOf(b2) - 50) - 0.02 * (arm - 50) + 1.3 * twoOut +
            (bip.fielder === 'CF' ? 0.25 : bip.fielder === 'LF' ? -0.2 : 0) + (hitAndRun ? 0.3 : 0),
        );
        if (rng.chance(p)) {
          if (rng.chance(0.05)) {
            this.outs++;
            notes.push('outHome');
            this.fieldLine(fd.playerId).assists++;
          } else scored.push(b2);
        } else {
          nb[2] = b2;
          thirdFree = false;
        }
      }
      if (b1) {
        const p = sigmoid(
          logit(0.27) + 0.04 * (this.speedOf(b1) - 50) - 0.02 * (arm - 50) + 0.3 * twoOut +
            (bip.fielder === 'RF' ? 0.6 : bip.fielder === 'LF' ? -0.8 : 0) + (hitAndRun ? 1.4 : 0),
        );
        if (thirdFree && rng.chance(p)) {
          if (rng.chance(0.04) && this.outs < 2) {
            this.outs++;
            notes.push('out3B');
            this.fieldLine(fd.playerId).assists++;
          } else nb[2] = b1;
        } else nb[1] = b1;
      }
      this.bases = nb;
      return { code: '1B', scored, rbi: true };
    }

    // ---- 凡打 ----
    if (bip.type === 'GB') {
      if (b1 && outs < 2) {
        const pDP = hitAndRun
          ? 0.05
          : sigmoid(logit(0.37) - 0.035 * (batter.bat.speed - 50) + 0.012 * (fd.range - 50) +
              (bip.fielder === 'SS' || bip.fielder === '2B' ? 0.25 : bip.fielder === 'P' ? 0.1 : -0.2));
        if (rng.chance(pDP)) {
          this.outs += 2;
          notes.push('DP');
          const nb: Bases = [null, null, null];
          if (this.outs < 3) {
            if (b3) scored.push(b3);
            if (b2) nb[2] = b2;
          }
          this.bases = nb;
          return { code: 'DP', scored, rbi: false };
        }
        // 封殺（野選）か、打者アウトで走者進塁
        if (!hitAndRun && rng.chance(0.55)) {
          this.outs++;
          const nb: Bases = [newRunner(), null, null];
          // 一塁走者が二塁で封殺、他の走者は押し出しで進む
          if (b2) nb[2] = b2;
          if (b3) {
            if (b2) scored.push(b3);
            else nb[2] = nb[2] ?? b3;
            if (!b2 && this.outs < 3 && rng.chance(this.infieldIn ? 0.1 : 0.45)) {
              scored.push(b3);
              nb[2] = null;
            }
          }
          this.bases = nb;
          notes.push('FC');
          return { code: 'FC', scored: this.outs >= 3 ? [] : scored, rbi: this.outs < 3 };
        }
        this.outs++;
        const nb: Bases = [null, b1, null];
        if (b2) nb[2] = b2;
        if (b3) {
          if (b2) scored.push(b3);
          else nb[2] = b3;
        }
        this.bases = nb;
        return { code: 'GO', scored, rbi: true };
      }
      this.outs++;
      if (this.outs >= 3) return { code: 'GO', scored, rbi: false };
      const nb: Bases = [null, null, null];
      const rightSide = bip.fielder === '1B' || bip.fielder === '2B';
      if (b3) {
        const p = this.infieldIn ? 0.12 : rightSide ? 0.7 : 0.45;
        if (rng.chance(p * (0.7 + this.speedOf(b3) / 160))) scored.push(b3);
        else nb[2] = b3;
      }
      if (b2) {
        if (!nb[2] && rng.chance(rightSide ? 0.85 : 0.4)) nb[2] = b2;
        else nb[1] = b2;
      }
      this.bases = nb;
      return { code: 'GO', scored, rbi: true };
    }

    if (bip.type === 'IFFB') {
      this.outs++;
      return { code: 'PO', scored, rbi: false };
    }

    if (bip.type === 'LD') {
      this.outs++;
      // 飛び出してのダブルプレー
      if (this.outs < 3) {
        for (const i of [2, 1, 0] as const) {
          const r = this.bases[i];
          if (r && rng.chance(hitAndRun && i === 0 ? 0.3 : 0.05)) {
            this.bases[i] = null;
            this.outs++;
            notes.push('DP');
            break;
          }
        }
      }
      return { code: 'LO', scored, rbi: false };
    }

    // 外野フライ（内野へのフライ扱いの FB は内野手がいることも）
    this.outs++;
    if (this.outs >= 3 || !of) return { code: 'FO', scored, rbi: false };
    let code: PAResultCode = 'FO';
    if (b3) {
      const deep = bip.distance > 85 ? 0.8 : bip.distance < 72 ? -1.0 : 0;
      const p = sigmoid(logit(0.72) + 0.03 * (this.speedOf(b3) - 50) - 0.025 * (arm - 50) + deep + (bip.fielder === 'CF' ? 0.3 : 0));
      if (rng.chance(p)) {
        if (rng.chance(0.05)) {
          this.outs++;
          this.bases[2] = null;
          notes.push('outHome');
          this.fieldLine(fd.playerId).assists++;
        } else {
          scored.push(b3);
          this.bases[2] = null;
          code = 'SF';
        }
      }
    }
    if (this.outs < 3 && b2 && !this.bases[2] && rng.chance(bip.fielder === 'RF' ? 0.5 : bip.fielder === 'CF' ? 0.3 : 0.12)) {
      this.bases[2] = b2;
      this.bases[1] = null;
    }
    return { code, scored, rbi: true };
  }

  private resolveBunt(batter: Player, squeeze: boolean, newRunner: () => Runner, notes: string[]): { code: PAResultCode; scored: Runner[]; rbi: boolean } {
    const rng = this.rng;
    const [b1, b2, b3] = this.bases;
    const skill = batter.isPitcher ? 30 : batter.bat.contact * 0.6 + batter.bat.speed * 0.2 + 15;
    const succ = sigmoid(logit(squeeze ? 0.62 : 0.76) + 0.025 * (skill - 50));
    const r = rng.next();
    const scored: Runner[] = [];
    if (squeeze) {
      if (r < succ) {
        this.outs++;
        scored.push(b3!);
        this.bases[2] = null;
        if (b2) {
          this.bases[2] = b2;
          this.bases[1] = null;
        }
        if (b1) {
          this.bases[1] = this.bases[1] ?? b1;
          if (this.bases[1] === b1) this.bases[0] = null;
        }
        notes.push('SQZ');
        return { code: 'SQZ', scored, rbi: true };
      }
      // 失敗: 三塁走者アウト
      this.outs++;
      this.bases[2] = null;
      notes.push('SQZfail');
      return { code: 'K', scored, rbi: false };
    }
    const hitP = batter.bat.speed > 70 ? 0.08 : 0.04;
    if (r < succ) {
      this.outs++;
      const nb: Bases = [null, null, null];
      if (b3) nb[2] = b3; // 三塁走者は動かない（スクイズでない）
      if (b2) nb[2] = nb[2] ? nb[2] : b2;
      if (b2 && b3) nb[1] = b2;
      if (b1) nb[1] = nb[1] ?? b1;
      this.bases = nb;
      return { code: 'SH', scored, rbi: false };
    }
    if (r < succ + hitP) {
      const nb: Bases = [newRunner(), null, null];
      if (b1) nb[1] = b1;
      if (b2) nb[2] = b2;
      if (b3 && b2 && b1) scored.push(b3);
      else if (b3) nb[2] = nb[2] ?? b3;
      this.bases = nb;
      return { code: 'SHHIT', scored, rbi: true };
    }
    if (r < succ + hitP + 0.13) {
      // 野選で先の走者がアウト
      this.outs++;
      const lead = b2 && b1 ? 2 : b2 ? 1 : 0;
      const nb: Bases = [newRunner(), null, null];
      if (lead === 2) {
        nb[1] = b1; // 二塁走者が三塁でアウト
      }
      if (b3) nb[2] = b3;
      this.bases = nb;
      notes.push('FC');
      return { code: 'SHFC', scored, rbi: false };
    }
    if (r < succ + hitP + 0.17 && b1 && this.outs === 0) {
      // バント併殺
      this.outs += 2;
      this.bases = [null, null, b3 ?? null];
      notes.push('DP');
      return { code: 'DP', scored, rbi: false };
    }
    // 小フライ or スリーバント失敗
    this.outs++;
    if (rng.chance(0.5)) {
      notes.push('3buntK');
      return { code: 'K', scored, rbi: false };
    }
    return { code: 'PO', scored, rbi: false };
  }

  // ---------- 盗塁・暴投 ----------
  private attemptSteal(base: 2 | 3) {
    this.stealCore(base, false);
  }

  private stealCore(base: 2 | 3, hitRunMiss: boolean) {
    const idx = base - 2;
    const r = this.bases[idx];
    if (!r) return;
    const def = this.defenseSide;
    const catcher = this.player(def, def.defense.C);
    const cArm = catcher.bat.arm * ((catcher.bat.positions.C ?? 20) / 100);
    const p = this.player(def, def.pitcher.id);
    const quick = p.pit ? (p.pit.control - 50) * 0.004 : 0;
    const sp = this.speedOf(r);
    const x = logit(base === 2 ? 0.64 : 0.62) + 0.05 * (sp - 50) - 0.03 * (cArm - 50) - quick - (hitRunMiss ? 0.3 : 0);
    const success = this.rng.chance(sigmoid(x));
    const cl = this.fieldLine(catcher.id);
    cl.sbAgainst++;
    this.bases[idx] = null;
    if (success) {
      this.bases[idx + 1] = r;
      this.batLine(r.id).sb++;
    } else {
      cl.csBy++;
      this.batLine(r.id).cs++;
      this.outs++;
      this.recordDefenseOuts(1);
    }
    if (this.opts.log) this.events.push({ t: 'steal', inning: this.inning, top: this.top, runner: r.id, base, success, outsAfter: this.outs });
  }

  private maybeWildPitch(def: SideState) {
    const p = this.player(def, def.pitcher.id);
    const catcher = this.player(def, def.defense.C);
    const prob = this.tuning.wildPitch * Math.exp(-0.02 * ((p.pit?.control ?? 50) - 50)) * Math.exp(-0.015 * (catcher.bat.catching - 50));
    if (!this.rng.chance(prob)) return;
    const [b1, b2, b3] = this.bases;
    const scored: Runner[] = [];
    if (b3) scored.push(b3);
    this.bases = [null, b1, b2];
    this.pitchLine(p.id).wp++;
    const s: number[] = [];
    const { runs } = this.score(scored, false, s);
    if (this.opts.log) this.events.push({ t: 'wp', inning: this.inning, top: this.top, pitcher: p.id, runs, scorers: s });
    if (this.over) this.finish();
  }

  // ---------- 交代（AI・ユーザー共通） ----------
  changePitcher(side: SideState, newId: number, role: BullpenRole | 'SP') {
    const old = side.pitcher;
    const p = this.player(side, newId);
    const ps = this.newPitcherState(side.team, p, role, this.inning, this.leadFor(side));
    const lead = this.leadFor(side);
    const onBase = this.top === side.isHome ? this.bases.filter(Boolean).length : 0;
    ps.saveSituation = lead > 0 && (lead <= 3 || lead <= onBase + 2);
    ps.tyingClose = lead > 0 && lead <= onBase + 2;
    old.exitLead = lead;
    side.pitcher = ps;
    side.pitchers.push(ps);
    side.used.add(newId);
    side.defense.P = newId;
    const pl = this.pitchLine(newId);
    pl.g = 1;
    this.batLine(newId).g = 1;
    // DHなしなら打順の投手の枠を入れ替え
    if (!this.opts.dh) {
      const slot = side.order.find((s) => s.pos === 'P');
      if (slot) slot.playerId = newId;
    }
    side.bullpen = side.bullpen.filter((b) => b.playerId !== newId);
    side.needPitcher = false;
    if (this.opts.log) this.events.push({ t: 'pitchChange', inning: this.inning, top: this.top, team: side.team.teamId, out: old.id, in: newId, role });
  }

  /** 打順 slotIndex の選手を交代（代打・代走・守備固め） */
  substitute(side: SideState, slotIndex: number, newId: number, kind: 'PH' | 'PR' | 'DEF', pos?: Pos) {
    const slot = side.order[slotIndex];
    const outId = slot.playerId;
    if (kind === 'PR') {
      for (let i = 0; i < 3; i++) {
        const r = this.bases[i];
        if (r && r.id === outId) this.bases[i] = { ...r, id: newId };
      }
    }
    slot.playerId = newId;
    if (pos) slot.pos = pos;
    if (slot.pos !== 'DH') {
      if (slot.pos === 'P') {
        // 投手に代打 → 次の守備で投手交代が必要
        side.needPitcher = true;
      } else side.defense[slot.pos as FieldPos] = newId;
    }
    side.bench = side.bench.filter((b) => b !== newId);
    side.used.add(newId);
    this.batLine(newId).g = 1;
    side.appearances.push({ pid: newId, slot: slotIndex, pos: slot.pos, sub: true });
    if (this.opts.log) this.events.push({ t: 'sub', inning: this.inning, top: this.top, team: side.team.teamId, kind, out: outId, in: newId, pos: slot.pos });
  }

  // ---------- 結果 ----------
  result(): GameResult {
    const tie = this.home.runs === this.away.runs;
    let win: number | null = null;
    let lose: number | null = null;
    let save: number | null = null;
    if (!tie) {
      const winSide = this.home.runs > this.away.runs ? this.home : this.away;
      win = this.lead.winP;
      lose = this.lead.loseP;
      const starter = winSide.pitchers[0];
      // 先発は5回以上投げないと勝利投手にならない
      if (win === starter.id && starter.outs < 15 && winSide.pitchers.length > 1) {
        const rel = winSide.pitchers.slice(1).sort((a, b) => b.outs - a.outs)[0];
        win = rel.id;
      }
      const last = winSide.pitchers[winSide.pitchers.length - 1];
      if (last.id !== win && last.id !== starter.id && last.outs >= 1) {
        if (last.outs >= 9 || (last.saveSituation && (last.entryLead <= 3 ? last.outs >= 3 || last.tyingClose : true) && last.entryLead > 0)) save = last.id;
      }
      // ホールド: 中継ぎがセーブ機会（または同点）で登板し、リードを保って（同点のまま）降板
      for (const side of [this.home, this.away]) {
        for (const ps of side.pitchers.slice(1)) {
          if (ps === side.pitchers[side.pitchers.length - 1]) continue;
          if (ps.id === win || ps.id === lose || ps.outs < 1 || ps.exitLead === null) continue;
          if ((ps.saveSituation && ps.exitLead > 0) || (ps.entryLead === 0 && ps.exitLead === 0)) this.pitchLine(ps.id).hld++;
        }
      }
      if (win !== null) this.pitchLine(win).w++;
      if (lose !== null) this.pitchLine(lose).l++;
      if (save !== null) this.pitchLine(save).sv++;
    }
    for (const side of [this.home, this.away]) {
      if (side.pitchers.length === 1) {
        const pl = this.pitchLine(side.pitchers[0].id);
        pl.cg++;
        const opp = side === this.home ? this.away : this.home;
        if (opp.runs === 0) pl.sho++;
      }
    }
    const pitchCounts = new Map<number, number>();
    for (const side of [this.home, this.away]) for (const ps of side.pitchers) pitchCounts.set(ps.id, ps.pitches);
    const appeared = new Map<number, number[]>();
    appeared.set(this.home.team.teamId, [...this.home.used]);
    appeared.set(this.away.team.teamId, [...this.away.used]);
    return {
      awayRuns: this.away.runs, homeRuns: this.home.runs, innings: this.inning, tie,
      lineAway: this.away.lineScore, lineHome: this.home.lineScore,
      hitsAway: this.away.hits, hitsHome: this.home.hits, errorsAway: this.away.errors, errorsHome: this.home.errors,
      bat: this.bat, pitch: this.pitch, field: this.field, pitchCounts,
      winningPitcher: win, losingPitcher: lose, savePitcher: save, events: this.events, appeared,
      startersAway: this.away.pitchers[0].id, startersHome: this.home.pitchers[0].id, walkoff: this.walkoff,
      appearancesAway: this.away.appearances, appearancesHome: this.home.appearances,
    };
  }
}

export function simulateGame(away: TeamGameInput, home: TeamGameInput, park: Park, opts: GameOptions, observer?: PAObserver): GameResult {
  const g = new GameSim(away, home, park, opts);
  g.observer = observer;
  return g.runToEnd();
}
