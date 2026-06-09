# 朝礼＆ランチ会管理アプリ 改善設計書

- **対象アプリ**: 社内朝礼＆ランチ会管理アプリ（Next.js App Router / TypeScript / Tailwind / Prisma + PostgreSQL(Neon) / NextAuth / Vercel）
- **作成日**: 2026-06-09
- **ステータス**: ドラフト（実装着手前のレビュー用）

---

## 0. 本設計書のスコープ

レビューで洗い出した課題のうち、合意した以下2テーマを **Phase 1 / Phase 2** として実装対象とする。
通知連携（Slack/Teams）は方向性のみ **Phase 3（付録A）** で先行設計し、ツール選定は別途決定する。

| Phase | テーマ | ゴール |
|---|---|---|
| **Phase 1** | セキュリティ / データ整合性 | 認可漏れ(IDOR)の封鎖、ユーザー論理削除化、FKインデックス付与、認可ヘルパ集約 |
| **Phase 2** | UX改善（フォーム離脱率） | アンケート/日程調整のステップ化・プリフィル・保存フィードバック・モバイル対応 |
| Phase 3（後続） | 通知連携 | 汎用Webhook抽象で締切リマインド/確定通知/本日のスピーカー自動投稿 |

### 決定事項（確認済み）
- ユーザー削除は **論理削除へ移行**（物理削除＋カスケードは採用しない）。
- ログインのエラー表示は **現状維持**（社内クローズド利用のためユーザー列挙を容認）。よって本設計では認証フローは変更しない。
- 通知連携の対象ツールは **未定**。Webhookアダプタ抽象として設計し、実装は後続。

---

## 1. 現状アーキテクチャ（要約）

- 認証: NextAuth(Credentials + JWT)。`src/proxy.ts` で全ルートのセッションガード＋一部adminルート制御。
- 認可: 各 API Route 内で `auth()` を呼び `session.user.role` を都度判定（ボイラープレート重複）。
- データ: Prisma。朝礼系（Phase/Topic/Session/Attendance/AbsenceRequest/...）＋ランチ系（LunchEvent/Participation/ScheduleCandidate/...）。
- 自動化: `GET /api/cron/daily-finalize`（毎朝07:00 JST）で当日朝礼の欠席反映・スピーカー繰上・最低人数割れ自動中止。

---

# Phase 1: セキュリティ / データ整合性

## 1.1 認可漏れ(IDOR)の封鎖 — 日程回答API

### 課題
`POST /api/lunch/[id]/schedule/respond` が、URLの `id`・`candidateId` の所属検証と参加者検証を行っていない。ログイン済みなら任意の `candidateId` に書き込み可能。

### 対応
`responses` 内の全 `candidateId` が当該 `eventId` に属することを検証し、不正があれば 400。さらに本人が参加者でない場合は 403。

```ts
// src/app/api/lunch/[id]/schedule/respond/route.ts
const eventId = parseInt((await params).id);
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;

const { responses } = await req.json() as {
  responses: { candidateId: number; response: "○" | "△" | "×" }[];
};

// 1) candidate が全てこの event に属することを検証
const ids = [...new Set(responses.map(r => r.candidateId))];
const valid = await prisma.scheduleCandidate.count({
  where: { id: { in: ids }, eventId },
});
if (valid !== ids.length) {
  return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
}

// 2) 本人が参加者であることを検証
const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// 3) upsert（既存トランザクションを維持）
```

### 横展開（同種チェックを要する他API）
- `POST /api/lunch/[id]/comment` … コメント投稿者が参加者か、`eventId` 整合
- `POST /api/lunch/[id]/photo` … 同上
- いずれも「URLの `[id]` と body 内 ID の所属一致」「本人が参加者/admin」をチェックする方針で統一。

## 1.2 認可ヘルパの集約とHTTPステータス統一

### 課題
全APIで `auth()`＋role判定を手書き。admin拒否のステータスが `401`（lunch系）と `403`（users系）で混在。

### 対応
ヘルパに集約し、未認証=401 / 権限不足=403 に統一。

```ts
// src/lib/api-auth.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser() {
  const session = await auth();
  if (!session) throw new ApiError(401, "Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") throw new ApiError(403, "Forbidden");
  return session;
}

// 例外をレスポンスに変換する薄いラッパ
export function handle(fn: () => Promise<Response>) {
  return fn().catch((e) => {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  });
}
```

各ルートは `const session = await requireAdmin();` の1行に置換していく（段階移行可、既存挙動互換）。

## 1.3 ユーザー論理削除への移行（決定事項）

### 課題
`User` のリレーションは `onDelete` 未指定（Restrict）。履歴を持つユーザーの `DELETE /api/users` は必ずFK制約違反で500。かつ履歴の整合性上、物理削除は不可。

### スキーマ変更
```prisma
model User {
  // ...existing fields...
  deletedAt DateTime?   // 追加: null=有効, 値あり=論理削除
  @@index([deletedAt])
}
```

### API変更
`DELETE /api/users` を物理削除から論理削除に変更。

```ts
// 変更前
await prisma.user.delete({ where: { id } });

// 変更後（論理削除 + 参加対象からも外す）
await prisma.user.update({
  where: { id },
  data: { deletedAt: new Date(), choreiStatus: "inactive", lunchStatus: "inactive" },
});
```

### 取得側のフィルタ方針
- **一覧・選定・ローテ生成**: `where: { deletedAt: null }` を付与（`GET /api/users`、`rotation.ts` の `findMany`、`selectionAlgorithm` 投入元、ランチ選定の `activeStaff` 取得 等）。
- **履歴表示（history / 過去session）**: 論理削除済みユーザーも **表示し続ける**（氏名は保持）。削除済みは淡色＋「(退職)」等のラベルで区別。
- ログインは `deletedAt: null` のみ許可（`authorize` / `authenticate` の `findFirst` に条件追加）。

> 影響箇所の洗い出し: `prisma.user.findMany`／`findFirst` の全呼び出しを grep し、「現役のみ対象」か「履歴含む」かを1つずつ判定して条件を付与する（実装時チェックリスト化）。

### 削除前の影響表示（UX連動）
削除ボタン押下時に「このユーザーは朝礼スピーチ◯件・ランチ参加◯件に紐づきます。退会(非表示)にしますか？」と確認ダイアログを表示。

## 1.4 FKインデックス付与

### 課題
Prismaは PostgreSQL のリレーションFKスカラ列に自動でインデックスを張らない。主要クエリがフルスキャン。

### スキーマ変更（最低限の推奨セット）
```prisma
model Session {
  @@index([phaseId])
  @@index([speakerId])
  @@index([date])
  @@index([phaseId, weekNumber])
}
model Attendance       { @@index([userId]) }          // ([sessionId,userId])のuniqueは既存
model AbsenceRequest   { @@index([sessionId]); @@index([userId]) }
model Notification     { @@index([userId, readAt]) }   // 未読バッジ取得
model CommentatorView  { @@index([sessionId]) }
model LunchEvent       { @@index([status]); @@index([createdAt]); @@index([organizerId]); @@index([restaurantId]) }
model Participation     { @@index([userId]) }          // ([eventId,userId])のuniqueは既存
model ScheduleCandidate{ @@index([eventId]) }
model ScheduleResponse { @@index([userId]) }           // ([candidateId,userId])のuniqueは既存
model SurveyResponse   { @@index([userId]) }
model Settlement       { @@index([eventId]) }
model LunchComment     { @@index([eventId]); @@index([createdAt]) }
model LunchPhoto       { @@index([eventId]) }
model ExclusionLog     { @@index([eventId]) }
}
```

### マイグレーション運用（Neon）
- ローカル: `npx prisma migrate dev --name add-indexes-and-soft-delete`
- 本番: `npx prisma migrate deploy`（Vercel ビルド前フック or 手動）。
- インデックス追加は非破壊。`deletedAt` 追加も nullable のため既存行に影響なし。

## 1.5 補助的なクリーンアップ
- ルート直下の使い捨てスクリプト **`fix-members-2.js` を削除**（リポジトリから除去）。
- `next-auth` の型拡張で `session.user.id` を型付けし、`(session.user as any)` を撤廃。
- 乱択の品質: `rotation.ts` のシャッフルを Fisher–Yates に、乱数源を引数注入（テスト可能化）。※整合性影響は小、Phase 1 の末尾 or Phase 2 と並走で可。

---

# Phase 2: UX改善（フォーム離脱率）

## 2.1 共通: 保存フィードバック & 二重送信防止

### 課題
`members/page.tsx` ほか各フォームの `fetch` に loading/disabled/成功通知が無く、二重送信や無反応の不安を誘発。

### 対応
- 送信中は送信ボタンを `disabled`＋スピナー表示。
- 成功時トースト（軽量トーストを1つ導入: `sonner` 等）／失敗時はインラインエラー。
- 楽観的更新は副作用の少ない箇所（回答トグル）から段階導入。

```tsx
const [saving, setSaving] = useState(false);
async function handleSave() {
  setSaving(true);
  try {
    const res = await fetch(/* ... */);
    if (!res.ok) throw new Error((await res.json()).error ?? "保存に失敗しました");
    toast.success("保存しました");
    onDone();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "保存に失敗しました");
  } finally {
    setSaving(false);
  }
}
// <Button disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
```

## 2.2 アンケート（SurveyTab）のステップ化＋プリフィル

### 課題
ジャンル/エリア/予算を一画面で要求。前回値の引き継ぎなし。スマホで入力負荷高。

### 対応
- **1画面1設問のステップ式**（ジャンル → エリア → 予算 → 確認）。進捗バー表示。
- **プリフィル**: 同一ユーザーの直近 `SurveyResponse` を初期値に。
- ジャンルは複数選択チップ、予算は大きめのセグメントトグル（タップターゲット拡大）。
- 「あとで」ではなく各ステップ自動保存（途中離脱しても回答が残る）。

### データ面
既存 `SurveyResponse`（`@@unique([eventId,userId])`）を upsert。ステップ自動保存は部分更新を許容するため、未回答項目は null 許容のまま段階的に埋める。

## 2.3 日程調整（ScheduleTab）の回答UX

### 課題
`○△×` の回答が小さく、未回答が分かりにくい。回答後の保存反応が弱い。

### 対応
- 候補日ごとに大きな3トグル（○/△/×）。未回答候補をハイライト。
- 全候補回答で「送信」活性化、送信中スピナー、完了トースト。
- 通知からのディープリンクで該当イベントの日程タブに直接着地（`/lunch/[id]?tab=schedule`）。
- バック側は **1.1 のIDOR対策込み** で受ける。

## 2.4 モバイルレスポンシブ

### 課題
`members/page.tsx` のサマリ `grid-cols-4` 固定、横長テーブルがスマホで窮屈。

### 対応
- サマリ: `grid-cols-2 sm:grid-cols-4`。
- 一覧テーブル: モバイルではカード型に切替（`hidden sm:table` / `sm:hidden` のカード）。
- モーダルは画面高超過時にスクロール可能に（`max-h-[90vh] overflow-y-auto`）。

## 2.5 通知からの導線（ディープリンク）
- `Notification.message` に加え、遷移先URLを持たせて「ワンタップで当該フォームへ」。
  - スキーマ追加案: `Notification.linkUrl String?`（任意）。
  - 既存通知は影響なし（nullable）。

---

## 3. 実装計画 / マイルストーン

| 順序 | 作業 | 主な変更ファイル | 区分 |
|---|---|---|---|
| 1 | `api-auth.ts` 追加・主要APIを段階移行・ステータス統一 | `src/lib/api-auth.ts`, 各 `route.ts` | P1 |
| 2 | 日程回答IDOR封鎖＋comment/photo横展開 | `schedule/respond`, `comment`, `photo` | P1 |
| 3 | `deletedAt` 追加・論理削除化・取得側フィルタ・ログイン条件 | `schema.prisma`, `api/users`, `rotation.ts`, `select`, `auth.ts` | P1 |
| 4 | FKインデックス一括付与 + migrate deploy | `schema.prisma` | P1 |
| 5 | `fix-members-2.js` 削除・型拡張・シャッフル改善 | ルート, `types/`, `rotation.ts` | P1 |
| 6 | トースト導入＋保存フィードバック共通化 | `members`, 各Tab | P2 |
| 7 | SurveyTab ステップ化＋プリフィル | `tabs/SurveyTab.tsx`, `api/lunch/[id]/...` | P2 |
| 8 | ScheduleTab 回答UX＋ディープリンク | `tabs/ScheduleTab.tsx`, `Notification.linkUrl` | P2 |
| 9 | モバイルレスポンシブ調整 | `members`, 一覧/モーダル | P2 |

> マイグレーションは 3→4 をまとめて1本（`add-indexes-and-soft-delete`）にしてよい。

---

## 4. テスト計画

- **単体**: `selectionAlgorithm` / `rotation`（乱数源注入後）、`api-auth` のrole分岐。
- **認可テスト**: 日程回答API — 他イベントの `candidateId` 送信で400、非参加者で403、正常系で200。
- **論理削除テスト**: 履歴ありユーザーの削除が成功し、一覧から消え、過去sessionには氏名が残る。ログイン不可。
- **回帰**: `daily-finalize` Cron が論理削除導入後も当日処理を正しく行う（削除済みは選定対象外）。
- **手動E2E**: アンケート/日程フォームの途中離脱→再開で回答が保持される。

---

## 5. リスク / ロールバック

| リスク | 対策 |
|---|---|
| 取得側フィルタ漏れで削除済みユーザーが選定/ローテに混入 | grepチェックリストで全 `user.findMany/findFirst` を棚卸し。テストで担保 |
| API段階移行中のステータス変更でフロントが分岐ミス | フロントはステータスではなくメッセージ表示主体に。401/403はともにエラートースト |
| マイグレーション本番反映 | インデックス/nullable追加のみ＝非破壊。問題時は `migrate resolve` でロールフォワード |
| Vercelデプロイ（作者メール一致が必要） | 既存運用通り。CIでmigrate deployを分離 |

---

## 付録A: Phase 3 通知連携（先行設計・ツール未定）

### A.1 抽象設計（ツール非依存）
社内連絡が Slack/Teams どちらに集約しているかで実装アダプタのみ差し替える。共通インタフェースを定義。

```ts
// src/lib/notify/index.ts
export interface ChatNotifier {
  send(msg: { text: string; linkUrl?: string }): Promise<void>;
}
// 環境変数 NOTIFY_PROVIDER=slack|teams|none で実装を切替、Webhook URLは env 管理
```

- **Slack**: Incoming Webhook（最小）。将来Botでメンション/インタラクティブ。
- **Teams**: Incoming Webhook（Adaptive Card 可）。
- いずれも `NONE` 実装（no-op）を用意し、未設定環境でも安全に動作。

### A.2 配信トリガ（最小構成）
- `daily-finalize` Cron 末尾に「本日のスピーカー＆コメンテーター」を投稿。
- 日程調整: 締切N時間前に **未回答者がいる場合のみ** リマインド。
- ランチ確定時: 日時・店舗・参加者を確定通知。

### A.3 選定の判断材料
- 全社の通知が **Teams** に集約 → Teams Webhook 一択。
- 軽量・絵文字/スレッド文化が強い → Slack。
- まずは片方の Incoming Webhook（実装コスト「低」）で開始し、効果を見て拡張。

---

## 付録B: 今後検討（本設計スコープ外）

- 朝礼×ランチのシナジー（スピーチ振り返りから話題ルーレット自動生成、選定の重み連動）。
- 出欠連動の精算自動化（`settlement` を実参加人数で再計算）。
- ICS/Googleカレンダー連携。
- フォトアルバム/リアクション強化（`LunchPhoto`/`LunchComment` 活用）。
- ステータス類の Prisma `enum` 化（型安全・typo防止）。
