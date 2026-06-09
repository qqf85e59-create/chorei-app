# ランチ会機能 統合・改善 設計書（Antigravity 実行用）

> 本書は AI コーディングエージェント（Antigravity）に渡して順次実装させることを目的とした実行用設計書である。
> 各タスクは「目的 / 対象ファイル / 変更内容 / 受け入れ条件」で構成する。
> 不確実な仕様判断が必要な箇所には【要判断】を付し、勝手に確定せず確認を求めること。
> 作成日: 2026-06-09

---

## 0. 前提・対象・制約

### 対象リポジトリ
- `chorei-app`（Next.js App Router / TypeScript / Prisma + PostgreSQL(Neon) / NextAuth(JWT) / TailwindCSS / lucide-react / Vercel）
- 朝礼管理アプリにランチ会機能（「仙台Synergy Bites」）を統合した構成。

### 背景
- 元の単体ランチアプリ（SQLite・Member.id=Int）を chorei-app（PostgreSQL・User.id=cuid(String)）へ移植した。
- 移植時に **ID型の差異（Int→String cuid）** に起因する不具合と、一部機能の無効化が発生している。

### 全フェーズ共通の制約
1. 既存スタックを維持する（フレームワークや言語を勝手に置き換えない）。
2. UI 文言・画面はすべて日本語を維持する。
3. 配色トークン（`globals.css` の `--color-*`）を踏襲する。
4. **User.id は cuid(String)**、**LunchEvent.id / ScheduleCandidate.id 等は Int** である。ID をまたぐ際の型変換に注意する（`parseInt` を String の User.id に適用しない）。
5. 破壊的 migration を行う場合は事前に影響範囲を明示し承認を得る。本書のスコープに DB スキーマ変更は原則含まない（Phase 3 の一部で追加カラム提案あり＝【要判断】）。
6. 1コミット=1論点。コミットメッセージに対応タスクID（例 `P0-1`）を含める。
7. `deletedAt`（論理削除）は既に全 User クエリへ反映済み。新規に User を取得するクエリには `deletedAt: null` を付与すること。

### スコープ（依頼者と合意済み）
- **対象**: Phase 0（作成不具合の修正）／Phase 1（lunchStatus による表示制御）／Phase 2（ランチ会ステータスの可視化）／Phase 3（追加機能：朝礼×ランチ連携・レストラン推薦）。
- **対象外（今回やらない）**: 精算タブ(SettlementTab)・振り返りタブ(RecapTab) の復活配線。これらは現状コメントアウトのまま据え置く（付録Bにバックログとして記載）。

---

## Phase 0：作成不具合の修正（必須・最優先）

### P0-1. ランチ会の新規作成が必ず失敗する不具合の修正
- **目的**: 「作成に失敗しました」を解消し、ランチ会を作成可能にする。
- **対象**: `src/app/lunch/new/NewLunchForm.tsx`
- **原因**: 47行目付近で `organizerId: parseInt(organizerId)` を送信している。`organizerId` は `User.id`（cuid 文字列）であり、`parseInt("clx...")` が `NaN` → JSON で `null` 化 → `POST /api/lunch` の `if (!title || !organizerId)` で 400。
- **変更内容**:
  ```ts
  // 変更前
  body: JSON.stringify({ title: selectedMonth.title, organizerId: parseInt(organizerId) }),
  // 変更後
  body: JSON.stringify({ title: selectedMonth.title, organizerId }),
  ```
- **受け入れ条件**:
  - admin で `/lunch/new` から月と当番を選び「作成」すると 201 が返り、`/lunch/{id}` へ遷移する。
  - 作成された `LunchEvent.organizerId` がログイン中 admin の cuid と一致する。
  - コンソール／ネットワークに 400 エラーが出ない。

---

## Phase 1：lunchStatus による表示制御

> 要件: **「ランチ表示対象者（`User.lunchStatus === 'active'`）と admin にのみ、ランチ機能を表示する」**。
> ランチ対象外（`lunchStatus !== 'active'`）の参加者には、入口（ナビ）から隠す。
> 参加対象/対象外の切り替えは既存の **参加者管理（`/members`）の「ランチ参加」トグル**（`lunchStatus`）で行う（新規フラグは追加しない）。

### P1-1. ヘッダーナビ「ランチ管理」を lunchStatus で出し分け
- **目的**: ランチ対象外の参加者のメニューから「ランチ管理」を隠す。
- **対象**: `src/components/header.tsx`、必要なら `src/lib/auth.ts`（JWT/セッションへ `lunchStatus` を載せる）。
- **現状**: `navItems` の「ランチ管理」(`/history`) は全員に表示。`adminOnly` フラグはあるが `lunchStatus` 条件が無い。セッションにも `lunchStatus` が無い。
- **変更内容**:
  1. NextAuth に `lunchStatus` を載せる: `authorize()` の戻り値・`jwt` コールバック・`session` コールバックに `lunchStatus` を追加（`role` と同じ要領）。型は `src/types/index.ts` の `next-auth` 型拡張に `lunchStatus?: string` を追加。
  2. `header.tsx` の `NavItem` に `lunchOnly?: boolean` を追加し、「ランチ管理」に付与。表示条件を「`isAdmin || (item.lunchOnly && lunchStatus === 'active') || (!item.adminOnly && !item.lunchOnly)`」相当に拡張。
- **受け入れ条件**:
  - `lunchStatus='active'` の member と admin には「ランチ管理」が表示される。
  - `lunchStatus='inactive'` の member には表示されない。
  - 既存の朝礼系ナビの表示挙動は変わらない。
- **補足**: JWT は再ログインまで更新されない。`lunchStatus` 変更直後の反映は次回ログイン時で可とする（【要判断】：即時反映が必要なら別途検討）。

### P1-2. ランチ会一覧・詳細ページのアクセス制御を lunchStatus 基準に統一
- **目的**: URL 直叩きでもランチ対象外の参加者を弾く（ナビ非表示だけでは不十分）。
- **対象**: `src/app/history/page.tsx`（一覧）、`src/app/lunch/[id]/page.tsx` と `src/app/lunch/[id]/LunchManagementTabs.tsx`（詳細）、`src/proxy.ts`（任意）。
- **現状**: 詳細 `LunchManagementTabs` は「admin 以外かつ非参加者(isParticipant)」を弾く実装。要件は「admin もしくは lunchStatus=active」なので **判定基準を participant から lunchStatus へ変更**する。
- **変更内容**:
  1. サーバー側（`page.tsx`）で現在ユーザーの `lunchStatus` を取得し、`role !== 'admin' && lunchStatus !== 'active'` なら `/home` へ `redirect`。一覧 `history/page.tsx` も同様にガード。
  2. `LunchManagementTabs` の閲覧可否判定を `role === 'admin' || lunchStatus === 'active'` に変更（`isParticipant` は「編集可否」や「自分の回答行ハイライト」に用途を限定）。
  3. （任意）`src/proxy.ts` の保護対象に `/lunch` と `/history` を追加し、未ログインを弾く一次ガードを設ける（role/lunchStatus の細粒度判定はページ側）。
- **受け入れ条件**:
  - `lunchStatus='inactive'` の member が `/history` や `/lunch/{id}` を直接開くと `/home` にリダイレクトされる。
  - `lunchStatus='active'` の member は一覧・詳細を閲覧できる。
  - admin は従来どおり全操作可能。
- **【要判断】**: lunchStatus=active だが「その回の参加者でない」member に対し、詳細タブを **閲覧のみ（読み取り専用）** とするか、回答系も許可するか。推奨は「参加者でなければ閲覧のみ、回答・編集系の操作ボタンは非活性」。

### P1-3.（推奨・セキュリティ）日程回答 API の IDOR 封鎖
- **目的**: 任意の `candidateId` への書き込みを防ぐ。
- **対象**: `src/app/api/lunch/[id]/schedule/respond/route.ts`
- **現状**: URL の `id` と body の `candidateId` の所属検証、本人が参加者かの検証が無い。
- **変更内容**: `responses` 内の全 `candidateId` が当該 `eventId` に属することを検証（不一致は 400）。本人が `Participation` に存在しなければ 403。
  ```ts
  const ids = [...new Set(responses.map((r) => r.candidateId))];
  const ok = await prisma.scheduleCandidate.count({ where: { id: { in: ids }, eventId } });
  if (ok !== ids.length) return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
  const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  ```
- **受け入れ条件**: 他イベントの `candidateId` を含む回答は 400、非参加者は 403、正常系は 200。

---

## Phase 2：ランチ会ステータスの可視化

> 要件: **「今そのランチ会がどのステータス(planning/scheduled/completed/cancelled)なのかを確認できるようにする」**。
> `LunchEvent.status` は `planning | scheduled | completed | cancelled` の4値。

### P2-1. ランチ会一覧を「全ステータス表示＋ステータスバッジ」に改修
- **目的**: 進行中(planning)や中止(cancelled)も含め、状態が一目で分かる一覧にする。
- **対象**: `src/app/history/page.tsx`
- **現状**: `where: { status: { in: ['completed', 'scheduled'] } }` のため planning/cancelled が出ない。ステータス列も無い。
- **変更内容**:
  1. 取得条件から status フィルタを外し全件取得（`orderBy: { createdAt: 'desc' }`）。
  2. 一覧に「ステータス」列を追加し、バッジ表示する。日本語ラベルと色の対応:
     - `planning` → 「準備中」（黄）
     - `scheduled` → 「開催予定」（青）
     - `completed` → 「開催済み」（緑）
     - `cancelled` → 「中止」（灰）
  3. （任意）上部にステータス別の件数サマリ／フィルタチップ（全て・準備中・開催予定・開催済み・中止）を設置。
  4. ページ見出しを実態に合わせて「ランチ会一覧」等へ調整（現状「開催・お店履歴」）。
- **受け入れ条件**:
  - 4ステータスすべての `LunchEvent` が一覧に表示され、各行にステータスバッジが出る。
  - admin には従来どおり「＋新規作成」が表示される。
  - planning のイベント（店舗・開催日未定）も行が崩れず表示される。

### P2-2. ダッシュボード／ホームに「進行中のランチ会」ステータスカードを追加
- **目的**: ランチ管理ページへ行かずとも、現在進行中のランチ会の状態と次アクションを把握できる。
- **対象**: `src/app/dashboard/page.tsx`（admin）、`src/app/home/page.tsx`（member）。データ取得用に `GET /api/lunch`（既存）を利用、または現在進行イベント用の薄い API を追加。
- **変更内容**:
  - **admin（dashboard 右カラム）**: 「進行中のランチ会」カードを追加。直近の `status in [planning, scheduled]` のイベントを1件表示し、状態に応じた次アクションを提示:
    - planning: 「メンバー選定 / 日程調整へ」リンク
    - scheduled: 確定日・店舗・参加者数を表示、「詳細へ」
    - 進行中が無ければ「＋新規ランチ会を作成」CTA。
  - **member（home）**: 自分が参加者(Participation)である、または lunchStatus=active のとき、直近の進行中ランチ会の状態（例:「日程調整 受付中 — あなたは未回答」）と該当タブへのディープリンク（`/lunch/{id}?tab=schedule`）を表示。
- **受け入れ条件**:
  - admin ダッシュボードに進行中ランチ会の状態カードが出る（無ければ作成CTA）。
  - member ホームに、自分に関係する進行中ランチ会の状態が出る（無ければ非表示）。
  - 表示は lunchStatus / 参加者条件（Phase 1 準拠）を尊重する。

---

## Phase 3：追加機能（朝礼×ランチ連携・レストラン推薦）

### P3-1. 朝礼×ランチのシナジー（話題ルーレット連携）
- **目的**: 2機能を連動させ、会話のネタ供給と交流の偏り抑制を行う。
- **対象**: `src/app/lunch/[id]/tabs/TopicTab.tsx`、`src/app/api/topics/route.ts` 周辺、`src/lib/selectionAlgorithm.ts`。
- **変更内容（2サブ機能。どちらを採るかは段階導入可）**:
  1. **話題ルーレットの種を朝礼から供給**: ランチの話題案生成時に、直近フェーズの朝礼 `Topic.topicText`／振り返りを候補ソースに加える（「最近の朝礼テーマから1問」を混ぜる）。
  2. **選定の重みに朝礼活動を反映【要判断】**: ランチ参加者の重み付き抽選（`selectionAlgorithm`）に「最近朝礼でスピーチした人を軽く優先（または抑制）」の係数を追加。方向性（優先/抑制）と強さは要相談。
- **受け入れ条件**:
  - 話題案に朝礼由来の話題が混在して提示される。
  - （2 を採る場合）抽選結果が朝礼活動に応じて統計的に偏ることをテストで確認（乱数源を注入してテスト可能化）。
- **難易度**: 中 ／ **効果**: 中〜高（2イベントの相互送客・話題供給）。

### P3-2. レストラン推薦・履歴活用
- **目的**: admin の店選び負担を減らし、重複来店を抑制する。
- **対象**: `src/app/lunch/[id]/tabs/RestaurantTab.tsx`、`Restaurant`（`visitCount` / `lastVisited` 既存）、アンケート集計（`SurveyResponse` の genres/area/budget）。
- **変更内容**:
  1. RestaurantTab に「おすすめ候補」セクションを追加。アンケート集計（最多ジャンル・エリア・予算帯）と一致し、かつ `lastVisited` が古い／`visitCount` が少ない店舗を上位に並べる。
  2. 候補選択→確定時に `visitCount` を +1、`lastVisited` を更新（既存ロジックがあれば踏襲）。
  3. 直近N回で来店済みの店舗は「最近行きました」バッジで区別。
- **受け入れ条件**:
  - アンケート傾向に沿った候補が提示され、重複来店店舗が判別できる。
  - 店舗確定時に `visitCount` / `lastVisited` が更新される。
- **難易度**: 中 ／ **効果**: 中（運用負担減・体験向上）。

---

## 付録A: 実装順とコミット方針
1. **P0-1**（最優先・即修正）
2. P1-1 → P1-2 → P1-3（表示制御とセキュリティ）
3. P2-1 → P2-2（ステータス可視化）
4. P3-1 / P3-2（追加機能、依頼者の指示範囲で）

- マイグレーションは Phase 0〜2 では原則不要。P3 で `Restaurant` 等にカラム追加が必要になった場合のみ、影響範囲を提示し承認を得てから `prisma migrate`。

## 付録B: バックログ（今回スコープ外・将来検討）
- **精算タブ(SettlementTab)の復活**: `LunchManagementTabs.tsx` でコメントアウト中。復活させる場合、`SettlementTab.tsx` の `payerId: parseInt(payerId, 10)` は **バグ**（`Settlement.payerId` は cuid 文字列）。`payerId` を文字列のまま送るよう修正が必要。割り勘は「予定参加者数」ではなく「実参加者数」で割る改善余地あり。
- **振り返りタブ(RecapTab)の復活**: 写真・コメント投稿機能。同じくコメントアウト中。
- **通知/リマインド連携（Slack/Teams）**: 日程未回答者へのリマインド、確定通知。汎用 Webhook 抽象で設計可能（別設計書「2026-06_improvement-design.md」付録A参照）。
- **ステータス類の Prisma enum 化**: `status` / `response("○△×")` / `budget` 等の型安全化。

## 付録C: 既知の注意点（移植起因）
- `User.id` は cuid(String)。`LunchEvent.id` 等は Int。**`parseInt` を User 由来 ID に使わない**（P0-1・付録B の payerId が該当）。
- 新規 User 取得クエリには `deletedAt: null` を付与する（論理削除は適用済み）。
