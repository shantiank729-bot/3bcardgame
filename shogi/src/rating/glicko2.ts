// Glicko-2（Mark Glickman, "Example of the Glicko-2 system"）
// レーティングの目盛りはアプリ独自（15級=0, 初段=1500）だが、計算は差と RD にしか依存しない。

export interface Glicko { rating: number; rd: number; vol: number }
export interface GlickoResult { opponent: { rating: number; rd: number }; score: number }

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/** 1レーティング期間（ここでは1局）の結果で更新する */
export function glicko2Update(p: Glicko, results: GlickoResult[], tau = TAU): Glicko {
  const mu = (p.rating - 1500) / SCALE;
  const phi = p.rd / SCALE;
  if (!results.length) {
    const phiStar = Math.sqrt(phi * phi + p.vol * p.vol);
    return { rating: p.rating, rd: phiStar * SCALE, vol: p.vol };
  }
  let vInv = 0, deltaSum = 0;
  for (const r of results) {
    const muj = (r.opponent.rating - 1500) / SCALE;
    const phij = r.opponent.rd / SCALE;
    const e = E(mu, muj, phij);
    vInv += g(phij) ** 2 * e * (1 - e);
    deltaSum += g(phij) * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  // 変動率 σ の更新（Illinois 法）
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (tau * tau);
  };
  let A = a, B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: phiNew * SCALE, vol };
}

/** 期待勝率（Glicko の g(RD) を含む） */
export function expectedScore(p: { rating: number; rd: number }, o: { rating: number; rd: number }): number {
  return E((p.rating - 1500) / SCALE, (o.rating - 1500) / SCALE, Math.sqrt(p.rd ** 2 + o.rd ** 2) / SCALE);
}
