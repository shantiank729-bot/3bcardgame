export const PAPER_NAME = '白球スポーツ';

export type Scene =
  | 'homer' | 'walkoff' | 'pitcher' | 'nohitter' | 'doage' | 'champion' | 'magic' | 'steal' | 'streak'
  | 'allstar' | 'award' | 'handshake' | 'draft' | 'koshien' | 'retire' | 'slump' | 'crowd' | 'milestone';

export interface Story {
  id: string;
  score: number;
  kind: string;
  /** 大見出し */
  headline: string;
  /** 小見出し（縦書きの袖見出しに使う） */
  sub: string;
  body: string;
  scene: Scene;
  tids: number[];
  pids: number[];
  /** イラストに大きく入れる文字（「50号」「M3」など） */
  big?: string;
  gameId?: number;
}

export interface NewsIssue {
  date: string;
  stories: Story[];
}
