// Grade display names and sort order
export const GRADE_ORDER = ['E2a', 'E2b', 'E3a', 'E3b', 'E3c', 'E4', 'E4p', 'E5', 'E6'] as const;

export const GRADE_LABELS: Record<string, string> = {
  E2a: '等級2a',
  E2b: '等級2b',
  E3a: '等級3a',
  E3b: '等級3b',
  E3c: '等級3c',
  E4:  '等級4',
  E4p: '等級4+',
  E5:  '等級5',
  E6:  '等級6',
};

// Session days: Tue=2, Thu=4, Fri=5
export const SESSION_DAYS = [2, 4, 5] as const;

export const DAY_LABELS: Record<number, string> = {
  0: '日',
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
};

// Corporate colors
export const BRAND_COLORS = {
  primary: '#00135D',
  secondary: '#1E3A8A',
  accent: '#0070CC',
  danger: '#C0392B',
  warning: '#F59E0B',
  success: '#047857',
  border: '#E0E4EF',
  bgLight: '#F5F7FA',
  text: '#1A1D23',
} as const;

// Grand Rule text
export const GRAND_RULE_TEXT = `朝礼について

この朝礼は、仙台事務所のメンバー同士の「関係性の質」を高める場です。
お互いをよく知り、率直に話せる関係をつくっていきたいと考えています。
参加にあたって、以下を共通のルールとします。

話す人は、テーマの範囲内で、何をどこまで話すかを自分で決めてかまいません。

聴く人は、話された内容について、その場で評価や感想を述べません。
反応の仕方はフェーズごとに運営から案内する形式に沿ってください。

運営は、進行の判断について質問された場合、どのルールに基づく判断かを説明します。

出欠は、参加を原則とします。休むとき・途中で抜けるときは運営に連絡してください。
理由は問いません。`;

// Session flow per phase
export interface FlowStep {
  label: string;
  duration: string;
  description: string;
}

export const SESSION_STRUCTURE: Record<number, FlowStep[]> = {
  1: [
    { label: '冒頭',     duration: '30秒',    description: '運営が発話者・主題を告知' },
    { label: '発話',     duration: '5分',     description: '発話者が主題について話す' },
    { label: '関心表明', duration: '2分',     description: '聴取者7名が15〜20秒ずつ「関心を持った一点」を述べる' },
    { label: '締め',     duration: '1分30秒', description: '運営が締めの挨拶、次回の告知' },
  ],
  2: [
    { label: '冒頭',                   duration: '30秒',      description: '運営が発話者A・応答者B・主題を告知' },
    { label: '発話A',                  duration: '6分',       description: '発話者Aが主題について話す' },
    { label: '問いを置くB',            duration: '2分',       description: '応答者Bが自分の中に生まれた問いを場に置く' },
    { label: 'Aの応答（任意）',        duration: '2〜3分',    description: 'Aが応えたい場合のみ応える' },
    { label: '聴取者6名の感想（任意）', duration: '3〜4分',   description: 'チャットまたは口頭で、任意で感想を残す' },
    { label: '締め',                   duration: '30秒〜1分', description: '運営が締めの挨拶、次回の告知' },
  ],
};

/** UTC ベースの日付フォーマット（タイムゾーン非依存） */
export function formatDateUTC(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${DAY_LABELS[d.getUTCDay()]}）`;
}

/** 今日の日付文字列を返す（YYYY-MM-DD, UTC基準） */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}
