import { Game, canDeclareWin } from "../../core/game";
import { exportKif, importKif, moveToDisplay } from "../../core/kif";
import { Position } from "../../core/position";
import { BLACK, Color, Move, WHITE } from "../../core/types";
import { moveToUsi, parseUsiPosition, toUsiPosition, usiToMove } from "../../core/usi";
import { Clock, TIME_PRESETS, fmtClock } from "../../game/clock";
import { settings } from "../../settings";
import { BoardView } from "../board";
import { download, el, modal, pickFile, toast } from "../dom";
import { playEngine } from "../../engine/client";
import { MAX_LEVEL, chooseMove, levelParams, mulberry32, shouldResign } from "../../engine/levels";
import { playBeep, playPieceSound } from "../sound";
import { GameMode, applyRatedGame, humanScore, isPlacement, loadProfile, saveGame, saveProfile } from "../../db/records";
import { PLACEMENT_GAMES, chooseLevel, levelRating, rankOf, rankValue } from "../../rating/rank";
import { celebrate } from "../celebrate";
import { analysis, analysisEngine } from "../../analysis/manager";

const COLOR_NAME = ["先手", "後手"];

export interface PlayOptions {
  startSfen?: string;
  moves?: Move[];
  /** 人が操作する側（人どうしなら両方） */
  humans: Color[];
  timePreset: string;
  names?: [string, string];
  /** AI の設定（人どうしなら省略） */
  ai?: { color: Color; level: number };
  mode: GameMode;
}

/** 定跡練習などから「この局面から練習対局」を始めるための受け渡し */
let pending: { moves: Move[]; humanColor: Color } | null = null;
export function setPendingStart(p: { moves: Move[]; humanColor: Color }) { pending = p; }

export function mountPlay(root: HTMLElement, arg?: string): () => void {
  let cleanup: (() => void) | null = null;
  const begin = (opts: PlayOptions) => { cleanup = startGame(root, opts, showSetup); };
  function showSetup() {
    cleanup?.();
    cleanup = null;
    root.replaceChildren(setupView(begin));
  }
  // ホームの「すぐ対局」: 前回の設定でレーティング対局をすぐ始める
  if (arg === "quick") void ratedOptions().then(begin);
  else if (arg === "continue" && pending) {
    const p = pending;
    pending = null;
    void loadProfile().then((prof) => {
      const level = chooseLevel(prof.glicko);
      const names: [string, string] = p.humanColor === BLACK ? ["あなた", `AI Lv${level}`] : [`AI Lv${level}`, "あなた"];
      begin({ mode: "practice", humans: [p.humanColor], timePreset: "none", names, ai: { color: (p.humanColor ^ 1) as Color, level }, moves: p.moves });
    });
  } else showSetup();
  return () => cleanup?.();
}

/** レーティング対局の設定（レベルは自動） */
async function ratedOptions(): Promise<PlayOptions> {
  const s = settings.get();
  const profile = await loadProfile();
  const level = chooseLevel(profile.glicko);
  const human = (s.side === 2 ? (Math.random() < 0.5 ? 0 : 1) : s.side) as Color;
  const names: [string, string] = human === BLACK ? ["あなた", `AI Lv${level}`] : [`AI Lv${level}`, "あなた"];
  return { mode: "rated", humans: [human], timePreset: s.timePreset, names, ai: { color: (human ^ 1) as Color, level } };
}

function setupView(onStart: (o: PlayOptions) => void): HTMLElement {
  const s = settings.get();
  const timeSel = el("select", { id: "time" }, ...TIME_PRESETS.map((p) => el("option", { value: p.id }, p.label)));
  timeSel.value = s.timePreset;
  const modeSel = el("select", { id: "mode" },
    el("option", { value: "rated" }, "レーティング対局（AIのレベルは自動）"),
    el("option", { value: "practice" }, "練習対局（レベルを選ぶ・レーティングに反映しない）"),
    el("option", { value: "human" }, "人どうし（1台で交互に指す）"));
  modeSel.value = s.mode;
  const levelSel = el("select", { id: "level" }, ...Array.from({ length: MAX_LEVEL }, (_, i) =>
    el("option", { value: String(i + 1) }, `レベル ${i + 1}（目安 ${rankOf(levelRating(i + 1)).label}）`)));
  levelSel.value = String(s.aiLevel);
  const sideSel = el("select", { id: "side" }, el("option", { value: "0" }, "先手（自分が先に指す）"), el("option", { value: "1" }, "後手"), el("option", { value: "2" }, "ランダム"));
  sideSel.value = String(s.side);
  const levelField = el("label", { class: "field" }, el("span", {}, "AIのレベル"), levelSel);
  const sideField = el("label", { class: "field" }, el("span", {}, "手番"), sideSel);
  const ratedInfo = el("div", { class: "card" }, "読み込み中…");
  const importBtn = el("button", { class: "btn" }, "棋譜・局面を読み込んで続きから指す");
  const sync = () => {
    const m = modeSel.value;
    levelField.classList.toggle("hidden", m !== "practice");
    sideField.classList.toggle("hidden", m === "human");
    ratedInfo.classList.toggle("hidden", m !== "rated");
    importBtn.classList.toggle("hidden", m === "rated");
  };
  modeSel.onchange = sync;
  sync();
  loadProfile().then((p) => {
    const lv = chooseLevel(p.glicko);
    const r = rankOf(p.glicko.rating);
    ratedInfo.replaceChildren(...[
      el("div", { class: "label" }, "あなた"),
      el("div", { class: "rank" }, r.label, el("small", {}, ` ${Math.round(p.glicko.rating)}`)),
      isPlacement(p) ? el("p", { class: "note" }, `棋力判定中（${p.ratedGames}/${PLACEMENT_GAMES}局）: 最初の${PLACEMENT_GAMES}局はレーティングが大きく動きます。`) : null,
      el("p", {}, `次の相手: AI レベル ${lv}（目安 ${rankOf(levelRating(lv)).label}）`),
      el("p", { class: "note" }, "レーティング対局ではヒント・待ったは使えません。途中でやめると負けになります。"),
    ].filter((x) => x !== null) as HTMLElement[]);
  });
  const engineNote = el("p", { class: "note" }, "エンジンを準備中…");
  playEngine().ready.then((r) => {
    engineNote.textContent = r.kind === "yaneuraou"
      ? "エンジン: やねうら王（WebAssembly）"
      : "エンジン: 簡易エンジン（この環境ではやねうら王を動かせません。強いレベルは本来より弱くなります）";
  });
  const start = async (startSfen?: string, moves?: Move[]) => {
    const mode = modeSel.value as GameMode;
    settings.set({ timePreset: timeSel.value, mode, aiLevel: Number(levelSel.value), side: Number(sideSel.value) as 0 | 1 | 2 });
    if (mode === "rated") { onStart(await ratedOptions()); return; }
    if (mode === "human") {
      onStart({ mode, humans: [BLACK, WHITE], timePreset: timeSel.value, names: ["先手", "後手"], startSfen, moves });
      return;
    }
    const human = (sideSel.value === "2" ? (Math.random() < 0.5 ? 0 : 1) : Number(sideSel.value)) as Color;
    const level = Number(levelSel.value);
    const names: [string, string] = human === BLACK ? ["あなた", `AI Lv${level}`] : [`AI Lv${level}`, "あなた"];
    onStart({ mode, humans: [human], timePreset: timeSel.value, names, ai: { color: (human ^ 1) as Color, level }, startSfen, moves });
  };
  const startBtn = el("button", { class: "btn primary big" }, "対局開始");
  startBtn.onclick = () => void start();
  importBtn.onclick = async () => {
    const d = await importDialog();
    if (d) void start(d.sfen, d.moves);
  };
  return el("div", { class: "screen setup" },
    el("h2", {}, "対局"),
    el("label", { class: "field" }, el("span", {}, "対局の種類"), modeSel),
    ratedInfo,
    levelField,
    sideField,
    el("label", { class: "field" }, el("span", {}, "持ち時間"), timeSel),
    startBtn,
    importBtn,
    engineNote,
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
  const practice = opts.mode === "practice";
  const hintBtn = el("button", { class: "btn" }, "ヒント");
  const undoBtn = el("button", { class: "btn" }, "待った");
  const actions = el("div", { class: "actions" + (practice ? " six" : "") }, ...(practice ? [hintBtn, undoBtn] : []), resignBtn, flipBtn, recordBtn, exitBtn);
  let hintArrow: { from: number; to: number; drop: number } | null = null;

  const statusRow = el("div", { class: "status-row" }, status, declareBtn);
  const screen = el("div", { class: "screen play" }, board.root, statusRow, moveList, actions);
  document.body.classList.add("in-game");
  // 手番表示・時計は盤の上下に置く（自分側が下）
  root.replaceChildren(screen);

  const humanTurn = () => !game.result && opts.humans.includes(game.turn);

  function render() {
    nameEls[0].classList.toggle("active", !game.result && game.turn === BLACK);
    nameEls[1].classList.toggle("active", !game.result && game.turn === WHITE);
    board.set({ pos: game.pos, lastMove: game.pos.lastMove(), flipped, movable: humanTurn() ? game.turn : null, arrows: hintArrow ? [hintArrow] : [] });
    declareBtn.classList.toggle("hidden", !(humanTurn() && canDeclareWin(game.pos)));
    if (game.result) {
      const r = game.result;
      status.textContent = r.winner === null ? `${r.reason}で引き分け` : `${r.reason} — ${COLOR_NAME[r.winner]}（${names[r.winner]}）の勝ち`;
      status.className = "status end";
    } else {
      const who = ai && game.turn === ai.color ? "AIが考えています…" : `${COLOR_NAME[game.turn]}の番`;
      status.textContent = `${game.ply + 1}手目 ${who}` + (game.pos.inCheck() ? " — 王手！" : "");
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

  let saved = false;
  let savedId: number | null = null;
  /** 対局を記録し、レーティング対局ならレーティングを更新する */
  async function finishAndSave(): Promise<HTMLElement[]> {
    if (saved || !game.result) return [];
    saved = true;
    const human = opts.mode === "human" ? null : opts.humans[0];
    const rec = {
      date: startedAt.getTime(), mode: opts.mode, startSfen: game.startSfen, moves: game.moves.map(moveToUsi), times,
      humanColor: human, aiLevel: opts.ai?.level ?? null, result: game.result, names, timePreset: opts.timePreset,
    } as Parameters<typeof saveGame>[0];
    const lines: HTMLElement[] = [];
    if (opts.mode === "rated" && human !== null && opts.ai) {
      const profile = await loadProfile();
      const upd = applyRatedGame(profile, opts.ai.level, humanScore(game.result, human));
      rec.rating = { before: upd.before, after: upd.after, aiRating: upd.aiRating, placement: upd.placement };
      await saveProfile(upd.profile);
      const d = Math.round(upd.after.rating - upd.before.rating);
      lines.push(el("p", { class: "rating-change" }, `レーティング ${Math.round(upd.before.rating)} → ${Math.round(upd.after.rating)}（${d >= 0 ? "+" : ""}${d}）`));
      if (upd.placement) lines.push(el("p", { class: "note" }, `棋力判定 ${upd.profile.ratedGames}/${PLACEMENT_GAMES}局`));
      const rb = rankOf(upd.before.rating), ra = rankOf(upd.after.rating);
      if (rankValue(ra) > rankValue(rb)) celebrate(ra.label, ra.kind === "dan" && rb.kind === "kyu" ? "初段に昇段！" : ra.kind === "dan" ? "昇段しました！" : "昇級しました！");
      else if (rankValue(ra) < rankValue(rb) && !upd.placement) lines.push(el("p", { class: "note" }, `${ra.label}に下がりました。次で取り戻しましょう。`));
    }
    try {
      savedId = await saveGame(rec);
      if (game.ply > 0) analysis.enqueue(savedId);
    } catch (e) { toast(`記録を保存できませんでした: ${(e as Error).message}`, 4000); }
    return lines;
  }

  async function onEnd() {
    clock?.stop(performance.now());
    render();
    const r = game.result!;
    const human = opts.mode === "human" ? null : opts.humans[0];
    const msg = human === null
      ? (r.winner === null ? `${r.reason}で引き分けです。` : `${r.reason}で${COLOR_NAME[r.winner]}の勝ちです。`)
      : (r.winner === null ? `${r.reason}で引き分けです。` : r.winner === human ? `${r.reason}であなたの勝ちです！` : `${r.reason}であなたの負けです。`);
    const lines = await finishAndSave();
    analysis.setPaused(false);
    const i = await modal("対局終了", [el("p", {}, msg), ...lines], savedId !== null && game.ply > 0
      ? [{ label: "閉じる" }, { label: "振り返る", primary: true }]
      : [{ label: "閉じる", primary: true }]);
    if (i === 1 && savedId !== null) location.hash = `#/review/${savedId}`;
  }

  const ai = opts.ai;
  const rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const aiEvals: number[] = [];
  let thinking = false;
  let disposed = false;

  async function aiThink() {
    if (!ai || game.result || game.turn !== ai.color || thinking) return;
    thinking = true;
    const ply = game.ply;
    const t0 = performance.now();
    try {
      const p = levelParams(ai.level);
      const position = toUsiPosition(game.startSfen, game.moves).replace(/^position /, "");
      const r = await playEngine().analyze({ position, multipv: p.multipv, nodes: p.nodes });
      if (disposed || game.result || game.ply !== ply) return;
      if (r.bestmove === "win") { game.declare(); onEnd(); return; }
      if (!r.candidates.length || r.bestmove === "resign") { game.resign(ai.color); onEnd(); return; }
      aiEvals.push(r.candidates[0].score);
      if (shouldResign(aiEvals)) { game.resign(ai.color); onEnd(); return; }
      const choice = chooseMove(game.pos, r.candidates, p, rng);
      // すぐ指すと不自然なので、少し考えたように見せる
      const wait = Math.max(0, 350 + rng() * 700 - (performance.now() - t0));
      await new Promise((res) => setTimeout(res, wait));
      if (disposed || game.result || game.ply !== ply) return;
      thinking = false;
      doMove(usiToMove(choice.move));
    } catch (e) {
      toast(`エンジンのエラー: ${(e as Error).message}`, 4000);
    } finally {
      thinking = false;
    }
  }

  function doMove(m: Move) {
    hintArrow = null;
    const captured = game.pos.board[m.to] !== 0;
    if (!game.play(m)) return;
    const used = clock ? clock.press(performance.now()) : 0;
    times.push(used);
    lastBeep = -1;
    playPieceSound(captured);
    if (game.result) void onEnd();
    else { render(); void aiThink(); }
  }
  board.onMove = doMove;

  declareBtn.onclick = async () => {
    const i = await modal("入玉宣言", el("p", {}, "27点法で宣言します。条件を満たしていれば勝ちになります。"), [{ label: "やめる" }, { label: "宣言する", primary: true }]);
    if (i === 1) { game.declare(); onEnd(); }
  };
  resignBtn.onclick = async () => {
    if (game.result) return;
    const loser: Color = ai ? opts.humans[0] : game.turn;
    const i = await modal("投了", el("p", {}, `${ai ? "" : COLOR_NAME[loser] + "が"}投了しますか？`), [{ label: "やめる" }, { label: "投了する", primary: true }]);
    if (i === 1 && !game.result) { game.resign(loser); onEnd(); }
  };
  flipBtn.onclick = () => { flipped = !flipped; render(); };
  // 練習対局だけ: ヒント（最善手を矢印で表示）と待った（自分の手番まで戻す）
  hintBtn.onclick = async () => {
    if (!humanTurn()) return;
    const ply = game.ply;
    hintBtn.disabled = true;
    hintBtn.textContent = "考え中…";
    try {
      const position = toUsiPosition(game.startSfen, game.moves).replace(/^position /, "");
      const r = await analysisEngine().analyze({ position, multipv: 1, nodes: 300_000 });
      if (game.ply === ply && r.candidates[0]) {
        const m = usiToMove(r.candidates[0].move);
        hintArrow = { from: m.from, to: m.to, drop: m.drop };
        render();
      }
    } finally {
      hintBtn.disabled = false;
      hintBtn.textContent = "ヒント";
    }
  };
  undoBtn.onclick = () => {
    if (game.result || !ai) return;
    const human = opts.humans[0];
    // AI が考え中なら止める（考え終わっても手数が変わっているので指さない）
    playEngine().stop();
    let undone = 0;
    while (game.ply > 0 && (undone === 0 || game.turn !== human)) {
      game.undo();
      times.pop();
      undone++;
    }
    aiEvals.length = Math.max(0, aiEvals.length - 1);
    hintArrow = null;
    thinking = false;
    render();
    void aiThink();
  };
  recordBtn.onclick = () => recordMenu();
  exitBtn.onclick = async () => {
    if (!game.result && game.ply > 0) {
      const rated = opts.mode === "rated";
      const i = await modal("対局を終了", el("p", {}, rated ? "レーティング対局を途中でやめると投了（負け）になります。終了しますか？" : "対局を中断して終了しますか？"),
        [{ label: "続ける" }, { label: rated ? "投了して終了" : "終了する", primary: true }]);
      if (i !== 1) return;
      if (rated) { game.resign(opts.humans[0]); clock?.stop(performance.now()); await finishAndSave(); }
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

  analysis.setPaused(true);
  if (clock && !game.result) clock.start(game.turn, performance.now());
  const timer = clock ? window.setInterval(renderClocks, 200) : 0;
  render();
  void aiThink();
  return () => {
    disposed = true;
    clearInterval(timer);
    document.body.classList.remove("in-game");
    playEngine().stop();
    analysis.setPaused(false);
    // 対局中に別の画面へ移ったら、レーティング対局は投了扱い・それ以外は中断として記録
    if (!game.result && game.ply > 0) {
      if (opts.mode === "rated") game.resign(opts.humans[0]);
      if (game.result) void finishAndSave();
    }
  };
}
