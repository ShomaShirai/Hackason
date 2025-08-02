import type { Config } from 'drizzle-kit';

export default {
  schema: './workers/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // 正しいデータベースファイルを使用
    url: process.env.DATABASE_URL || 'file:./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/63a21fc2ced579087d11fa52d85ecd915d367073facc42cf86ca0c03c2b041ea.sqlite',
  },
} satisfies Config;
