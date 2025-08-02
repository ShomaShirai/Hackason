import type { Config } from 'drizzle-kit';

export default {
  schema: './workers/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // ローカル開発: wrangler dev環境の実際のD1データベースファイル
    // 環境変数でオーバーライド可能
    url: process.env.DATABASE_URL || 'file:./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/68ac3c8ac2484ab5dd28be90eb723c4cae2f05469e8abbac31b835ce3ae4af89.sqlite',
  },
} satisfies Config;
