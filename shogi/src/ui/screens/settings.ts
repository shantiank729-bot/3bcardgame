import { exportAll, importAll } from "../../db/db";
import { settings } from "../../settings";
import { download, el, modal, pickFile, toast } from "../dom";

export function mountSettings(root: HTMLElement) {
  const s = settings.get();
  const sound = el("input", { type: "checkbox" });
  sound.checked = s.sound;
  sound.onchange = () => settings.set({ sound: sound.checked });
  const exportBtn = el("button", { class: "btn" }, "データを書き出す（JSON）");
  exportBtn.onclick = async () => {
    const d = new Date();
    download(`shogi-dojo_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`, await exportAll(), "application/json");
  };
  const importBtn = el("button", { class: "btn" }, "データを読み込む");
  importBtn.onclick = async () => {
    const text = await pickFile(".json,application/json");
    if (!text) return;
    const i = await modal("データの読み込み", el("p", {}, "今のデータ（対局記録・レーティングなど）は、読み込むデータで置き換わります。よろしいですか？"), [{ label: "やめる" }, { label: "置き換える", primary: true }]);
    if (i !== 1) return;
    try {
      const r = await importAll(text);
      toast(`読み込みました（対局 ${r.games}件）`);
    } catch (e) {
      toast(`読み込めませんでした: ${(e as Error).message}`, 4000);
    }
  };
  root.replaceChildren(el("div", { class: "screen settings" },
    el("h2", {}, "設定"),
    el("label", { class: "switch-row" }, sound, el("span", {}, "駒音・効果音")),
    el("div", { class: "card" }, el("h3", {}, "データ"),
      el("p", { class: "note" }, "データはこの端末のブラウザ内（IndexedDB）にだけ保存されます。機種変更の前などに書き出しておいてください。"),
      exportBtn, importBtn),
    el("p", { class: "note" }, "将棋道場 — GPL-3.0-or-later。将棋エンジン: やねうら王（GPLv3）、評価関数: 水匠Petite。"),
  ));
}
