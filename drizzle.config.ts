import type { Config } from 'drizzle-kit';

export default {
  schema: './workers/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // ローカル開発: wrangler dev環境の実際のD1データベースファイル
    // 環境変数でオーバーライド可能
    url: process.env.DATABASE_URL || 'file:.wrangler/state/v3/d1/2b35d4d42e3c9f6b5ad5b5579a7b1470c66e69f6b33a31e3f5a0095cc6d18656.sqlite',
  },
} satisfies Config;
