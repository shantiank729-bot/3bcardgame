import { isPlacement, loadProfile } from "../../db/records";
import { PLACEMENT_GAMES, chooseLevel, rankOf } from "../../rating/rank";
import { el } from "../dom";
import { todayTsumeSummary } from "./tsume";

export function mountHome(root: HTMLElement) {
  const rankCard = el("div", { class: "card" }, "読み込み中…");
  const tsumeCard = el("a", { class: "card link-card", href: "#/tsume" }, el("div", { class: "label" }, "今日の詰将棋"), el("p", { class: "note" }, "読み込み中…"));
  todayTsumeSummary().then((t) => {
    tsumeCard.replaceChildren(
      el("div", { class: "label" }, "今日の詰将棋"),
      el("div", { class: "rank" }, t.done >= t.total ? "今日の分は完了！" : `${t.done} / ${t.total} 問`),
      el("p", { class: "note" }, `今の難しさ: ${t.level}手詰・連続 ${t.streak}日`),
    );
  });
  root.replaceChildren(el("div", { class: "screen home" },
    el("h1", {}, "将棋道場"),
    rankCard,
    el("a", { class: "btn primary big", href: "#/play/quick" }, "すぐ対局（レーティング対局）"),
    el("a", { class: "btn", href: "#/play" }, "対局の種類・持ち時間を選ぶ"),
    tsumeCard,
    el("div", { class: "row-links" }, el("a", { href: "#/records" }, "成長記録・対局記録 →")),
  ));
  loadProfile().then((p) => {
    const r = rankOf(p.glicko.rating);
    const toNext = r.next !== null ? Math.ceil(r.next - p.glicko.rating) : null;
    rankCard.replaceChildren(
      el("div", { class: "label" }, "現在の段級位"),
      el("div", { class: "rank big" }, r.label, el("small", {}, ` レーティング ${Math.round(p.glicko.rating)}`)),
      isPlacement(p)
        ? el("p", { class: "note" }, `棋力判定中: あと${PLACEMENT_GAMES - p.ratedGames}局で判定が終わります（初期値は8級）。`)
        : el("p", { class: "note" }, toNext !== null ? `次の段級位まであと ${toNext} 点` : "最高位です"),
      el("p", { class: "note" }, `次の相手: AI レベル ${chooseLevel(p.glicko)}`),
    );
  });
}
