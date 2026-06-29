// ランチ会タイトルの単一ソース（第1回「仙台Synergy Bites 2026 June」を踏襲）。
// フォーマット: `仙台Synergy Bites <YYYY> <英語月名>`
// 生成箇所を一本化し、タイトルを自動で統一する。

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** 指定の年・月(0始まり)の標準タイトルを返す。 */
export function lunchTitleForMonth(year: number, monthIndex0: number): string {
  const idx = ((monthIndex0 % 12) + 12) % 12;
  return `仙台Synergy Bites ${year} ${MONTHS_EN[idx]}`;
}

/** 現在(JST)の年月での標準タイトル。 */
export function currentLunchTitleJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return lunchTitleForMonth(jst.getUTCFullYear(), jst.getUTCMonth());
}

/**
 * 任意の入力タイトルを標準フォーマットに正規化する。
 * "… YYYY MonthName" を拾えればその年月で、拾えなければ現在(JST)月で生成。
 */
export function canonicalLunchTitle(input?: string | null): string {
  if (input) {
    const m = input.match(/(\d{4})\s+([A-Za-z]+)/);
    if (m) {
      const year = parseInt(m[1], 10);
      const idx = MONTHS_EN.findIndex((mn) => mn.toLowerCase() === m[2].toLowerCase());
      if (idx >= 0) return lunchTitleForMonth(year, idx);
    }
  }
  return currentLunchTitleJST();
}
