/** 日付ユーティリティ（UTC基準、"YYYY-MM-DD"） */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function weekday(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay(); // 0=日
}
export const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${withYear ? y + '年' : ''}${m}月${d}日(${WEEKDAY_JP[weekday(iso)]})`;
}
/** 指定年の3月最終金曜の前後（開幕日）: 3月最終金曜 */
export function openingDay(year: number): string {
  let d = `${year}-03-31`;
  while (weekday(d) !== 5) d = addDays(d, -1);
  return d;
}
