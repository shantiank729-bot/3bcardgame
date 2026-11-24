// 毎日の詰将棋
import { moveToDisplay } from "../../core/kif";
import { Position } from "../../core/position";
import { BLACK, Move } from "../../core/types";
import { moveToUsi, usiToMove } from "../../core/usi";
import { TsumeProblem } from "../../tsume/generate";
import { DAILY_COUNT, TsumeState, dateStr, pickDaily, recordAttempt, tsumeStats } from "../../tsume/progress";
import { loadPool, loadState, refillInBackground, saveState } from "../../tsume/store";
import { BoardView } from "../board";
import { el } from "../dom";
import { playBeep, playPieceSound } from "../sound";

export function mountTsume(root: HTMLElement) {
  let disposed = false;
  const screen = el("div", { class: "screen tsume" }, el("p", { class: "note" }, "読み込み中…"));
  root.replaceChildren(screen);

  async function showList() {
    document.body.classList.remove("in-game");
    let [st, pool] = await Promise.all([loadState(), loadPool()]);
    const today = dateStr(new Date());
    const before = st.daily;
    st = pickDaily(st, pool, today, Math.random);
    if (st.daily !== before) await saveState(st);
    if (disposed) return;
    void refillInBackground(st.level);
    const byId = new Map(pool.map((p) => [p.id, p]));
    const s = tsumeStats(st, today);
    const tile = (label: string, value: string) => el("div", { class: "tile" }, el("div", { class: "tile-value" }, value), el("div", { class: "tile-label" }, label));
    const todayAttempts = st.attempts.filter((a) => a.date === today);
    const items = (st.daily?.pids ?? []).map((pid, i) => {
      const p = byId.get(pid);
      if (!p) return null;
      const tries = todayAttempts.filter((a) => a.pid === pid);
      const state = tries.length ? (tries[0].correct ? "✓ 正解" : "✕ 不正解") : "未挑戦";
      const isReview = st.review.some((r) => r.pid === pid) || tries.some((a) => a.review);
      const b = el("button", { class: "tsume-item" + (tries.length ? " done" : "") },
        el("span", { class: "tsume-no" }, `第${i + 1}問`),
        el("span", {}, `${p.length}手詰`),
        isReview ? el("span", { class: "badge" }, "復習") : null,
        p.source === "game" ? el("span", { class: "badge" }, "あなたの対局から") : null,
        el("span", { class: "tsume-state" }, state));
      b.onclick = () => void solve(p, st);
      return b;
    }).filter((x) => x !== null) as HTMLElement[];
    const allDone = (st.daily?.pids ?? []).every((pid) => todayAttempts.some((a) => a.pid === pid));
    const more = el("button", { class: "btn" }, "もっと解く");
    more.onclick = () => {
      const seen = new Set(st.attempts.map((a) => a.pid));
      const cands = pool.filter((p) => p.length === st.level && !seen.has(p.id) && !st.daily?.pids.includes(p.id));
      const p = cands[Math.floor(Math.random() * cands.length)] ?? pool.filter((p) => p.length === st.level)[0];
      if (p) void solve(p, st);
    };
    const lengths = [1, 3, 5, 7].map((len) => {
      const b = s.byLength[len];
      return el("div", { class: "len-row" + (len === st.level ? " current" : "") },
        el("span", {}, `${len}手詰`), el("span", { class: "note" }, b ? `${b.correct}/${b.tried}問 正解` : "—"));
    });
    screen.replaceChildren(
      el("h2", {}, "毎日の詰将棋"),
      el("div", { class: "tiles" },
        tile("解けた問題", `${s.solved}`), tile("連続日数", `${s.streakDays}日`), tile("今の難しさ", `${st.level}手詰`)),
      el("div", { class: "card" }, el("h3", {}, `今日の${DAILY_COUNT}問`), ...items,
        allDone ? el("p", { class: "note" }, "今日の詰将棋はおしまいです。おつかれさまでした！") : null, more),
      el("div", { class: "card" }, el("h3", {}, "難しさごとの成績"), ...lengths,
        el("p", { class: "note" }, "最近の正解率が8割を超えると手数が増え、3割を切ると減ります。間違えた問題は翌日にもう一度出ます。")),
      el("p", { class: "note" }, "問題はすべて自動で作り、詰み探索で「ちょうどその手数で詰み・正解が1つ」を確かめています。玉方の持ち駒はなしです（あなたの対局から作った問題を除く）。"),
    );
  }

  async function solve(p: TsumeProblem, st0: TsumeState) {
    const pos = Position.fromSfen(p.sfen);
    const board = new BoardView();
    const status = el("div", { class: "status" }, `${p.length}手詰 — あなた（先手）の番です。王手の連続で詰ませてください。`);
    const actions = el("div", { class: "actions" });
    const movesEl = el("div", { class: "movelist" });
    let step = 0;
    let recorded = false;
    let lastMove: Move | null = null;
    const shown: string[] = [];
    const render = (movable: boolean) => {
      board.set({ pos, lastMove, flipped: false, movable: movable ? BLACK : null });
      movesEl.replaceChildren(...shown.map((t, i) => el("span", { class: "mv" }, `${i + 1} ${t}`)));
    };
    const record = async (correct: boolean) => {
      if (recorded) return;
      recorded = true;
      const st = recordAttempt(await loadState(), p, correct, dateStr(new Date()));
      await saveState(st);
      void st0;
    };
    const play = (m: Move) => {
      shown.push(moveToDisplay(pos, m, lastMove?.to ?? null));
      const cap = pos.board[m.to] !== 0;
      pos.doMove(m);
      lastMove = m;
      playPieceSound(cap);
    };
    const retry = el("button", { class: "btn" }, "もう一度");
    const answer = el("button", { class: "btn" }, "解答を見る");
    const back = el("button", { class: "btn" }, "一覧に戻る");
    back.onclick = () => void showList();
    retry.onclick = () => void solve(p, st0);
    answer.onclick = () => {
      // 初形から正解手順を1手ずつ再生
      const q = Position.fromSfen(p.sfen);
      let i = 0;
      const texts: string[] = [];
      let prev: number | null = null;
      for (const u of p.solution) { const m = usiToMove(u); texts.push(moveToDisplay(q, m, prev)); prev = m.to; q.doMove(m); }
      const r = Position.fromSfen(p.sfen);
      let lm: Move | null = null;
      const show = () => {
        board.set({ pos: r, lastMove: lm, flipped: false, movable: null });
        status.textContent = `正解手順（${i}/${p.solution.length}）`;
        movesEl.replaceChildren(...texts.slice(0, i).map((t, k) => el("span", { class: "mv" }, `${k + 1} ${t}`)));
      };
      const prevBtn = el("button", { class: "btn" }, "◀");
      const nextBtn = el("button", { class: "btn" }, "▶");
      nextBtn.onclick = () => { if (i < p.solution.length) { lm = usiToMove(p.solution[i]); r.doMove(lm); i++; show(); } };
      prevBtn.onclick = () => { if (i > 0) { r.undoMove(); i--; lm = r.lastMove(); show(); } };
      actions.replaceChildren(prevBtn, nextBtn, retry, back);
      void record(false);
      show();
    };
    board.onMove = async (m) => {
      const expected = p.solution[step];
      if (moveToUsi(m) !== expected) {
        play(m);
        render(false);
        const check = pos.inCheck();
        status.textContent = check ? "✕ その手では詰みません。" : "✕ 王手ではありません（詰将棋では毎回王手をかけます）。";
        status.className = "status check";
        playBeep(220, 0.2);
        await record(false);
        actions.replaceChildren(retry, answer, back);
        return;
      }
      play(m);
      step++;
      if (step >= p.solution.length) {
        render(false);
        status.textContent = "◎ 正解！ 詰みました。";
        status.className = "status end";
        [784, 1047].forEach((f, k) => setTimeout(() => playBeep(f, 0.15), k * 120));
        await record(true);
        actions.replaceChildren(back);
        return;
      }
      render(false);
      status.textContent = "相手が応じています…";
      setTimeout(() => {
        if (disposed) return;
        play(usiToMove(p.solution[step]));
        step++;
        status.textContent = `残り ${p.length - step}手 — あなたの番です。`;
        render(true);
      }, 450);
    };
    actions.replaceChildren(answer, back);
    document.body.classList.add("in-game");
    screen.replaceChildren(el("div", { class: "screen play" }, board.root, status, movesEl, actions));
    render(true);
  }

  void showList();
  return () => { disposed = true; document.body.classList.remove("in-game"); };
}

/** ホーム用: 今日の進み具合 */
export async function todayTsumeSummary(): Promise<{ done: number; total: number; level: number; streak: number }> {
  const [st0, pool] = await Promise.all([loadState(), loadPool()]);
  const today = dateStr(new Date());
  const st = pickDaily(st0, pool, today, Math.random);
  if (st !== st0) await saveState(st);
  const pids = st.daily?.pids ?? [];
  const done = pids.filter((pid) => st.attempts.some((a) => a.pid === pid && a.date === today)).length;
  return { done, total: pids.length, level: st.level, streak: tsumeStats(st, today).streakDays };
}
