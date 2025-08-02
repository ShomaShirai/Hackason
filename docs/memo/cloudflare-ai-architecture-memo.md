# Cloudflare AI アーキテクチャメモ

## 概要

本ドキュメントは、オンライン診療システムにおけるAI機能の実装について、Cloudflare Workers AIとその他のAIプロバイダーの使い分けに関する技術メモです。

## データベース選択（Hono + SQLite）

### 主要なORM選択肢

#### 1. **Drizzle ORM** (推奨)

```typescript
// 軽量で高速、TypeScript完全対応
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
```

**メリット**:

- Prismaより軽量（バンドルサイズ小）
- SQLライクな記法で学習しやすい
- エッジ環境（Cloudflare Workers等）で動作
- マイグレーション機能内蔵

#### 2. **Prisma**

```typescript
// schema.prisma
model User {
  id    Int     @id @default(autoincrement())
  name  String
}
```

**メリット**:

- 豊富な機能とエコシステム
- 優れた開発体験
- 型安全性が高い

**デメリット**:

- バンドルサイズが大きい
- エッジ環境での制限あり

#### 3. **Kysely** (SQLビルダー)

```typescript
import { Kysely, SqliteDialect } from 'kysely';

const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: new Database(':memory:'),
  }),
});
```

**メリット**:

- 純粋なSQLビルダー（ORMではない）
- 非常に軽量
- SQLの知識をそのまま活用可能

### ハッカソン向けの推奨

**Drizzle ORM**を推奨します：

1. **軽量性**: Honoとの相性が良い
2. **シンプル**: 学生にも理解しやすい
3. **柔軟性**: SQLの知識を活かせる
4. **エッジ対応**: Cloudflare Workersでも動作

```typescript
// Hono + Drizzle の例
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('medical.db');
const db = drizzle(sqlite);

const app = new Hono();

app.get('/users', async (c) => {
  const users = await db.select().from(usersTable);
  return c.json(users);
});
```

## Cloudflare Workers AIのローカル開発

### 1. **Wrangler（ローカル開発サーバー）**

```bash
# Wranglerをインストール
npm install -g wrangler

# ローカルで起動
wrangler dev
```

**現状**:

- Workers自体はローカルで動作可能
- ただし、Workers AIモデルはCloudflareのインフラ上でのみ動作
- ローカルではAI機能の**モック**が必要

### 2. **ローカル開発の制限**

```typescript
// wrangler.toml
name = "medical-app"
compatibility_date = "2024-01-01"

[ai]
binding = "AI"  # この機能はローカルでは完全に動作しない
```

### 3. **開発時の対応策**

#### A. ローカルモックを使用

```typescript
// ローカル開発用のモック
const isLocal = process.env.NODE_ENV === 'development';

export const getAI = () => {
  if (isLocal) {
    // OpenAI APIなど外部APIを使用
    return {
      run: async (model: string, input: any) => {
        const response = await fetch('https://api.openai.com/v1/...', {
          // OpenAI APIを呼び出し
        });
        return response.json();
      },
    };
  }
  // 本番環境ではWorkers AI
  return env.AI;
};
```

#### B. リモート開発環境を使用

```bash
# Cloudflareにデプロイして開発
wrangler deploy --env development

# tail でログを確認
wrangler tail
```

## ハッカソン向けの推奨構成

### 1. **ローカル開発優先**

```typescript
// 環境変数で切り替え
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';

// プロバイダー抽象化
interface AIProvider {
  transcribe(audio: ArrayBuffer): Promise<string>;
  complete(prompt: string): Promise<string>;
}

// 実装を切り替え
const aiProvider = AI_PROVIDER === 'cloudflare' ? new CloudflareAIProvider() : new OpenAIProvider();
```

### 2. **SQLiteの扱い**

```typescript
// ローカル: better-sqlite3
// Cloudflare: D1 (SQLite互換)

const db = isLocal ? new Database('./local.db') : env.DB; // D1 binding
```

### 3. **開発フロー**

1. **ローカル開発**: OpenAI API + SQLite
2. **ステージング**: Cloudflare Workers + Workers AI
3. **本番**: 同上

## 実践的な設定例

```toml
# wrangler.toml
name = "medical-hackathon"
compatibility_date = "2024-01-01"

# ローカル開発設定
[vars]
ENVIRONMENT = "development"
AI_PROVIDER = "openai"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "medical-db"
database_id = "xxxx"

# 開発環境
[env.development]
vars = { ENVIRONMENT = "development" }

# 本番環境
[env.production]
vars = { ENVIRONMENT = "production", AI_PROVIDER = "cloudflare" }

[ai]
binding = "AI"
```

## 音声書き起こしの実装

### 1. **ローカル開発時（OpenAI Whisper API）**

```typescript
// OpenAI Whisper APIを使用
async function transcribeLocal(audioBuffer: ArrayBuffer): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }));
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const result = await response.json();
  return result.text;
}
```

### 2. **Cloudflare Workers AI（Whisperモデル）**

```typescript
// Cloudflare Workers AIのWhisper
async function transcribeCloudflare(env: any, audioBuffer: ArrayBuffer): Promise<string> {
  // Workers AIのWhisperモデル
  const response = await env.AI.run('@cf/openai/whisper', {
    audio: [...new Uint8Array(audioBuffer)],
  });

  return response.text;
}
```

### 3. **統合実装パターン**

```typescript
// 環境に応じて切り替え
export class TranscriptionService {
  constructor(
    private env: any,
    private config: { provider: 'openai' | 'cloudflare' }
  ) {}

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    if (this.config.provider === 'openai') {
      return this.transcribeWithOpenAI(audioBuffer);
    } else {
      return this.transcribeWithCloudflare(audioBuffer);
    }
  }

  private async transcribeWithOpenAI(audioBuffer: ArrayBuffer): Promise<string> {
    // OpenAI Whisper実装
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]));
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    return (await response.json()).text;
  }

  private async transcribeWithCloudflare(audioBuffer: ArrayBuffer): Promise<string> {
    // Cloudflare Workers AI実装
    const response = await this.env.AI.run('@cf/openai/whisper', {
      audio: [...new Uint8Array(audioBuffer)],
    });

    return response.text;
  }
}
```

## 各AIプロバイダーの音声書き起こし対応

### 1. **Claude (Anthropic)**

```typescript
// ❌ Claudeは直接の音声書き起こしは非対応
// ✅ ただし、書き起こし後のテキスト処理は得意

// 書き起こし後の医療情報抽出
async function extractMedicalInfo(transcript: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `以下の診察会話から医療情報を抽出してください：\n${transcript}`,
        },
      ],
    }),
  });

  return response.json();
}
```

### 2. **Gemini (Google)**

```typescript
// ✅ Gemini 1.5 Proは音声入力に対応
import { GoogleGenerativeAI } from '@google/generative-ai';

async function transcribeWithGemini(audioBuffer: ArrayBuffer) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  // 音声ファイルをBase64エンコード
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'audio/webm',
        data: base64Audio,
      },
    },
    { text: 'この音声を書き起こしてください。' },
  ]);

  return result.response.text();
}
```

### 3. **Google Cloud Speech-to-Text**

```typescript
// Google専用の音声認識API（より高精度）
async function transcribeWithGoogleSTT(audioBuffer: ArrayBuffer) {
  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'ja-JP',
          enableAutomaticPunctuation: true,
          model: 'medical_dictation', // 医療用モデル
        },
        audio: {
          content: Buffer.from(audioBuffer).toString('base64'),
        },
      }),
    }
  );

  return response.json();
}
```

## 統合AIサービスの実装

```typescript
// 複数のAIプロバイダーを統合
interface AIProvider {
  transcribe?(audio: ArrayBuffer): Promise<string>;
  analyze(text: string): Promise<any>;
  generateSummary(text: string): Promise<string>;
}

class MultiAIService {
  private providers: Map<string, AIProvider>;

  constructor() {
    this.providers = new Map([
      ['openai', new OpenAIProvider()],
      ['gemini', new GeminiProvider()],
      ['claude', new ClaudeProvider()],
      ['cloudflare', new CloudflareProvider()],
    ]);
  }

  async transcribe(audio: ArrayBuffer, provider = 'openai'): Promise<string> {
    // 音声書き起こし対応プロバイダー
    const transcriptionProviders = ['openai', 'gemini', 'cloudflare', 'google-stt'];

    if (!transcriptionProviders.includes(provider)) {
      provider = 'openai'; // フォールバック
    }

    return this.providers.get(provider)!.transcribe!(audio);
  }

  async analyzeTranscript(transcript: string, provider = 'claude'): Promise<any> {
    // テキスト分析は全プロバイダー対応
    return this.providers.get(provider)!.analyze(transcript);
  }
}
```

## ハッカソン向けの実装例

```typescript
// 診察の音声処理パイプライン
class MedicalConsultationAI {
  constructor(
    private transcriptionProvider: 'openai' | 'gemini' | 'cloudflare',
    private analysisProvider: 'claude' | 'gemini' | 'openai'
  ) {}

  async processConsultation(audioBuffer: ArrayBuffer) {
    // Step 1: 音声書き起こし
    const transcript = await this.transcribe(audioBuffer);

    // Step 2: 医療情報抽出（Claude推奨）
    const medicalInfo = await this.extractMedicalInfo(transcript);

    // Step 3: SOAP形式生成
    const soapNote = await this.generateSOAPNote(transcript, medicalInfo);

    return {
      transcript,
      medicalInfo,
      soapNote,
    };
  }

  private async transcribe(audio: ArrayBuffer): Promise<string> {
    switch (this.transcriptionProvider) {
      case 'openai':
        return transcribeWithOpenAI(audio);
      case 'gemini':
        return transcribeWithGemini(audio);
      case 'cloudflare':
        return transcribeWithCloudflare(audio);
    }
  }

  private async extractMedicalInfo(transcript: string) {
    // Claudeが医療情報抽出に優れている
    if (this.analysisProvider === 'claude') {
      return extractWithClaude(transcript);
    }
    // 他のプロバイダーでも可能
    return extractWithProvider(transcript, this.analysisProvider);
  }
}
```

## プロバイダー選択の指針

### 音声書き起こし

1. **OpenAI Whisper**: 最も安定、多言語対応
2. **Gemini 1.5 Pro**: マルチモーダル対応、日本語精度高
3. **Google Speech-to-Text**: 医療専用モデルあり
4. **Cloudflare Workers AI**: エッジで動作、低遅延

### テキスト分析・医療情報抽出

1. **Claude**: 医療倫理に配慮、高精度な情報抽出
2. **Gemini**: 日本語理解力高、マルチモーダル
3. **GPT-4**: 汎用性高、プラグイン対応

## リアルタイム音声処理の実装

### WebSocketでの音声ストリーミング

```typescript
// Hono WebSocket実装
app.upgrade('/ws/transcribe', async (c) => {
  return {
    onMessage: async (event, ws) => {
      if (event.data instanceof ArrayBuffer) {
        // 音声チャンクを受信
        const audioChunk = event.data;

        // バッファリング（小さすぎるチャンクは結合）
        if (audioChunk.byteLength < MIN_CHUNK_SIZE) {
          bufferChunks(audioChunk);
          return;
        }

        // 書き起こし実行
        const text = await transcriptionService.transcribe(audioChunk);

        // 結果を送信
        ws.send(
          JSON.stringify({
            type: 'transcription',
            text,
            timestamp: Date.now(),
          })
        );
      }
    },
  };
});
```

## 実装上の注意

### 1. **ファイルサイズ制限**

- OpenAI: 25MB
- Cloudflare: 10MB程度

### 2. **レート制限**

- 適切なスロットリング実装が必要

### 3. **コスト**

- OpenAI: $0.006/分
- Cloudflare: Workers AI料金体系

### 4. **遅延**

- リアルタイム性が必要な場合は考慮

## 環境変数設定例

```typescript
// 環境変数設定例
const AI_CONFIG = {
  // 音声書き起こし用
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY,

  // テキスト分析用
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // デフォルト設定
  DEFAULT_TRANSCRIPTION_PROVIDER: 'openai',
  DEFAULT_ANALYSIS_PROVIDER: 'claude',
};
```

## まとめ

- **ローカル開発**: OpenAI APIまたはGemini APIを使用
- **本番環境**: Cloudflare Workers AIまたは各種API
- **音声書き起こし**: OpenAI Whisper、Gemini、Google STT
- **医療情報分析**: Claude（推奨）、Gemini、GPT-4
- 用途に応じて最適なプロバイダーを選択可能

Workers AIは**デプロイが必要**（ローカルでは完全に動作しない）ため、ハッカソンでは**ローカル開発を優先**し、OpenAI APIなどで代替することを推奨。最終的にCloudflareにデプロイして本番環境でWorkers AIを使用する。
