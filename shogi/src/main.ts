import "./style.css";
import { el } from "./ui/dom";
import { mountHome } from "./ui/screens/home";
import { mountPlay } from "./ui/screens/play";
import { mountRecords } from "./ui/screens/records";
import { mountReview } from "./ui/screens/review";
import { mountSettings } from "./ui/screens/settings";
import { mountJoseki } from "./ui/screens/joseki";
import { mountTsume } from "./ui/screens/tsume";

type Mount = (root: HTMLElement, arg?: string) => (() => void) | void;

const ROUTES: Record<string, { title: string; mount: Mount; tab?: string }> = {
  "": { title: "ホーム", mount: mountHome, tab: "ホーム" },
  play: { title: "対局", mount: mountPlay, tab: "対局" },
  tsume: { title: "詰将棋", mount: mountTsume, tab: "詰将棋" },
  records: { title: "記録", mount: mountRecords, tab: "記録" },
  review: { title: "振り返り", mount: mountReview },
  joseki: { title: "定跡練習", mount: mountJoseki },
  settings: { title: "設定", mount: mountSettings, tab: "設定" },
};

const main = el("main", { id: "main" });
const nav = el("nav", { class: "tabbar" });
document.getElementById("app")!.append(main, nav);

let unmount: (() => void) | void;
function route() {
  const [key, arg] = location.hash.replace(/^#\/?/, "").split("/");
  const r = ROUTES[key] ?? ROUTES[""];
  if (typeof unmount === "function") unmount();
  main.replaceChildren();
  unmount = r.mount(main, arg);
  nav.replaceChildren(...Object.entries(ROUTES).filter(([, v]) => v.tab).map(([k, v]) =>
    el("a", { href: `#/${k}`, class: k === key || (!ROUTES[key] && k === "") ? "active" : "" }, v.tab!)));
}
window.addEventListener("hashchange", route);
route();

// PWA: Service Worker を登録する（本番ビルドのみ）。
// ヘッダーで分離されていない環境（GitHub Pages など）では、SW が付けたヘッダーを効かせるため1回だけ再読み込みする。
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then(async () => {
    await navigator.serviceWorker.ready;
    let reloaded = true;
    try { reloaded = !!sessionStorage.getItem("coi-reloaded"); sessionStorage.setItem("coi-reloaded", "1"); } catch { /* 保存できない環境では再読み込みしない */ }
    if (!window.crossOriginIsolated && !reloaded) location.reload();
  }).catch(() => { /* SW が使えなくても簡易エンジンで動く */ });
}
