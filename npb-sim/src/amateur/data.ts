/** アマチュア野球の土台データ（都道府県・地区・学校名・大学リーグ・社会人チーム）。学校名はすべて架空 */

export type RegionKey = 'hokkaido' | 'tohoku' | 'kanto' | 'tokyo' | 'hokushinetsu' | 'tokai' | 'kinki' | 'chugoku' | 'shikoku' | 'kyushu';

export const REGIONS: { key: RegionKey; name: string; senbatsu: number }[] = [
  { key: 'hokkaido', name: '北海道', senbatsu: 1 },
  { key: 'tohoku', name: '東北', senbatsu: 3 },
  { key: 'kanto', name: '関東', senbatsu: 4 },
  { key: 'tokyo', name: '東京', senbatsu: 2 },
  { key: 'hokushinetsu', name: '北信越', senbatsu: 2 },
  { key: 'tokai', name: '東海', senbatsu: 3 },
  { key: 'kinki', name: '近畿', senbatsu: 6 },
  { key: 'chugoku', name: '中国', senbatsu: 2 },
  { key: 'shikoku', name: '四国', senbatsu: 2 },
  { key: 'kyushu', name: '九州', senbatsu: 4 },
];

/** 都道府県: [名前, 地区, 学校数, 夏の代表枠] */
export const PREFS: [string, RegionKey, number, number][] = [
  ['北海道', 'hokkaido', 8, 2], ['青森', 'tohoku', 4, 1], ['岩手', 'tohoku', 4, 1], ['宮城', 'tohoku', 5, 1], ['秋田', 'tohoku', 4, 1],
  ['山形', 'tohoku', 4, 1], ['福島', 'tohoku', 4, 1], ['茨城', 'kanto', 5, 1], ['栃木', 'kanto', 4, 1], ['群馬', 'kanto', 4, 1],
  ['埼玉', 'kanto', 6, 1], ['千葉', 'kanto', 6, 1], ['東京', 'tokyo', 10, 2], ['神奈川', 'kanto', 7, 1], ['新潟', 'hokushinetsu', 4, 1],
  ['富山', 'hokushinetsu', 4, 1], ['石川', 'hokushinetsu', 4, 1], ['福井', 'hokushinetsu', 4, 1], ['山梨', 'kanto', 4, 1], ['長野', 'hokushinetsu', 4, 1],
  ['岐阜', 'tokai', 4, 1], ['静岡', 'tokai', 5, 1], ['愛知', 'tokai', 7, 1], ['三重', 'tokai', 4, 1], ['滋賀', 'kinki', 4, 1],
  ['京都', 'kinki', 5, 1], ['大阪', 'kinki', 7, 1], ['兵庫', 'kinki', 6, 1], ['奈良', 'kinki', 4, 1], ['和歌山', 'kinki', 4, 1],
  ['鳥取', 'chugoku', 4, 1], ['島根', 'chugoku', 4, 1], ['岡山', 'chugoku', 4, 1], ['広島', 'chugoku', 5, 1], ['山口', 'chugoku', 4, 1],
  ['徳島', 'shikoku', 4, 1], ['香川', 'shikoku', 4, 1], ['愛媛', 'shikoku', 4, 1], ['高知', 'shikoku', 4, 1], ['福岡', 'kyushu', 6, 1],
  ['佐賀', 'kyushu', 4, 1], ['長崎', 'kyushu', 4, 1], ['熊本', 'kyushu', 4, 1], ['大分', 'kyushu', 4, 1], ['宮崎', 'kyushu', 4, 1],
  ['鹿児島', 'kyushu', 4, 1], ['沖縄', 'kyushu', 4, 1],
];

/** 夏の代表枠が2の都道府県の分け方 */
export const SPLIT_NAMES: Record<string, [string, string]> = { 北海道: ['南北海道', '北北海道'], 東京: ['東東京', '西東京'] };

const SCHOOL_A = ['光', '星', '桜', '青葉', '若葉', '旭', '白樺', '大和', '明星', '翔洋', '清和', '誠心', '育英', '修学', '創志', '開明', '啓明', '敬愛', '弘道', '尚志', '暁', '飛龍', '鳳凰', '天翔', '昇陽', '瑞穂', '常盤', '朝陽', '向陽', '栄光'];
const SCHOOL_B = ['学園', '学院', '高校', '実業', '工業', '商業', '館', '義塾', '中央高校', '第一高校', '大附属', '国際高校'];

/** 架空の高校名（地名＋校名） */
export function schoolNames(pref: string, n: number, rand: () => number): string[] {
  const out = new Set<string>();
  const local = pref.replace(/[都道府県]$/, '');
  let guard = 0;
  while (out.size < n && guard++ < 500) {
    const r = rand();
    const a = SCHOOL_A[Math.floor(rand() * SCHOOL_A.length)];
    const b = SCHOOL_B[Math.floor(rand() * SCHOOL_B.length)];
    const name = r < 0.35 ? `${local}${b === '高校' ? '' : ''}${a}${b}` : r < 0.6 ? `${a}${b}` : r < 0.8 ? `${local}${['東', '西', '南', '北', '中央'][Math.floor(rand() * 5)]}高校` : `${local}${a}${b}`;
    out.add(name);
  }
  return [...out];
}

export const SCHOOL_COLORS: [string, string][] = [
  ['#1b3f8f', '#ffffff'], ['#a30d23', '#ffffff'], ['#0b6b3a', '#ffffff'], ['#2b2b2b', '#f2c200'], ['#5a2d82', '#ffffff'], ['#00609c', '#ffd84a'],
  ['#c45200', '#ffffff'], ['#00838f', '#ffffff'], ['#3e2723', '#ffcc80'], ['#880e4f', '#ffffff'], ['#1a237e', '#ff8a80'], ['#33691e', '#fff59d'],
];

export const UNI_LEAGUES: { name: string; region: string; unis: string[] }[] = [
  { name: '関東学生野球リーグ', region: '関東', unis: ['関東文理大学', '武蔵学院大学', '湘南経済大学', '東都工科大学', '常陸大学', '房総国際大学'] },
  { name: '首都大学連盟', region: '関東', unis: ['中央学芸大学', '多摩体育大学', '城北大学', '品川学院大学', '相模原大学', '帝都芸術大学'] },
  { name: '東北学生野球連盟', region: '東北', unis: ['東北学院工業大学', '杜の都大学', 'みちのく大学', '奥羽体育大学', '北上大学', '会津学院大学'] },
  { name: '北海道・北信越学生連盟', region: '北海道・北信越', unis: ['北陸体育大学', '札幌学園大学', '越後大学', '加賀大学', '信濃大学', '旭川工業大学'] },
  { name: '東海学生野球連盟', region: '東海', unis: ['金鯱大学', '駿河大学', '伊勢学院大学', '尾張工業大学', '岐阜体育大学', '三河大学'] },
  { name: '関西学生野球連盟', region: '関西', unis: ['関西国際大学', '六甲大学', '京洛大学', '浪速体育大学', '大和学院大学', '紀州大学'] },
  { name: '中国四国学生連盟', region: '中国・四国', unis: ['瀬戸内大学', '吉備大学', '出雲学院大学', '讃岐大学', '土佐体育大学', '伊予大学'] },
  { name: '九州学生野球連盟', region: '九州', unis: ['九州産業技術大学', '筑紫大学', '肥後学院大学', '薩摩大学', '琉球国際大学', '日向大学'] },
];

export const CORPS = [
  '日の出製鉄', '大和重工', '東洋自動車', '関西ガス', '北海電力', '新星化学', '中部鉄道', '九州通運', '城南銀行', '富士精機', '瀬戸内造船', '東北電工',
  '日本海運輸', '大阪鋼管', '名港物産', '常磐建設', '信越精密', '四国製紙', '広島重機', '博多通信', '仙台食品', '横浜工機', '京阪電装', '鹿島化成',
];
