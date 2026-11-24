import { Game, canDeclareWin } from "../../core/game";
import { exportKif, importKif, moveToDisplay } from "../../core/kif";
import { Position } from "../../core/position";
import { BLACK, Color, Move, WHITE } from "../../core/types";
import { parseUsiPosition, toUsiPosition } from "../../core/usi";
import { Clock, TIME_PRESETS, fmtClock } from "../../game/clock";
import { settings } from "../../settings";
import { BoardView } from "../board";
import { download, el, modal, pickFile, toast } from "../dom";
import { playBeep, playPieceSound } from "../sound";

const COLOR_NAME = ["先手", "後手"];

export interface PlayOptions {
  startSfen?: string;
  moves?: Move[];
  /** 人が操作する側（人どうしなら両方） */
  humans: Color[];
  timePreset: string;
  names?: [string, string];
}

export function mountPlay(root: HTMLElement): () => void {
  let cleanup: (() => void) | null = null;
  const showSetup = () => {
    cleanup?.();
    cleanup = null;
    root.replaceChildren(setupView((opts) => { cleanup = startGame(root, opts, showSetup); }));
  };
  showSetup();
  return () => cleanup?.();
}

function setupView(onStart: (o: PlayOptions) => void): HTMLElement {
  const s = settings.get();
  const timeSel = el("select", { id: "time" }, ...TIME_PRESETS.map((p) => {
    const o = el("option", { value: p.id }, p.label);
    if (p.id === s.timePreset) o.selected = true;
    return o;
  }));
  const startBtn = el("button", { class: "btn primary big" }, "対局開始");
  startBtn.onclick = () => {
    settings.set({ timePreset: timeSel.value });
    onStart({ humans: [BLACK, WHITE], timePreset: timeSel.value, names: ["先手", "後手"] });
  };
  const importBtn = el("button", { class: "btn" }, "棋譜・局面を読み込んで続きから指す");
  importBtn.onclick = async () => {
    const d = await importDialog();
    if (!d) return;
    onStart({ humans: [BLACK, WHITE], timePreset: "none", startSfen: d.sfen, moves: d.moves, names: ["先手", "後手"] });
  };
  return el("div", { class: "screen setup" },
    el("h2", {}, "対局（人どうし）"),
    el("p", { class: "note" }, "AIとの対局はフェーズ2で追加します。今は1台の端末で交互に指せます。"),
    el("label", { class: "field" }, el("span", {}, "持ち時間"), timeSel),
    startBtn,
    importBtn,
  );
}

/** KIF / SFEN / USI position を読み込むダイアログ */
export async function importDialog(): Promise<{ sfen: string; moves: Move[] } | null> {
  const ta = el("textarea", { rows: "8", placeholder: "KIF形式の棋譜、SFEN、または position startpos moves ... を貼り付け" });
  const fileBtn = el("button", { class: "btn" }, "ファイルを選ぶ");
  fileBtn.onclick = async () => { const t = await pickFile(".kif,.kifu,.txt,.sfen"); if (t) ta.value = t; };
  const i = await modal("棋譜・局面の読み込み", [ta, fileBtn], [{ label: "キャンセル" }, { label: "読み込む", primary: true }]);
  if (i !== 1) return null;
  try {
    return parseRecordText(ta.value);
  } catch (e) {
    toast(`読み込めませんでした: ${(e as Error).message}`, 4000);
    return null;
  }
}

export function parseRecordText(text: string): { sfen: string; moves: Move[] } {
  const t = text.trim();
  if (!t) throw new Error("空です");
  if (/^(position|startpos|sfen)\b/.test(t) || /^[1-9lnsgkrbpLNSGKRBP+/]+ [bw] /.test(t)) {
    return parseUsiPosition(t.startsWith("position") || t.startsWith("startpos") || t.startsWith("sfen") ? t : "sfen " + t);
  }
  const d = importKif(t);
  return { sfen: d.startSfen, moves: d.moves };
}

function startGame(root: HTMLElement, opts: PlayOptions, onExit: () => void): () => void {
  const game = new Game(opts.startSfen);
  for (const m of opts.moves ?? []) game.play(m);
  const preset = TIME_PRESETS.find((p) => p.id === opts.timePreset)?.tc ?? null;
  const clock = preset ? new Clock(preset) : null;
  const times: number[] = (opts.moves ?? []).map(() => 0);
  const names = opts.names ?? ["先手", "後手"];
  const startedAt = new Date();
  let flipped = opts.humans.length === 1 && opts.humans[0] === WHITE;

  const board = new BoardView();
  const clockEls: [HTMLElement, HTMLElement] = [el("div", { class: "clock" }), el("div", { class: "clock" })];
  const nameEls: [HTMLElement, HTMLElement] = [el("div", { class: "pname" }, names[0]), el("div", { class: "pname" }, names[1])];
  const status = el("div", { class: "status" });
  const moveList = el("div", { class: "movelist" });
  const declareBtn = el("button", { class: "btn small warn hidden" }, "入玉宣言");
  board.info = [
    el("div", { class: "pinfo" }, nameEls[0], clockEls[0]),
    el("div", { class: "pinfo" }, nameEls[1], clockEls[1]),
  ];

  const resignBtn = el("button", { class: "btn" }, "投了");
  const flipBtn = el("button", { class: "btn" }, "反転");
  const recordBtn = el("button", { class: "btn" }, "棋譜");
  const exitBtn = el("button", { class: "btn" }, "終了");
  const actions = el("div", { class: "actions" }, resignBtn, flipBtn, recordBtn, exitBtn);

  const statusRow = el("div", { class: "status-row" }, status, declareBtn);
  const screen = el("div", { class: "screen play" }, board.root, statusRow, moveList, actions);
  document.body.classList.add("in-game");
  // 手番表示・時計は盤の上下に置く（自分側が下）
  root.replaceChildren(screen);

  const humanTurn = () => !game.result && opts.humans.includes(game.turn);

  function render() {
    nameEls[0].classList.toggle("active", !game.result && game.turn === BLACK);
    nameEls[1].classList.toggle("active", !game.result && game.turn === WHITE);
    board.set({ pos: game.pos, lastMove: game.pos.lastMove(), flipped, movable: humanTurn() ? game.turn : null });
    declareBtn.classList.toggle("hidden", !(humanTurn() && canDeclareWin(game.pos)));
    if (game.result) {
      const r = game.result;
      status.textContent = r.winner === null ? `${r.reason}で引き分け` : `${r.reason} — ${COLOR_NAME[r.winner]}（${names[r.winner]}）の勝ち`;
      status.className = "status end";
    } else {
      status.textContent = `${game.ply + 1}手目 ${COLOR_NAME[game.turn]}の番` + (game.pos.inCheck() ? " — 王手！" : "");
      status.className = "status" + (game.pos.inCheck() ? " check" : "");
    }
    renderMoveList();
    renderClocks();
  }

  function renderMoveList() {
    const p = Position.fromSfen(game.startSfen);
    let prevTo: number | null = null;
    const items = game.moves.map((m, i) => {
      const s = moveToDisplay(p, m, prevTo);
      prevTo = m.to;
      p.doMove(m);
      return el("span", { class: "mv" }, `${i + 1} ${s}`);
    });
    moveList.replaceChildren(...items);
    moveList.scrollLeft = moveList.scrollWidth;
  }

  let lastBeep = -1;
  function renderClocks() {
    for (const c of [BLACK, WHITE] as Color[]) {
      if (!clock) { clockEls[c].textContent = ""; continue; }
      const v = clock.view(c, performance.now());
      const inByo = v.main <= 0 && clock.tc.byoyomi > 0;
      clockEls[c].textContent = inByo ? `秒読み ${Math.ceil(v.byo / 1000)}` : fmtClock(v.main);
      clockEls[c].classList.toggle("low", inByo || v.main < 60_000);
      if (clock.running === c && inByo) {
        const sec = Math.ceil(v.byo / 1000);
        if (sec <= 10 && sec !== lastBeep) { lastBeep = sec; playBeep(sec <= 3 ? 1200 : 880); }
      }
      if (v.flagged && !game.result) {
        game.timeout(c);
        clock.stop(performance.now());
        onEnd();
      }
    }
  }

  function onEnd() {
    clock?.stop(performance.now());
    render();
    const r = game.result!;
    const msg = r.winner === null ? `${r.reason}で引き分けです。` : `${r.reason}で${COLOR_NAME[r.winner]}（${names[r.winner]}）の勝ちです。`;
    void modal("対局終了", el("p", {}, msg), [{ label: "閉じる", primary: true }]);
  }

  function doMove(m: Move) {
    const captured = game.pos.board[m.to] !== 0;
    if (!game.play(m)) return;
    const used = clock ? clock.press(performance.now()) : 0;
    times.push(used);
    lastBeep = -1;
    playPieceSound(captured);
    if (game.result) onEnd();
    else render();
  }
  board.onMove = doMove;

  declareBtn.onclick = async () => {
    const i = await modal("入玉宣言", el("p", {}, "27点法で宣言します。条件を満たしていれば勝ちになります。"), [{ label: "やめる" }, { label: "宣言する", primary: true }]);
    if (i === 1) { game.declare(); onEnd(); }
  };
  resignBtn.onclick = async () => {
    if (game.result) return;
    const i = await modal("投了", el("p", {}, `${COLOR_NAME[game.turn]}が投了しますか？`), [{ label: "やめる" }, { label: "投了する", primary: true }]);
    if (i === 1) { game.resign(); onEnd(); }
  };
  flipBtn.onclick = () => { flipped = !flipped; render(); };
  recordBtn.onclick = () => recordMenu();
  exitBtn.onclick = async () => {
    if (!game.result && game.ply > 0) {
      const i = await modal("対局を終了", el("p", {}, "対局を中断して終了しますか？"), [{ label: "続ける" }, { label: "終了する", primary: true }]);
      if (i !== 1) return;
    }
    onExit();
  };

  async function recordMenu() {
    const kifData = () => ({
      startSfen: game.startSfen, moves: game.moves, times, black: names[0], white: names[1], startedAt,
      endReason: game.result?.reason === "連続王手の千日手" ? "反則負け" : game.result?.reason ?? "中断",
      winner: game.result ? game.result.winner : undefined,
    });
    const usi = toUsiPosition(game.startSfen, game.moves);
    const sfenNow = game.pos.sfen();
    const box = el("textarea", { rows: "4", readonly: true }, usi);
    const i = await modal("棋譜", [el("p", {}, "現在の局面（SFEN）:"), el("code", { class: "sfen" }, sfenNow), el("p", {}, "手順（USI position）:"), box], [
      { label: "閉じる" }, { label: "SFENをコピー" }, { label: "KIFを保存", primary: true },
    ]);
    if (i === 1) {
      try { await navigator.clipboard.writeText(usi); toast("コピーしました"); } catch { toast("コピーできませんでした"); }
    } else if (i === 2) {
      const d = startedAt;
      const fn = `shogi_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}.kif`;
      download(fn, exportKif(kifData()));
    }
  }

  if (clock && !game.result) clock.start(game.turn, performance.now());
  const timer = clock ? window.setInterval(renderClocks, 200) : 0;
  render();
  return () => { clearInterval(timer); document.body.classList.remove("in-game"); };
}
