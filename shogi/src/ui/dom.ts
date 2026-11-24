type Child = Node | string | null | undefined | false;

/** 小さな DOM ヘルパー */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") (e as unknown as Record<string, unknown>)[k] = v;
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false) e.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function toast(msg: string, ms = 2200) {
  const t = el("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export function modal(title: string, body: Child | Child[], buttons: { label: string; primary?: boolean; onClick?: () => void }[]): Promise<number> {
  return new Promise((resolve) => {
    const overlay = el("div", { class: "overlay" });
    const btns = buttons.map((b, i) => {
      const btn = el("button", { class: b.primary ? "btn primary" : "btn" }, b.label);
      btn.onclick = () => { overlay.remove(); b.onClick?.(); resolve(i); };
      return btn;
    });
    const content = Array.isArray(body) ? body : [body];
    overlay.append(el("div", { class: "dialog" }, el("h3", {}, title), el("div", { class: "dialog-body" }, ...content), el("div", { class: "row end" }, ...btns)));
    document.body.append(overlay);
  });
}

export function download(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type: type + ";charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = el("input", { type: "file", accept });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const buf = await f.arrayBuffer();
      // UTF-8 で読めなければ Shift_JIS とみなす（古い KIF）
      let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      if (text.includes("�")) {
        try { text = new TextDecoder("shift_jis").decode(buf); } catch { /* そのまま */ }
      }
      resolve(text);
    };
    input.click();
  });
}
