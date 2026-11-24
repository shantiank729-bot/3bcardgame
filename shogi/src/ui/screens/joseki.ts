// 定跡練習: AI が決まった手順で指し、あなたは正しい応じ方を練習する
import { moveToDisplay } from "../../core/kif";
import { Position } from "../../core/position";
import { Color, Move } from "../../core/types";
import { moveToUsi, usiToMove } from "../../core/usi";
import { get, put } from "../../db/db";
import { JosekiLine, LINES } from "../../joseki/lines";
import { BoardView } from "../board";
import { el } from "../dom";
import { playBeep, playPieceSound } from "../sound";
import { setPendingStart } from "./play";

interface JosekiProgress { key: "joseki"; lines: Record<string, { cleared: number; perfect: number; tries: number }> }
const loadProgress = async () => (await get<JosekiProgress>("kv", "joseki")) ?? { key: "joseki" as const, lines: {} };

export function mountJoseki(root: HTMLElement) {
  let disposed = false;
  const screen = el("div", { class: "screen joseki" });
  root.replaceChildren(screen);

  async function showList() {
    document.body.classList.remove("in-game");
    const prog = await loadProgress();
    if (disposed) return;
    const items = LINES.map((l) => {
      const p = prog.lines[l.id];
      const b = el("button", { class: "joseki-item" },
        el("div", { class: "joseki-name" }, l.name, el("span", { class: "badge" }, l.level)),
        el("div", { class: "note" }, l.summary),
        el("div", { class: "note" }, p ? `クリア ${p.cleared}回（ノーミス ${p.perfect}回）` : "未挑戦"));
      b.onclick = () => practice(l);
      return b;
    });
    screen.replaceChildren(el("h2", {}, "定跡練習"),
      el("p", { class: "note" }, "相手（AI）は決まった手順で指してきます。あなたは正しい手を指してください。手順から外れたら、本来の手と理由を表示します。"),
      ...items);
  }

  function practice(line: JosekiLine) {
    const you = line.you as Color;
    const pos = Position.startpos();
    const board = new BoardView();
    const status = el("div", { class: "status" });
    const explain = el("div", { class: "joseki-explain" });
    const actions = el("div", { class: "actions" });
    let step = 0;
    let mistakes = 0;
    let last: Move | null = null;
    const back = el("button", { class: "btn" }, "一覧へ");
    back.onclick = () => void showList();
    const restart = el("button", { class: "btn" }, "最初から");
    restart.onclick = () => practice(line);
    const shown = () => {
      board.set({ pos, lastMove: last, flipped: you === 1, movable: step < line.steps.length && step % 2 === you ? you : null });
    };
    const disp = (u: string) => { const m = usiToMove(u); return moveToDisplay(pos, m, last?.to ?? null); };
    const advance = (m: Move) => {
      const cap = pos.board[m.to] !== 0;
      pos.doMove(m);
      last = m;
      step++;
      playPieceSound(cap);
    };
    const aiTurn = () => {
      if (disposed) return;
      if (step >= line.steps.length) return finish();
      if (step % 2 === you) {
        status.textContent = `${step + 1}手目 — あなたの番です`;
        shown();
        return;
      }
      status.textContent = "相手が指しています…";
      shown();
      setTimeout(() => {
        if (disposed) return;
        advance(usiToMove(line.steps[step].move));
        if (step >= line.steps.length) return finish();
        status.textContent = `${step + 1}手目 — あなたの番です`;
        shown();
      }, 500);
    };
    const finish = async () => {
      shown();
      status.textContent = mistakes ? `手順の最後まで来ました（間違い ${mistakes}回）` : "◎ ノーミスで最後まで指せました！";
      status.className = "status end";
      const prog = await loadProgress();
      const p = prog.lines[line.id] ?? { cleared: 0, perfect: 0, tries: 0 };
      p.cleared++; p.tries++; if (!mistakes) p.perfect++;
      prog.lines[line.id] = p;
      await put("kv", prog);
      const cont = el("button", { class: "btn primary" }, "この局面から練習対局");
      cont.onclick = () => {
        setPendingStart({ moves: line.steps.map((s) => usiToMove(s.move)), humanColor: you });
        location.hash = "#/play/continue";
      };
      actions.replaceChildren(cont, restart, back);
    };
    board.onMove = (m) => {
      const want = line.steps[step];
      if (moveToUsi(m) === want.move) {
        const txt = disp(want.move);
        advance(m);
        explain.replaceChildren(el("div", { class: "ok" }, `○ ${txt}`), el("div", {}, want.why ?? ""));
        playBeep(880, 0.06);
        aiTurn();
        return;
      }
      // 外れた手: 盤には反映せず、本来の手と理由を見せる
      mistakes++;
      playBeep(220, 0.2);
      const wrongTxt = moveToDisplay(pos, m, last?.to ?? null);
      const rightTxt = disp(want.move);
      const showRight = el("button", { class: "btn small" }, "本来の手を指す");
      showRight.onclick = () => { board.onMove(usiToMove(want.move)); };
      explain.replaceChildren(
        el("div", { class: "ng" }, `✕ ${wrongTxt} は手順から外れています`),
        el("div", {}, `本来の手: ${rightTxt}`),
        el("div", { class: "note" }, want.why ?? ""),
        showRight,
      );
      shown();
    };
    actions.replaceChildren(restart, back);
    explain.replaceChildren(el("div", { class: "note" }, line.summary));
    status.className = "status";
    document.body.classList.add("in-game");
    screen.replaceChildren(el("div", { class: "screen play" }, el("div", { class: "joseki-title" }, line.name), board.root, status, explain, actions));
    aiTurn();
  }

  void showList();
  return () => { disposed = true; document.body.classList.remove("in-game"); };
}
