/**
 * 日本の祝日と全社休み（お盆・年末年始）を年から組み立てる。
 *
 * 朝礼の予定を先の日付まで作るとき、その範囲の休みが Holiday テーブルに
 * 入っていないと祝日に予定が入ってしまうため、ここで機械的に求める。
 * 1980〜2099年で成立する一般的な算出方法を使う（春分・秋分は近似式）。
 * 五輪などの一度きりの移動は対象外。
 */

export type HolidayDef = { date: string; name: string };

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** その月の n 回目の月曜日（ハッピーマンデー）。 */
function nthMonday(year: number, month: number, nth: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (8 - first.getUTCDay()) % 7; // 1日から最初の月曜までの日数
  return 1 + offset + (nth - 1) * 7;
}

/** 春分の日・秋分の日（1980〜2099年で有効な近似式）。 */
function equinoxDay(year: number, kind: 'spring' | 'autumn'): number {
  const base = kind === 'spring' ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** その年の国民の祝日（振替休日・国民の休日を含む）。 */
export function nationalHolidays(year: number): HolidayDef[] {
  const fixed: HolidayDef[] = [
    { date: ymd(year, 1, 1), name: '元日' },
    { date: ymd(year, 1, nthMonday(year, 1, 2)), name: '成人の日' },
    { date: ymd(year, 2, 11), name: '建国記念の日' },
    { date: ymd(year, 2, 23), name: '天皇誕生日' },
    { date: ymd(year, 3, equinoxDay(year, 'spring')), name: '春分の日' },
    { date: ymd(year, 4, 29), name: '昭和の日' },
    { date: ymd(year, 5, 3), name: '憲法記念日' },
    { date: ymd(year, 5, 4), name: 'みどりの日' },
    { date: ymd(year, 5, 5), name: 'こどもの日' },
    { date: ymd(year, 7, nthMonday(year, 7, 3)), name: '海の日' },
    { date: ymd(year, 8, 11), name: '山の日' },
    { date: ymd(year, 9, nthMonday(year, 9, 3)), name: '敬老の日' },
    { date: ymd(year, 9, equinoxDay(year, 'autumn')), name: '秋分の日' },
    { date: ymd(year, 10, nthMonday(year, 10, 2)), name: 'スポーツの日' },
    { date: ymd(year, 11, 3), name: '文化の日' },
    { date: ymd(year, 11, 23), name: '勤労感謝の日' },
  ];

  const byDate = new Map(fixed.map((h) => [h.date, h.name]));

  // 振替休日: 日曜と重なったら、次の祝日でない日を休みにする。
  for (const h of fixed) {
    const d = new Date(`${h.date}T00:00:00.000Z`);
    if (d.getUTCDay() !== 0) continue;
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (byDate.has(d.toISOString().slice(0, 10)));
    byDate.set(d.toISOString().slice(0, 10), '振替休日');
  }

  // 国民の休日: 祝日に挟まれた平日（例 2026/9/22）。
  for (const h of fixed) {
    const prev = new Date(`${h.date}T00:00:00.000Z`);
    prev.setUTCDate(prev.getUTCDate() + 1);
    const next = new Date(prev);
    next.setUTCDate(next.getUTCDate() + 1);
    const between = prev.toISOString().slice(0, 10);
    if (
      prev.getUTCDay() !== 0 &&
      !byDate.has(between) &&
      byDate.has(next.toISOString().slice(0, 10))
    ) {
      byDate.set(between, '国民の休日');
    }
  }

  return [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 全社休み（毎年同じ月日）。お盆 8/13〜8/16、年末年始 12/29〜翌1/3。 */
export function officeBreaks(year: number): HolidayDef[] {
  const out: HolidayDef[] = [];
  for (let d = 13; d <= 16; d++) out.push({ date: ymd(year, 8, d), name: '夏季休暇（お盆）' });
  for (let d = 29; d <= 31; d++) out.push({ date: ymd(year, 12, d), name: '年末年始休暇' });
  for (let d = 1; d <= 3; d++) out.push({ date: ymd(year, 1, d), name: '年末年始休暇' });
  return out;
}

/** from〜to（YYYY-MM-DD）に含まれる祝日と全社休みを返す。元日は祝日名を優先する。 */
export function holidaysBetween(from: string, to: string): HolidayDef[] {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const byDate = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) {
    for (const h of officeBreaks(y)) byDate.set(h.date, h.name);
    for (const h of nationalHolidays(y)) byDate.set(h.date, h.name);
  }
  return [...byDate.entries()]
    .filter(([date]) => date >= from && date <= to)
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
