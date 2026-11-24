import type { GameEvent } from './game';
import type { FieldPos } from './types';

const POS_JP: Record<FieldPos, string> = {
  P: 'ピッチャー', C: 'キャッチャー', '1B': 'ファースト', '2B': 'セカンド', '3B': 'サード', SS: 'ショート', LF: 'レフト', CF: 'センター', RF: 'ライト',
};
export const POS_SHORT: Record<string, string> = {
  P: '投', C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: 'DH',
};

/** 実況テキスト（1行） */
export function describeEvent(e: GameEvent, name: (id: number) => string): string {
  switch (e.t) {
    case 'pa': {
      const b = name(e.batter);
      const f = e.bip ? POS_JP[e.bip.fielder] : '';
      const runs = e.runs > 0 ? `（${e.runs}点）` : '';
      const map: Record<string, string> = {
        K: `${b}、空振り三振`,
        BB: `${b}、フォアボール`,
        IBB: `${b}を申告敬遠`,
        HBP: `${b}、デッドボール`,
        '1B': e.bip && ['LF', 'CF', 'RF'].includes(e.bip.fielder) ? `${b}、${f}前ヒット` : `${b}、${f}への内野安打`,
        '2B': `${b}、${f}への二塁打`,
        '3B': `${b}、${f}への三塁打`,
        HR: `${b}、${e.angle !== undefined && e.angle < -15 ? 'レフト' : e.angle !== undefined && e.angle > 15 ? 'ライト' : 'センター'}スタンドへホームラン！`,
        GO: `${b}、${f}ゴロ`,
        FO: `${b}、${f}フライ`,
        LO: `${b}、${f}ライナー`,
        PO: `${b}、${f}への内野フライ`,
        DP: `${b}、${f}ゴロ併殺打`,
        FC: `${b}、${f}ゴロ（フィルダースチョイス）`,
        E: `${b}、${f}のエラーで出塁`,
        SH: `${b}、送りバント成功`,
        SHFC: `${b}、バント（野選で先の走者アウト）`,
        SHHIT: `${b}、セーフティバントでヒット`,
        SF: `${b}、${f}への犠牲フライ`,
        SQZ: `${b}、スクイズ成功`,
      };
      return (map[e.result] ?? `${b} ${e.result}`) + runs;
    }
    case 'steal':
      return `${name(e.runner)}、${e.base === 2 ? '二' : '三'}盗${e.success ? '成功' : '失敗'}`;
    case 'wp':
      return `暴投${e.runs ? `で${e.runs}点` : ''}`;
    case 'pitchChange':
      return `ピッチャー交代 ${name(e.out)} → ${name(e.in)}`;
    case 'sub':
      return `${e.kind === 'PH' ? '代打' : e.kind === 'PR' ? '代走' : '守備交代'} ${name(e.out)} → ${name(e.in)}`;
    case 'inningEnd':
      return `${e.inning}回${e.top ? '表' : '裏'}終了 ${e.scoreAway}-${e.scoreHome}`;
    case 'end':
      return `試合終了 ${e.scoreAway}-${e.scoreHome}`;
  }
}
