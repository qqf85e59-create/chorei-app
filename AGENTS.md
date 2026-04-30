<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 朝礼管理アプリ プロジェクト概要

仙台事務所の朝礼運営を支援する社内8名向けアプリ（日本語UI）。  
Next.js 16 / Prisma 6 / NextAuth v5 / Neon PostgreSQL / Vercel。

## 欠席処理ロジック

欠席申請は `src/lib/absence-logic.ts` に集約。

### 最低人数ルール
- **Phase 1**: 出席者合計 ≥ 3名（発話者 + 聴講者）
- **Phase 2/3**: 応答者 ≥ 4名
- いずれも下回ると `enforceMinimumAttendance` がセッションを自動中止

### Cascade Shift 仕様（発話者欠席時）
1. 当該セッションの `speakerId` を null に設定
2. 以降の同フェーズ sessions の speaker/topic を1つ前にシフト
3. 末尾に新規セッション枠を自動追加（`adminNote: '自動順送りによる追加枠'`）
4. 影響を受けた speaker に `Notification` レコードを作成

### Cascade Shift 逆操作（取消し時）
- `AbsenceRequest.originalSpeaker` が `true` の場合のみ発動
- speakers/topics を後方にシフトし、末尾の追加枠を削除
- 複数連続 cascade 後の取消しは完全復元困難（adminNote に警告）

### 取消し期限
- `canSelfCancel`: セッション日の **前日23:59:59 JST** が cutoff
- `Intl.DateTimeFormat` で Asia/Tokyo 固定計算（UTC 環境でも正確）
- Admin は期限関係なく取消し可能

### Attendance スナップショット
- `AbsenceRequest.previousAttendanceStatus` に申請前の status を保存
- 取消し時にスナップショットから復元（なければ `'present'`）

## 会議URL管理

### Config テーブル
- Key-Value ストア。現在は `meeting_url` キーのみ使用
- `getConfigValue` / `setConfigValue` で読み書き（`src/lib/config.ts`）

### ConfigHistory テーブル
- Config の変更履歴を自動記録（oldValue → newValue, changedBy, changedAt）
- Admin 向け履歴表示: `/api/config/meeting-url/history`

## 応答者事前表示

Phase 2/3 のセッションで、応答者（commentators）を事前にユーザーに表示する機能。

### 関連フィールド
- `Session.commentatorsUpdatedAt`: 応答者セットが最後に変更された日時
- `Session.commentatorsPreset`: `true` = 自動抽選済み（再抽選不要）

### CommentatorView テーブル
- `userId + sessionId` の unique ペア
- `seenAt`: ユーザーが応答者リストを最後に閲覧した日時
- `seenAt < commentatorsUpdatedAt` の場合、「変更あり」バッジを表示

### 抽選フロー
1. `/api/sessions/next-commentators` GET 時に応答者不足かつ未プリセットなら自動抽選
2. `prisma.$transaction` で排他制御（同時 GET による重複抽選防止）
3. 抽選後 `commentatorsPreset = true` に設定

## 通知システム

### Notification テーブル
- `userId`, `sessionId?`, `type`, `message`, `createdAt`, `readAt?`
- `type`: `'speaker_change'` など
- cascade shift 時に自動作成

### UI
- ヘッダーのハンバーガーボタン隣にベルアイコン + 未読数バッジ（#DC2626）
- `/home` ページにお知らせカード（最大5件）

## API エラーハンドリング

全 API ルートの export async function は最外層に try/catch を配置:
```typescript
catch (err) {
  console.error('[API route name]', err);
  return NextResponse.json(
    { error: 'Internal Server Error', detail: (err as Error).message },
    { status: 500 }
  );
}
```
