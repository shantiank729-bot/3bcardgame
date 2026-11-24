import { exportKif } from "../../core/kif";
import { usiToMove } from "../../core/usi";
import { GameRecord, humanScore, loadGames, loadProfile } from "../../db/records";
import { rankOf } from "../../rating/rank";
import { computeStats } from "../../rating/stats";
import { lineChart } from "../chart";
import { download, el } from "../dom";

const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const MODE_LABEL = { rated: "レーティング", practice: "練習", human: "人どうし" } as const;

/** 段級位の境界を目盛りにする（多すぎないよう間引く） */
function rankGrid(min: number, max: number) {
  const bounds: number[] = [];
  for (let v = 100; v < 1500; v += 100) bounds.push(v);
  for (let v = 1500; v <= 2700; v += 150) bounds.push(v);
  const inRange = bounds.filter((b) => b >= min && b <= max);
  const step = Math.ceil(inRange.length / 5);
  return inRange.filter((_, i) => i % step === 0).map((y) => ({ y, label: rankOf(y).label }));
}

function resultText(g: GameRecord): string {
  if (g.humanColor === null) return g.result.winner === null ? "引き分け" : `${g.result.winner === 0 ? "先手" : "後手"}勝ち`;
  const s = humanScore(g.result, g.humanColor);
  return s === 1 ? "勝ち" : s === 0 ? "負け" : "引き分け";
}

export function mountRecords(root: HTMLElement) {
  const body = el("div", { class: "screen records" }, el("h2", {}, "成長記録"), el("p", { class: "note" }, "読み込み中…"));
  root.replaceChildren(body);
  void (async () => {
    const [games, profile] = await Promise.all([loadGames(), loadProfile()]);
    const st = computeStats(games);
    const r = rankOf(profile.glicko.rating);
    const tile = (label: string, value: string) => el("div", { class: "tile" }, el("div", { class: "tile-value" }, value), el("div", { class: "tile-label" }, label));
    const tiles = el("div", { class: "tiles" },
      tile("段級位", r.label),
      tile("レーティング", String(Math.round(profile.glicko.rating))),
      tile("対局数", `${st.rated}局`),
      tile("勝率", st.winRate === null ? "—" : `${Math.round(st.winRate * 100)}%`),
      tile("連勝中", `${st.currentStreak}`),
      tile("最高連勝", `${st.bestStreak}`),
    );
    const chartBox = el("div", { class: "card" }, el("h3", {}, "レーティングの推移"));
    if (st.series.length >= 2) {
      chartBox.append(lineChart(st.series.map((p, i) => ({
        x: i, y: p.rating, label: `${i === 0 ? "開始" : `${i}局目`} ${Math.round(p.rating)}（${rankOf(p.rating).label}）${i ? " " + fmtDate(p.date) : ""}`,
      })), rankGrid));
    } else chartBox.append(el("p", { class: "note" }, "レーティング対局をするとグラフが表示されます。"));
    const hist = el("div", { class: "card" }, el("h3", {}, "段級位の履歴"),
      st.rankHistory.length
        ? el("ul", { class: "rank-history" }, ...st.rankHistory.slice(-10).reverse().map((e) =>
          el("li", {}, el("span", { class: e.up ? "up" : "down" }, e.up ? "▲ 昇級・昇段" : "▼ 降級・降段"), ` ${e.label}`, el("span", { class: "note" }, ` ${fmtDate(e.date)}`))))
        : el("p", { class: "note" }, "まだありません。"));
    const list = el("div", { class: "card" }, el("h3", {}, "対局記録"));
    if (!games.length) list.append(el("p", { class: "note" }, "まだ対局がありません。"));
    const PAGE = 20;
    let shown = 0;
    const more = el("button", { class: "btn small" }, "さらに表示");
    const ordered = games.slice().reverse();
    const showMore = () => {
      for (const g of ordered.slice(shown, shown + PAGE)) list.insertBefore(gameRow(g), more);
      shown += PAGE;
      more.classList.toggle("hidden", shown >= ordered.length);
    };
    list.append(more);
    more.onclick = showMore;
    showMore();
    function gameRow(g: GameRecord): HTMLElement {
      const kifBtn = el("button", { class: "btn small" }, "KIF");
      kifBtn.onclick = () => download(`shogi_${g.id}.kif`, exportKif({
        startSfen: g.startSfen, moves: g.moves.map(usiToMove), times: g.times, black: g.names[0], white: g.names[1],
        startedAt: new Date(g.date), endReason: g.result.reason === "連続王手の千日手" ? "反則負け" : g.result.reason, winner: g.result.winner,
      }));
      const delta = g.rating ? Math.round(g.rating.after.rating - g.rating.before.rating) : null;
      const res = resultText(g);
      return el("div", { class: "game-row" },
        el("div", { class: "game-main" },
          el("span", { class: `badge ${g.mode}` }, MODE_LABEL[g.mode]),
          el("span", { class: `result ${res === "勝ち" ? "win" : res === "負け" ? "loss" : ""}` }, res),
          el("span", {}, g.aiLevel ? ` 対 AI Lv${g.aiLevel}` : ""),
          el("div", { class: "note" }, `${fmtDate(g.date)}・${g.moves.length}手・${g.result.reason}${delta !== null ? `・${delta >= 0 ? "+" : ""}${delta}` : ""}`)),
        kifBtn);
    }
    body.replaceChildren(el("h2", {}, "成長記録"), tiles, chartBox, hist, list,
      el("p", { class: "note" }, "対局の振り返り（解析・形勢グラフ）はフェーズ4で追加します。"));
  })();
}
