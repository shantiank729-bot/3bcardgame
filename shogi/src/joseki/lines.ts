// 定跡練習の手順データ。you の手には「なぜその手か」の短い説明を付ける。
// 手順はすべてテスト（test/joseki.test.ts）で合法手であることを確かめている。

export interface JosekiStep {
  /** USI 形式 */
  move: string;
  /** その手の狙い（自分の手は必須） */
  why?: string;
}

export interface JosekiLine {
  id: string;
  name: string;
  /** 練習する側（0 = 先手, 1 = 後手） */
  you: 0 | 1;
  level: "初級" | "中級";
  summary: string;
  steps: JosekiStep[];
}

export const LINES: JosekiLine[] = [
  {
    id: "shiken",
    name: "四間飛車と美濃囲い（先手）",
    you: 0,
    level: "初級",
    summary: "角道を止めて飛車を6筋（四間）に振り、玉を美濃囲いにしまう、振り飛車のいちばん基本の形です。",
    steps: [
      { move: "7g7f", why: "角道を開けます。" },
      { move: "3c3d" },
      { move: "6g6f", why: "角道を止めて、角交換を避けます。振り飛車ではよくある形です。" },
      { move: "8c8d" },
      { move: "2h6h", why: "飛車を6筋に振ります（四間飛車）。" },
      { move: "8d8e" },
      { move: "8h7g", why: "△8六歩からの飛車先の突破を防ぐため、角を7七に上がって8六を守ります。" },
      { move: "7a6b" },
      { move: "5i4h", why: "玉を右側（飛車と反対側）へ移動させます。" },
      { move: "5a4b" },
      { move: "4h3h", why: "玉をさらに右へ。" },
      { move: "4b3b" },
      { move: "3h2h", why: "玉を2八に。飛車がいなくなった場所が玉の住まいになります。" },
      { move: "6a5b" },
      { move: "3i3h", why: "銀を3八に上がって玉の頭を守ります。" },
      { move: "7c7d" },
      { move: "6i5h", why: "左の金を5八に。玉・銀・金2枚の「美濃囲い」の完成です。" },
    ],
  },
  {
    id: "nakabisha",
    name: "中飛車（先手）",
    you: 0,
    level: "初級",
    summary: "5筋の歩を伸ばして飛車を真ん中に振る作戦。5筋の歩を押し上げて中央から攻めます。",
    steps: [
      { move: "7g7f", why: "角道を開けます。" },
      { move: "3c3d" },
      { move: "5g5f", why: "5筋の歩を突いて、中飛車の準備をします。" },
      { move: "8c8d" },
      { move: "2h5h", why: "飛車を5筋に振ります（中飛車）。" },
      { move: "8d8e" },
      { move: "8h7g", why: "8六を守るため角を上がります。" },
      { move: "7a6b" },
      { move: "5i4h", why: "玉を右へ移動させます。" },
      { move: "5a4b" },
      { move: "4h3h", why: "さらに右へ。" },
      { move: "4b3b" },
      { move: "3h2h", why: "玉を2八へ。" },
      { move: "6a5b" },
      { move: "3i3h", why: "銀を3八に上がって美濃囲いの形にします。" },
      { move: "7c7d" },
      { move: "5f5e", why: "5筋の位を取ります。中飛車の飛車がよく働く形です。" },
    ],
  },
  {
    id: "ibisha-vs-shiken",
    name: "居飛車：四間飛車への舟囲い（先手）",
    you: 0,
    level: "初級",
    summary: "相手が振り飛車のとき、居飛車は玉を左に囲います。舟囲いは早く組める基本の囲いです。",
    steps: [
      { move: "7g7f", why: "角道を開けます。" },
      { move: "3c3d" },
      { move: "2g2f", why: "飛車先の歩を伸ばします。居飛車の基本です。" },
      { move: "4c4d" },
      { move: "2f2e", why: "さらに飛車先を伸ばして、2筋からの攻めを見せます。" },
      { move: "2b3c" },
      { move: "3i4h", why: "右の銀を4八に。急戦にも持久戦にも使える形です。" },
      { move: "8b4b" },
      { move: "5i6h", why: "相手は右側（4筋）に飛車を振ったので、玉は左へ逃がします。" },
      { move: "5a6b" },
      { move: "6h7h", why: "玉を7八へ。" },
      { move: "6b7b" },
      { move: "4i5h", why: "右の金を5八に寄せて、玉の近くを固めます（舟囲い）。" },
      { move: "7b8b" },
      { move: "5g5f", why: "5筋の歩を突いて、4八の銀を5七へ活用する準備です。" },
      { move: "7a7b" },
      { move: "4h5g", why: "銀を5七に上がって、舟囲いの完成です。" },
    ],
  },
  {
    id: "bougin",
    name: "原始棒銀（先手）",
    you: 0,
    level: "初級",
    summary: "銀を飛車の前にまっすぐ進めて、飛車と銀で2筋を突破する、いちばんわかりやすい攻めです。",
    steps: [
      { move: "2g2f", why: "飛車先の歩を伸ばします。" },
      { move: "8c8d" },
      { move: "2f2e", why: "さらに伸ばして、2筋から攻める準備。" },
      { move: "8d8e" },
      { move: "6i7h", why: "相手の飛車先の歩が迫ってきたので、金で角の頭を守ります。" },
      { move: "4a3b" },
      { move: "3i3h", why: "棒銀の出発。銀を3八に上がります。" },
      { move: "7a7b" },
      { move: "3h2g", why: "銀を飛車の前（2七）へ。棒のようにまっすぐ進むので「棒銀」です。" },
      { move: "6c6d" },
      { move: "2g2f", why: "銀を2六へ。次は1五から2四を狙います。" },
      { move: "7b6c" },
      { move: "2f1e", why: "銀を1五へ。2四の地点に、飛車・銀・歩の3つが集まります。" },
      { move: "6c5d" },
      { move: "2e2d", why: "2四歩と仕掛けます。相手が取れば銀で取り返して、2筋を突破します。" },
      { move: "2c2d" },
      { move: "1e2d", why: "銀で取り返します。次は▲2三銀成や▲2三歩で攻めを続けます。" },
    ],
  },
  {
    id: "vs-bougin",
    name: "四間飛車で居飛車の飛車先を受ける（後手）",
    you: 1,
    level: "初級",
    summary: "後手で四間飛車に組みます。相手が2筋の歩を伸ばしてきたら角で受けるのがポイントです。",
    steps: [
      { move: "7g7f" },
      { move: "3c3d", why: "角道を開けます。" },
      { move: "2g2f" },
      { move: "4c4d", why: "角道を止めて、振り飛車の準備をします。" },
      { move: "3i4h" },
      { move: "8b4b", why: "飛車を4筋（四間）に振ります。" },
      { move: "5i6h" },
      { move: "5a6b", why: "玉を左（飛車と反対側）へ。" },
      { move: "6h7h" },
      { move: "6b7b", why: "さらに左へ。" },
      { move: "2f2e" },
      { move: "2b3c", why: "▲2四歩と突かれる前に、角を3三に上がって2筋を受けます。これが大事な一手です。" },
      { move: "5g5f" },
      { move: "7b8b", why: "玉を8二へ。" },
      { move: "4i5h" },
      { move: "7a7b", why: "銀を7二に上がって、美濃囲いの形にします。" },
      { move: "3g3f" },
      { move: "6a5b", why: "金を5二に寄せて、美濃囲いの完成です。" },
    ],
  },
];
