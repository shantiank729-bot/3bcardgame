import "./style.css";
import { el } from "./ui/dom";
import { mountPlay } from "./ui/screens/play";

type Mount = (root: HTMLElement) => (() => void) | void;

const placeholder = (title: string, phase: number): Mount => (root) => {
  root.replaceChildren(el("div", { class: "screen" }, el("h2", {}, title), el("p", { class: "note" }, `フェーズ${phase}で作ります。`)));
};

const home: Mount = (root) => {
  const play = el("a", { class: "btn primary big", href: "#/play" }, "すぐ対局");
  root.replaceChildren(el("div", { class: "screen home" },
    el("h1", {}, "将棋道場"),
    el("div", { class: "card" }, el("div", { class: "label" }, "現在の段級位"), el("div", { class: "rank" }, "—"), el("p", { class: "note" }, "レーティングはフェーズ3で追加します。")),
    el("div", { class: "card" }, el("div", { class: "label" }, "今日の詰将棋"), el("p", { class: "note" }, "フェーズ5で追加します。")),
    play,
  ));
};

const ROUTES: Record<string, { title: string; mount: Mount; tab?: string }> = {
  "": { title: "ホーム", mount: home, tab: "ホーム" },
  play: { title: "対局", mount: mountPlay, tab: "対局" },
  tsume: { title: "詰将棋", mount: placeholder("詰将棋", 5), tab: "詰将棋" },
  records: { title: "記録", mount: placeholder("対局記録・成長記録", 3), tab: "記録" },
  joseki: { title: "定跡練習", mount: placeholder("定跡練習", 6) },
  settings: { title: "設定", mount: placeholder("設定", 3), tab: "設定" },
};

const main = el("main", { id: "main" });
const nav = el("nav", { class: "tabbar" });
document.getElementById("app")!.append(main, nav);

let unmount: (() => void) | void;
function route() {
  const key = location.hash.replace(/^#\/?/, "").split("/")[0];
  const r = ROUTES[key] ?? ROUTES[""];
  if (typeof unmount === "function") unmount();
  main.replaceChildren();
  unmount = r.mount(main);
  nav.replaceChildren(...Object.entries(ROUTES).filter(([, v]) => v.tab).map(([k, v]) =>
    el("a", { href: `#/${k}`, class: k === key || (!ROUTES[key] && k === "") ? "active" : "" }, v.tab!)));
}
window.addEventListener("hashchange", route);
route();
