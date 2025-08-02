import type { Config } from 'drizzle-kit';

export default {
  schema: './workers/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // 正しいデータベースファイルを使用
    url: process.env.DATABASE_URL || 'file:./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4e06e3b92174d6a1eb1962c54bba2bc97a274b2b3378ad576b6b409e387e5b38.sqlite',
  },
} satisfies Config;
