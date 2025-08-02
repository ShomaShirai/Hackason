/// <reference types="@cloudflare/workers-types" />

// グローバル型定義
declare global {
  // Cloudflare Workers型
  const D1Database: typeof D1Database;
  
  // 環境変数の型定義（process.envの代替）
  interface ImportMetaEnv {
    readonly MODE: 'development' | 'production' | 'test';
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// モジュール宣言
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// この行により、このファイルがモジュールとして扱われる
export {};