import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** 2回押しで実行するボタン（ブラウザの確認ダイアログを使わない） */
export function ConfirmButton({ onConfirm, children, cls = 'btn', ask = 'もう一度押すと実行' }: {
  onConfirm: () => void; children: ComponentChildren; cls?: string; ask?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button class={`${cls} ${armed ? 'armed' : ''}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? ask : children}
    </button>
  );
}
