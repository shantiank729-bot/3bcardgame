import { el } from "./dom";
import { playBeep } from "./sound";

/** 昇級・昇段の演出（紙吹雪と大きな文字） */
export function celebrate(rankLabel: string, message: string) {
  const colors = ["#e4572e", "#f3a712", "#29335c", "#669bbc", "#a8c686", "#b5542c"];
  const confetti = Array.from({ length: 60 }, (_, i) => {
    const c = el("i", { class: "confetti" });
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    c.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    return c;
  });
  const box = el("div", { class: "celebrate" }, ...confetti,
    el("div", { class: "celebrate-card" }, el("div", { class: "celebrate-msg" }, message), el("div", { class: "celebrate-rank" }, rankLabel), el("div", { class: "note" }, "タップして閉じる")));
  box.onclick = () => box.remove();
  document.body.append(box);
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playBeep(f, 0.18), i * 140));
}
