import { fmtDate } from '../../league/calendar';
import { teamById } from '../../league/world';
import { LineScore } from '../components/LineScore';
import { Logo } from '../components/Logo';
import { ipStr, POS_1, POS_CODE_REV } from '../format';
import { useWorld } from '../store';

export function GamePage({ id }: { id: number }) {
  const w = useWorld();
  const g = w.results[id];
  if (!g) return <div class="page"><p>試合が見つかりません</p></div>;
  const name = (pid: number | null) => (pid === null ? '' : w.players[pid]?.name ?? '?');
  const link = (pid: number) => <a href={'#/player/' + pid}>{name(pid)}</a>;
  return (
    <div class="page">
      <section class="card">
        <h2>{fmtDate(g.date, true)}　{g.parkName ?? teamById(w, g.home).park.name}{g.kind === 'I' ? '（交流戦）' : g.kind === 'AS' ? `（オールスター${g.label}）` : g.kind === 'JS' ? `（日本シリーズ${g.label}）` : g.kind === 'CS1' || g.kind === 'CS2' ? `（クライマックスシリーズ${g.label}）` : ''}</h2>
        <div class="tablewrap"><LineScore w={w} g={g} /></div>
        <p class="decisions">
          {g.wp && <span>勝 {link(g.wp)}</span>}
          {g.lp && <span>敗 {link(g.lp)}</span>}
          {g.sv && <span>S {link(g.sv)}</span>}
          {g.tie && <span>12回引き分け</span>}
          {g.walkoff && <span class="tag">サヨナラ</span>}
        </p>
        {g.hr.length > 0 && (
          <p>本塁打: {g.hr.map((h) => <span key={h.pid}>{link(h.pid)}（{teamById(w, h.tid).short}）{h.n > 1 ? ` ${h.n}本` : ''}　</span>)}</p>
        )}
      </section>
      <div class="grid2">
        {[g.away, g.home].map((tid) => {
          const t = teamById(w, tid);
          const bats = g.boxBat.filter((r) => r[1] === tid);
          const pits = g.boxPitch.filter((r) => r[1] === tid);
          return (
            <section class="card" key={tid}>
              <h3><Logo team={t} size={22} /> {t.city}{t.nickname}</h3>
              <div class="tablewrap">
                <table class="data box">
                  <thead><tr><th>打順</th><th>守</th><th class="l">選手</th><th>打</th><th>得</th><th>安</th><th>点</th><th>四死</th><th>振</th><th>本</th></tr></thead>
                  <tbody>
                    {bats.map((r) => {
                      const sub = r[2] >= 100;
                      return (
                        <tr key={r[0]} class={sub ? 'sub' : ''}>
                          <td>{sub ? '' : r[3]}</td><td>{POS_1[POS_CODE_REV[r[2] % 100]] ?? ''}</td>
                          <td class="l">{sub ? '　' : ''}{link(r[0])}</td>
                          {r.slice(4).map((v, i) => <td key={i}>{v}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table class="data box">
                  <thead><tr><th class="l">投手</th><th>回</th><th>安</th><th>失</th><th>自</th><th>四死</th><th>振</th><th>球数</th><th>本</th></tr></thead>
                  <tbody>
                    {pits.map((r) => (
                      <tr key={r[0]}>
                        <td class="l">{link(r[0])}{r[0] === g.wp ? '（勝）' : r[0] === g.lp ? '（敗）' : r[0] === g.sv ? '（S）' : ''}</td>
                        <td>{ipStr(r[2])}</td>{r.slice(3).map((v, i) => <td key={i}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
