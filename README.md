This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## デプロイ手順

### 本番環境

- **ホスティング**: Vercel (chorei-app-ebon)
- **データベース**: Neon PostgreSQL
- **Production Branch**: `main`

### ブランチ名の恒久変更（初回のみ）

ローカルの `master` ブランチを `main` に改名し、Vercel の Production Branch と一致させます。

```bash
# 1. ローカルブランチ名を main に変更
git branch -M main

# 2. main を origin の default push 先に設定
git push -u origin main

# 3. GitHub でデフォルトブランチを main に変更（Settings > Branches）

# 4. 旧 master ブランチを削除
git push origin --delete master
```

### 通常のデプロイ手順

```bash
git add .
git commit -m "変更内容"
git push origin main
```

Vercel が `main` へのプッシュを検知し、自動デプロイが実行されます。

### スキーマ変更時

Prisma スキーマを変更した場合、デプロイ前に以下を実行:

```bash
# Neon PostgreSQL に直接スキーマを適用（マイグレーション不要）
npm run db:push
```

### 環境変数

| 変数名 | 用途 |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL 接続 (pooled) |
| `DIRECT_URL` | Neon PostgreSQL 直接接続 |
| `AUTH_SECRET` | NextAuth 暗号化キー |
| `NEXTAUTH_URL` | アプリの公開URL |
