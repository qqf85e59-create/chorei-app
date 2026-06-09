# ランチ主催者ロール・マスタ整備・日程簡素化・api-auth展開 設計書（Antigravity 実行用）

> 本書は AI コーディングエージェント（Antigravity）に渡して順次実装させる実行用設計書である。
> 各タスクは「目的 / 対象ファイル / 変更内容 / 受け入れ条件」で構成する。
> 【要判断】は勝手に確定せず確認を求めること。
> 作成日: 2026-06-09 ／ 対象リポジトリ: `chorei-app`（Next.js App Router / TypeScript / Prisma + PostgreSQL(Neon) / NextAuth(JWT) / Tailwind）

---

## 0. 前提・確定仕様（依頼者と合意済み）

1. **ランチ主催者ロール**: `User.lunchRole`（`organizer | participant`）を新設。chorei の `role`(admin/member) とは**独立**。
   - 水谷・篠原 = `organizer`（ランダム抽選の対象外。常に当番側）。
   - 上記2名以外の全員 = `participant`（氏家含む。抽選対象になりうる）。
2. **朝礼運営 `role`**: 既定は**水谷のみ `admin`**、他は `member`。参加者管理（既存のrole選択）で変更可能。
3. **日程調整**: ○△×の候補投票を**廃止**し、admin が「確定日」を入力するだけに簡素化（アプリ外で日程調整するため）。
4. **等級体系**: 新体系 `2 → 3 → 3+ → 4 → 4+ → 5 → 6 → 7`（昇順）に**全面置換**。現状の `E2a` 等は廃止。
5. **職種コード**: `a → c → mc → m`（昇順、+`e`=エキスパート）。コードと名称を保持。
6. **マスタ追加項目**: 社員番号 / フリガナ / 職種（コード＋名称）。※勤務地・部門・在籍区分は**追加しない**。
7. **データ投入**: 後掲9名を**メール一致で upsert 同期**。表に存在しない既存ユーザーは**論理削除**（`deletedAt`）。
8. **休職/遠隔**: 在籍区分・勤務地では自動制御しない。全員 `choreiStatus='active' / lunchStatus='active'` で投入し、運用で手動調整。
9. **共通制約**: 既存スタック・日本語UI・配色トークンを維持。`User.id` は cuid(String)（`parseInt` 禁止）。新規 User 取得クエリには `deletedAt: null` を付与。1コミット=1論点・コミットメッセージにタスクID。

### ⚠️ 実行前の必須確認
- **同期で消えるユーザーに注意**: P2 の同期は「9名のメールに無い既存ユーザーを論理削除」する。**現在ログイン中の管理者(水谷: `mizutaniyu@attax.co.jp`)が9名に含まれること**を確認してから実行する。テスト用アカウントが消える可能性を依頼者に提示する。

---

## Phase 1: スキーマ拡張（lunchRole・マスタ項目・等級定数）

### P1-1. User モデルへのフィールド追加
- **目的**: ランチ主催者ロールとマスタ項目を保持する。
- **対象**: `prisma/schema.prisma`
- **変更内容**: `User` に以下を追加。
  ```prisma
  model User {
    // ...existing...
    lunchRole      String  @default("participant") // "organizer" | "participant"
    employeeNumber String? @unique                 // 社員番号
    kana           String?                          // フリガナ
    jobCode        String?                          // "a"|"c"|"mc"|"m"|"e"
    jobTitle       String?                          // 職種名称
    @@index([lunchRole])
  }
  ```
- **マイグレーション**: `npx prisma migrate dev --name add-lunchrole-and-master-fields`（追加のみ＝非破壊）。本番は `migrate deploy`。
- **型拡張**: `src/types/index.ts`(next-auth型) に必要なら `lunchRole` を追加（セッションで使うなら）。
- **受け入れ条件**: migrate 成功。既存行は `lunchRole='participant'`、追加列は null で影響なし。`tsc --noEmit` がパス。

### P1-2. 等級体系の全面置換
- **目的**: 等級を新体系に統一し、朝礼ローテの並び順も新体系で計算する。
- **対象**: `src/lib/constants.ts`、参照箇所（`src/lib/rotation.ts`、`members/page.tsx` の既定値、`GRADE_LABELS` 利用箇所全般）。
- **変更内容**:
  ```ts
  // constants.ts
  export const GRADE_ORDER = ['2', '3', '3+', '4', '4+', '5', '6', '7'] as const;
  export const GRADE_LABELS: Record<string, string> = {
    '2': '等級2', '3': '等級3', '3+': '等級3+', '4': '等級4',
    '4+': '等級4+', '5': '等級5', '6': '等級6', '7': '等級7',
  };
  // 職種コード（昇順）
  export const JOB_CODE_ORDER = ['a', 'c', 'mc', 'm', 'e'] as const;
  export const JOB_LABELS: Record<string, string> = {
    a: 'アナリスト', c: 'コンサルタント', mc: 'マネージングコンサルタント',
    m: 'マネージャー', e: 'エキスパート',
  };
  ```
  - `rotation.ts` の Round1 ソートは新 `GRADE_ORDER` を参照（ロジック自体は不変、配列の中身のみ変更）。
  - `members/page.tsx` の grade 既定値 `'E3a'` → `'3'` に変更。
- **【要判断】**: 旧等級(E2a等)の既存データが残る場合のマッピング。→ P2 の同期で9名は新等級に上書きされ、表外ユーザーは論理削除されるため、原則マッピング不要（残存する非対象ユーザーがいなければ無視可）。
- **受け入れ条件**: 参加者管理の等級セレクトが新8区分になる。朝礼ローテ生成(Round1)が新等級の昇順で並ぶ。`GRADE_LABELS` 由来の表示が壊れない。

---

## Phase 2: マスタデータ同期（9名 upsert ＋ 余剰論理削除）

### P2-1. 同期 seed スクリプト
- **目的**: 実在の9名を正としてユーザーマスタを同期する。
- **対象**: `prisma/seed-roster.ts`（新規）＋ `package.json` に実行スクリプト追加。
- **投入データ（メールを一意キーに upsert）**:

  | 社員番号 | 氏名 | フリガナ | 等級 | jobCode | jobTitle | email | role | lunchRole |
  |---|---|---|---|---|---|---|---|---|
  | 4017 | 氏家 浩則 | ウジイエ ヒロノリ | 6 | mc | マネージングコンサルタント | ujiieh@attax.co.jp | member | participant |
  | 3892 | 篠原 俊伍 | シノハラ シュンゴ | 4+ | mc | マネージングコンサルタント | shinohara@attax.co.jp | member | organizer |
  | 4048 | 水谷 友哉 | ミズタニ ユウヤ | 4 | c | コンサルタント | mizutaniyu@attax.co.jp | admin | organizer |
  | 4005 | 門田 美由紀 | カドタ ミユキ | 3+ | a | アナリスト | kadota@attax.co.jp | member | participant |
  | 4109 | 栗田 駿人 | クリタ ハヤト | 3 | c | コンサルタント | kurita@attax.co.jp | member | participant |
  | 4077 | 笹原 蓮也 | ササハラ レンヤ | 3 | c | コンサルタント | sasaharar@attax.co.jp | member | participant |
  | 4168 | 佐藤 翼 | サトウ ツバサ | 3 | c | コンサルタント | satot@attax.co.jp | member | participant |
  | 4128 | 日高 怒保 | ヒダカ ユキホ | 2 | c | コンサルタント | hidaka@attax.co.jp | member | participant |
  | 4171 | 佐藤 駿 | サトウ シュン | 2 | c | コンサルタント | satosh@attax.co.jp | member | participant |

- **変更内容**:
  1. 各行を `prisma.user.upsert({ where: { email }, update: {...}, create: {...} })`。
     - `choreiStatus='active'`、`lunchStatus='active'` で投入（休職の笹原・東京の門田も active。手動調整前提）。
     - **新規作成時のみ** `password` を初期値（環境変数 `INITIAL_PASSWORD` 等。ソース直書き禁止）でハッシュ化して設定。既存ユーザーのパスワードは**上書きしない**。
     - `deletedAt: null` を update に含め、過去に論理削除された該当者を復活させる。
  2. **余剰ユーザーの論理削除**: 9名のメール集合に含まれない既存ユーザーを `deletedAt=new Date(), choreiStatus='inactive', lunchStatus='inactive'` に更新（物理削除しない）。
- **受け入れ条件**:
  - 実行後、9名が新マスタ項目（社員番号/フリガナ/等級/職種/lunchRole/role）で登録される。
  - 水谷 = `role:'admin', lunchRole:'organizer'`、篠原 = `role:'member', lunchRole:'organizer'`、他7名 = `participant`。
  - 既存パスワードが保持され、9名は引き続きログイン可能。
  - 9名以外の既存ユーザーは一覧から消える（論理削除）。冪等（再実行で差分なし）。

---

## Phase 3: lunchRole の配線（抽選・主催者選択）

### P3-1. 選定アルゴリズムの対象を lunchRole 基準に変更
- **目的**: 抽選候補から主催者(organizer)を外す。
- **対象**: `src/app/lunch/[id]/select/route.ts`（`activeStaff` 取得条件）、`src/app/lunch/[id]/page.tsx`（`activeStaff` 取得条件）。必要なら `src/lib/selectionAlgorithm.ts`。
- **現状**: `where: { lunchStatus: 'active', role: 'member', deletedAt: null }` で抽選母集団を作成。これだと「role=memberだがlunchRole=organizerの篠原」が候補に入ってしまう。
- **変更内容**:
  - 抽選母集団の条件を **`{ lunchStatus: 'active', lunchRole: 'participant', deletedAt: null }`** に変更（`role` 条件は撤去）。
  - **抽選人数を 4 → 3 に変更**。`src/lib/selectionAlgorithm.ts` の `selectCount` 既定値、および `src/app/lunch/[id]/select/route.ts:48` の `selectParticipants(..., 4)` 呼び出しを `3` にする。
- **受け入れ条件**: メンバー選定の抽選候補に水谷・篠原が**一切現れない**。氏家を含む participant 7名が候補になり、**3名**が選ばれる（主催者を加えた1回の参加は計4名）。

### P3-2. 新規ランチ会の主催者をログインユーザーに自動設定（当番選択を廃止）
- **目的**: 「主催者はログインしている本人」なので、当番セレクトを廃止して入力を1ステップ減らす。
- **対象**: `src/app/lunch/new/page.tsx`、`src/app/lunch/new/NewLunchForm.tsx`、`src/app/api/lunch/route.ts`(POST)。
- **現状**: フォームに「当番（主催者）」セレクトがあり、`organizerId` を選んで送信している。
- **変更内容**:
  1. NewLunchForm から当番セレクトを**削除**。送信ボディは `{ title }` のみ。
  2. `POST /api/lunch` で `organizerId` を**ログインセッションの `session.user.id`** から取得して保存（ボディの organizerId は受け取らない）。
  3. 作成は **lunchRole='organizer' のユーザー（水谷・篠原）のみ許可**。それ以外がアクセスした場合は 403（ページ側でもガード）。
  4. `lunch/new/page.tsx` の当番候補取得・交代ロジックは不要になるため削除。
- **【要判断】**: 主催者の交代運用（水谷⇄篠原の輪番）をアプリで補助しないでよいか。本人がログインして作成する運用なら不要、と解釈。
- **受け入れ条件**: 新規作成画面に当番セレクトが無い。作成された `LunchEvent.organizerId` がログイン中の主催者本人になる。participant がこの画面に来ると弾かれる。

---

## Phase 4: 参加者管理（マスタ）UI 拡張

### P4-1. ユーザーAPIに新項目を通す
- **目的**: 新フィールドを取得・作成・更新できるようにする。
- **対象**: `src/app/api/users/route.ts`
- **変更内容**:
  - GET の `select` に `employeeNumber, kana, jobCode, jobTitle, lunchRole` を追加。
  - POST/PUT で `employeeNumber, kana, jobCode, jobTitle, lunchRole` を受理・保存。
  - （P5 と独立だが）このルートも Phase 6 の api-auth ヘルパに載せ替える。
- **受け入れ条件**: 一覧APIが新項目を返す。作成・更新で新項目が保存される。

### P4-2. 参加者管理ページの一覧・フォーム拡張
- **目的**: 等級・社員番号・フリガナ・職種を一覧表示し、編集できるようにする。
- **対象**: `src/app/members/page.tsx`
- **変更内容**:
  1. テーブル列に「社員番号」「フリガナ」「職種」を追加（既存の名前/等級/メール/権限/朝礼参加/ランチ参加/操作に加える）。等級は新ラベル表示。
  2. 職種は `JOB_LABELS[jobCode]` で名称表示（コード併記可）。
  3. 編集モーダルに `employeeNumber / kana / jobCode(セレクト) / jobTitle` 入力と、**「ランチ主催者(lunchRole)」セレクト**（organizer/participant）を追加。
  4. 等級セレクトは新 `GRADE_ORDER`。
  5. モバイル対応（列増による横溢れ）: 横スクロール維持、または重要列のみ表示＋詳細はモーダル。
- **【要判断】**: 列が増えるため、一覧に出す列の優先順位（PCは全列／スマホは名前・等級・職種・操作のみ等）。推奨はスマホで主要4列。
- **受け入れ条件**: 一覧に社員番号・フリガナ・職種・等級が表示される。編集で lunchRole を含む全項目を変更・保存できる。

---

## Phase 5: 日程調整タブの簡素化（確定日入力のみ）

### P5-1. ScheduleTab を「確定日入力＋確定表示」に置換
- **目的**: ○△×投票・候補追加UIを廃止し、admin が確定日を入力するだけにする。
- **対象**: `src/app/lunch/[id]/tabs/ScheduleTab.tsx`
- **現状**: 候補追加フォーム＋○△×投票＋候補ごとの確定ボタンがある（[ScheduleTab.tsx](src/app/lunch/[id]/tabs/ScheduleTab.tsx)）。
- **変更内容**:
  1. 候補追加フォーム・メンバーの○△×投票UI・候補一覧/集計表示を**削除**。
  2. admin 向けに「確定日」入力（`<input type="date">`。下記【要判断】参照）と「確定する」ボタンを設置。送信は既存の `PATCH /api/lunch/{id}`（`{ confirmedDate, status: 'scheduled' }`）を流用。
  3. 非adminには確定日の**表示のみ**（`event.confirmedDate` を整形表示。未確定なら「日程調整中」）。
  4. 確定後に admin が日付を変更できる導線（再編集）を残す。
- **【要判断】**: 確定日の粒度。`confirmedDate` は `DateTime` 型。「何日に確定したか」だけなら **date のみ（時刻なし、00:00保存）** を推奨。時刻も要るなら `datetime-local`。
- **受け入れ条件**:
  - admin が確定日を入力→保存で `confirmedDate` がセットされ `status='scheduled'` になり、一覧/ダッシュボードのステータスに反映される。
  - 参加者は確定日を閲覧でき、入力UIは出ない。
  - ○△×投票UI・候補追加UIが画面から消える。

### P5-2.（任意）不要となった日程APIの整理
- **対象**: `src/app/api/lunch/[id]/schedule/route.ts`（候補追加）、`src/app/api/lunch/[id]/schedule/respond/route.ts`（○△×回答）。
- **方針**: UIから呼ばれなくなるが、**モデル(`ScheduleCandidate`/`ScheduleResponse`)とテーブルは残す**（破壊的migration回避）。API は当面残置でよい。将来削除する場合は別タスクで。
- **受け入れ条件**: 残置でもビルド・型に影響がないこと。

---

## Phase 6: api-auth ヘルパの全ルート展開

### P6-1. 全 API Route を `requireUser` / `requireAdmin` に統一
- **目的**: 認可ボイラープレートを集約し、401/403 を統一する。
- **対象**: `src/app/api/**/route.ts`（全27ルート）。ヘルパは既存の `src/lib/api-auth.ts`。
- **現状**: 5ファイルのみ採用済み。残り約18ファイルが `auth()` + inline role判定のまま、401/403が混在。
- **変更内容**:
  1. 各ルートの先頭で `const session = await requireUser();`（要ログイン）または `await requireAdmin();`（admin限定）を使用。
  2. `ApiError` を `handle()` ラッパ、または各ルートの `try/catch` で捕捉し `{status}` を返す。
  3. **未認証=401 / 権限不足=403** に統一（現状 admin拒否が401の箇所を403へ）。
  4. cron ルート（`/api/cron/*`）は CRON_SECRET 認証のため対象外（現状維持）。
- **対象ルート（inline判定が残るもの。grepで最終確認）**: `alerts`, `attendance`, `config/meeting-url`, `config/meeting-url/history`, `holidays`, `notifications`, `phases`, `rotation/generate`, `sessions`, `sessions/commentators`, `sessions/comment-order`, `sessions/mark-viewed`, `sessions/next-commentators`, `topics`, `lunch`(route), `lunch/[id]`, `lunch/[id]/schedule`, `lunch/[id]/select`, `lunch/[id]/settlement`, `lunch/[id]/comment`, `lunch/[id]/photo`, `lunch/[id]/survey`, `users` ほか。
- **受け入れ条件**:
  - `grep -rln "session.user.role !== 'admin'" src/app/api` の結果が **0件**（cron除く）。
  - 各保護ルートが未ログインで401、権限不足で403を返す。
  - 既存の正常系の挙動・レスポンス形は不変。`tsc --noEmit` パス。

---

## Phase 7: 利用店舗の履歴ページ（新規）

> 背景: 現状、利用した店舗を一覧で振り返れる場所が無い。`Restaurant` は `visitCount` / `lastVisited` を持つが、各ランチ会の RestaurantTab 内でしか見えない。

### P7-1. 利用店舗一覧/履歴ページ
- **目的**: 過去に利用した店舗を一覧で確認し、重複来店を避ける材料にする。
- **対象**: `src/app/restaurants/page.tsx`（新規）、ナビ（`src/components/header.tsx`）、必要なら `GET /api/restaurants`（新規 or 既存利用）。
- **変更内容**:
  1. レストランマスタを一覧表示（店名・ジャンル・エリア・訪問回数・最終利用日・URL/地図リンク）。
  2. 並び替え（最終利用日が古い順／訪問回数順）とジャンル絞り込み。
  3. 各店の「利用したランチ会」リンク（`LunchEvent.restaurantId` 経由で開催回を辿れる）。
  4. ナビ「ランチ管理」配下、または `/history` ページ内のタブ/リンクとして入口を設置（lunchStatus=active＋adminのみ表示、Phase 1 準拠）。
- **【要判断】**: 独立ページ（`/restaurants`）にするか、ランチ管理一覧ページ内のタブにするか。推奨は独立ページ＋一覧からのリンク。
- **受け入れ条件**: 利用実績のある店舗が訪問回数・最終利用日付きで一覧表示され、そこから該当ランチ会へ辿れる。

---

## Phase 8: 運営ワークフローの進捗可視化・アンケート未回答の可視化（新規）

> 想定フロー: **①参加者が月末までにアンケート回答 → ②主催者がスケジュール登録＋飲食店予約 → ③経費精算（任意タイミング・本人リマインド用）**。この進捗が一目で分かる場所が欲しい。アンケートは「誰が未回答か」を見えるようにする。

### P8-1. ランチ会の進捗ステータス表示（ステップインジケータ）
- **目的**: 各ランチ会が今どのステップにあるかを主催者・参加者が把握できる。
- **対象**: `src/app/lunch/[id]/page.tsx`（詳細ヘッダ）、`src/app/lunch/[id]/LunchManagementTabs.tsx`、ダッシュボード/ホームの進行中カード（既存）。
- **変更内容**:
  1. 詳細ページ上部に4ステップのインジケータを表示し、各ステップの完了/進行中を判定:
     - **アンケート**: 参加者全員が `SurveyResponse` を提出 → 完了。一部 → 進行中（回答 n/N）。
     - **メンバー選定**: `Participation` が確定（主催者＋3名）→ 完了。
     - **日程・店舗**: `confirmedDate` かつ `restaurantId` がセット → 完了。
     - **経費精算**: `Settlement` が存在し `status='paid'` → 完了（任意ステップ＝未了でも警告にしない）。
  2. ステップ判定ロジックは `lib` に純関数として切り出す（例: `lib/lunch-progress.ts`、テスト可能化）。
  3. ダッシュボード/ホームの「進行中のランチ会」カードに、現在ステップと次アクション（例:「アンケート回答待ち 2/3」）を表示。
- **受け入れ条件**: 詳細ページで4ステップの進捗が色分け表示される。判定が実データ（Survey/Participation/confirmedDate/restaurant/Settlement）と一致する。

### P8-2. アンケート未回答者の可視化
- **目的**: 主催者が「誰が未回答か」を把握し、督促できるようにする。
- **対象**: `src/app/lunch/[id]/tabs/SurveyTab.tsx`、必要なら `GET /api/lunch/[id]/survey`。
- **変更内容**:
  1. admin 表示時、対象母集団（その回の `Participation` の参加者、または lunchStatus=active の participant）に対して **回答済み/未回答** を一覧表示。
  2. 未回答者を明示（バッジ「未回答」）し、回答率（n/N）を表示。
  3. （任意・将来）未回答者へのリマインド導線（通知 or コピー用リスト）。
- **【要判断】**: アンケートの母集団は「その回の選定参加者(Participation)」か「lunchStatus=active の participant 全員」か。フロー上「回答→選定」の順なら、母集団は**選定前の active participant 全員**が自然。要確認。
- **受け入れ条件**: admin が未回答者と回答率を確認できる。

---

## 付録0: 本セッションで適用済みの即時修正（実装済み・antigravity再対応不要）

- **ボタンがホバーで消えるバグの修正**: ランチ系コンポーネントが使う `var(--color-sub)` / `var(--color-panel)` が `globals.css` に未定義で、`hover:bg-[var(--color-sub)]` がホバー時に透明化していた。`src/app/globals.css` の `:root` に `--color-primary/-sub/-accent/-panel` を定義して解消（値は既存ブランド色と一致）。
- **抽選人数 4→3**: `src/lib/selectionAlgorithm.ts` の `selectCount` 既定値と `src/app/api/lunch/[id]/select/route.ts` の呼び出しを `3` に変更（P3-1 の人数部分は完了）。
- **当番セレクト廃止／主催者＝ログイン本人**: `NewLunchForm.tsx`（セレクト削除・`{title}`のみ送信）、`lunch/new/page.tsx`（候補取得・交代ロジック削除、`admin`or`lunchRole='organizer'`でガード）、`api/lunch/route.ts` POST（`organizerId = session.user.id`、作成可は admin/organizer）。P3-2 は実装完了。
- **セッションに `lunchRole` を追加**: `src/lib/auth.ts`（authorize/jwt/session）と `src/types/next-auth.d.ts` に `lunchRole` を追加。
- 上記後 `npx tsc --noEmit` は EXIT 0。

> なお **P8-2（アンケート未回答者の可視化）は既に実装済み**であることを確認（`SurveyTab.tsx` が母集団に対し「未回答」を表示。選定前は activeStaff、選定後は participants を母集団に切替）。Phase 8 では締切表示（下記 P9-4）と進捗インジケータ（P8-1）が残タスク。

---

## Phase 9: 追加レビュー反映（依頼者が採用した項目）

### P9-1. 同月重複イベントの作成防止
- **目的**: 同じ月のランチ会を二重作成できてしまう不具合を防ぐ（実データで「June」2件の重複が発生）。
- **対象**: `src/app/api/lunch/route.ts`(POST)、`NewLunchForm.tsx`（UI警告）。
- **変更内容**: 作成時、同一 `title`（＝同月）の `status in ['planning','scheduled']` イベントが既存なら **409 を返し作成を拒否**。フォーム側は「今月のランチ会は既に存在します」を表示。
- **受け入れ条件**: 同月2件目の作成が拒否される。異なる月は作成可。
- **難易度**: 低 ／ **効果**: 中（重複・混乱の防止）。

### P9-2. タイトルに年を含める
- **目的**: 来年同月（例: 2027 June）と区別する。
- **対象**: `src/app/lunch/new/NewLunchForm.tsx`（`generateMonthOptions` の `title`）。
- **変更内容**: タイトルを `仙台Synergy Bites {YYYY} {Month}` 形式に変更（例: `仙台Synergy Bites 2026 June`）。P9-1 の重複判定キーも年付きタイトルで行う。
- **受け入れ条件**: 生成タイトルに西暦が入る。年跨ぎで同月名でも別イベントとして扱える。
- **難易度**: 低 ／ **効果**: 中。

### P9-3. 日程・店舗確定時のアプリ内通知
- **目的**: 主催者が日程/店舗を確定したら参加者に伝わるようにする。
- **対象**: `src/app/api/lunch/[id]/route.ts`(PATCH で `confirmedDate`/`restaurantId`/`status='scheduled'` 更新時)、`Notification` モデル（既存）、ホーム/ベル表示（既存）。
- **変更内容**: 確定の PATCH 時に、その回の `Participation` 参加者全員へ `Notification` を作成（type: `lunch_confirmed`、message: 「{タイトル}の日程が{日付}に確定しました（店舗: {店名}）」）。`linkUrl` に `/lunch/{id}` を付与（[[improvement-design-2026-06]] の Notification.linkUrl 追加と整合）。
- **受け入れ条件**: 確定後、参加者のお知らせ/ベルに通知が出る。リンクから該当ランチ会へ遷移できる。
- **難易度**: 低〜中 ／ **効果**: 高（連絡の自動化）。

### P9-4. アンケート締切の表示と督促
- **目的**: 「月末まで」の締切を明示し、未回答者の督促を促す。
- **対象**: `src/app/lunch/[id]/tabs/SurveyTab.tsx`、必要なら `LunchEvent` に `surveyDeadline DateTime?` 追加（【要判断】）。
- **変更内容**:
  1. アンケートタブ上部に締切日を表示（既定: その回の対象月の月末。または `surveyDeadline` を主催者が設定）。
  2. 締切超過時の強調表示。未回答者一覧（実装済み）に締切と回答率(n/N)を併記。
  3. （任意）未回答者へのリマインド導線（P9-3 の通知基盤を流用）。
- **【要判断】**: 締切を「対象月の月末」固定にするか、主催者が任意設定（`surveyDeadline` カラム追加）にするか。
- **受け入れ条件**: 締切がアンケート画面に表示され、超過が分かる。
- **難易度**: 低〜中 ／ **効果**: 中（回答率向上）。

### P9-5. 経費精算の本人リマインド
- **目的**: 精算忘れ防止。本人が任意タイミングで自分宛のリマインドを設定できる。
- **対象**: `Settlement` 周辺、`Notification`、新規 `Reminder` モデル or 既存 Notification の予約投稿。
- **変更内容**:
  1. 精算（SettlementTab 復活が前提のため【要判断】）または該当ランチ会の画面で、本人が「{日時}にリマインド」を設定。
  2. 指定日時に本人宛 `Notification` を作成（cron で配信、または `daily-finalize` cron に相乗り）。
- **【要判断】**: 精算タブは現在無効（スコープ外）。リマインドUIを精算タブに置くなら精算タブ復活が前提。独立した「マイ・リマインド」として置くことも可。配置を要確認。
- **受け入れ条件**: 設定した日時に本人へ通知が届く。
- **難易度**: 中 ／ **効果**: 中。

### P9-6. 参加回数の偏り可視化
- **目的**: 誰が何回参加したかを可視化し、選定の公平性を担保する。
- **対象**: 参加者管理（`/members`）または専用パネル、`Participation` の集計。
- **変更内容**: 各ユーザーの「ランチ参加回数（`Participation` 件数, 主催除く）」と「最終参加回」を集計表示。選定アルゴリズムは既に直前回を抑制(weight 0.3)するが、累計の偏りを運用が目視できるようにする。
- **受け入れ条件**: ユーザー別の参加回数が一覧で確認できる。
- **難易度**: 低〜中 ／ **効果**: 中（公平性・納得感）。

---

## 付録A: 推奨実装順
1. **Phase 6（api-auth展開）** — 独立・低リスク。先に消化可。
2. Phase 1（スキーマ＋等級定数） → Phase 2（同期seed） → Phase 3（lunchRole配線）
3. Phase 4（マスタUI） → Phase 5（日程簡素化）

- マイグレーションは Phase 1 の1本（`add-lunchrole-and-master-fields`、非破壊）。Phase 2 はデータ操作のみ。
- 各 Phase 完了時に `npx tsc --noEmit` と主要画面の手動確認（作成→選定→確定→一覧ステータス）を行う。

## 付録B: 留意点
- `User.id` は cuid。`lunchRole`/`role` は別軸（role=朝礼運営、lunchRole=ランチ当番）。混同しないこと。
- 同期(P2)は破壊的になりうる（余剰ユーザー論理削除）。実行前に対象差分をログ出力し、依頼者承認の上で実行する運用を推奨。
- 「閲覧者」= `lunchStatus='active'`（＋admin）。入力可否= その回の `Participation`。この二段制御は実装済みのため本書では変更しない。
- 既存の改善設計書（`docs/design/2026-06_improvement-design.md`）・ランチ統合設計書（`docs/design/lunch-integration_antigravity.md`）と整合。精算/振り返りタブの復活は引き続きスコープ外。
