/**
 * iCalendar (.ics) 生成ユーティリティ。
 *
 * ランチ会は開催時刻を厳密に保持しないため、確定日の「日本時間 12:00〜13:00」を
 * 予定として書き出す（12:00 JST = 03:00 UTC）。confirmedDate の時刻表現に依存せず、
 * JST の暦日だけを使うことでタイムゾーンのズレを避ける。
 */

/** Date を iCalendar の UTC 形式（例: 20260721T030000Z）に整形する。 */
function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** iCalendar のテキスト値をエスケープする（RFC 5545）。 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export interface LunchIcsInput {
  id: number;
  title: string;
  /** 確定日の JST 暦日（YYYY-MM-DD）。 */
  jstDateStr: string;
  location?: string | null;
  description?: string | null;
}

/** ランチ会1件分の .ics 文字列を生成する。 */
export function buildLunchIcs(input: LunchIcsInput): string {
  const start = new Date(`${input.jstDateStr}T03:00:00Z`); // 12:00 JST
  const end = new Date(`${input.jstDateStr}T04:00:00Z`); // 13:00 JST
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//chorei-app//lunch//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:lunch-${input.id}@chorei-app`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    input.location ? `LOCATION:${escapeText(input.location)}` : '',
    input.description ? `DESCRIPTION:${escapeText(input.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

/** DateTime を JST の暦日文字列（YYYY-MM-DD）に変換する。 */
export function toJstDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}
