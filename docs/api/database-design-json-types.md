# データベース設計書 補足 - JSON型フィールドの型定義

## 概要

本書は、データベース設計で使用するJSON型フィールドのZodスキーマ定義を示します。型安全性とランタイム検証を両立させるため、Zodを採用しています。

## 1. Zod採用の理由

### 1.1 JsonSchemaとの比較

| 観点             | Zod                      | JsonSchema              |
| ---------------- | ------------------------ | ----------------------- |
| TypeScript型推論 | ◎ 自動的に型が生成される | △ 別途型定義が必要      |
| ランタイム検証   | ◎ 組み込み               | ◎ ajv等のライブラリ必要 |
| IDE補完          | ◎ 完全対応               | △ 追加設定が必要        |
| 学習曲線         | ◎ TypeScript的な記法     | △ 独自の記法            |
| バンドルサイズ   | ○ 約12KB                 | △ ajv含めて約40KB       |
| Drizzle ORM統合  | ◎ 同じTSエコシステム     | △ 追加の統合作業        |

### 1.2 結論

Drizzle ORMを使用する本プロジェクトでは、Zodの採用により：

- 型定義の一元管理
- 開発効率の向上
- ハッカソン参加者の学習負荷軽減

## 2. JSON型フィールドのZodスキーマ定義

### 2.1 ファイル構成

```
src/
  db/
    schema/
      index.ts          # Drizzleスキーマ
      json-schemas.ts   # ZodスキーマとDrizzle用カスタムタイプ
```

### 2.2 実装例

```typescript
// src/db/schema/json-schemas.ts
import { z } from 'zod';
import { customType } from 'drizzle-orm/sqlite-core';

// ========================================
// 基本的なJSON型の定義（Drizzle用）
// ========================================
export const json = <T>(schema: z.ZodSchema<T>) => {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text';
    },
    fromDriver(value: string): T {
      const parsed = JSON.parse(value);
      return schema.parse(parsed);
    },
    toDriver(value: T): string {
      // 保存前に検証
      schema.parse(value);
      return JSON.stringify(value);
    },
  });
};

// ========================================
// 1. 患者の医療履歴（patients.medical_history）
// ========================================
export const MedicalHistorySchema = z.object({
  allergies: z
    .array(
      z.object({
        name: z.string(),
        severity: z.enum(['mild', 'moderate', 'severe']),
        note: z.string().optional(),
      })
    )
    .default([]),

  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .default([]),

  conditions: z
    .array(
      z.object({
        name: z.string(),
        diagnosedDate: z.string().datetime().optional(),
        status: z.enum(['active', 'resolved', 'chronic']),
        note: z.string().optional(),
      })
    )
    .default([]),
});

export type MedicalHistory = z.infer<typeof MedicalHistorySchema>;

// ========================================
// 2. 問診票の質問と回答（questionnaires.questions_answers）
// ========================================
export const QuestionAnswerSchema = z.object({
  id: z.string(),
  text: z.string(),
  answer: z.string(),
  timestamp: z.string().datetime(),
  questionType: z.enum(['text', 'select', 'multiselect', 'scale']).optional(),
});

export const QuestionsAnswersSchema = z.object({
  questions: z.array(QuestionAnswerSchema),
  completedSections: z.array(z.string()).optional(),
  aiSuggestedQuestions: z.array(z.string()).optional(),
});

export type QuestionsAnswers = z.infer<typeof QuestionsAnswersSchema>;

// ========================================
// 3. バイタルサイン（medical_records.vital_signs）
// ========================================
export const VitalSignsSchema = z.object({
  temperature: z.number().min(30).max(45).optional(), // 体温（℃）
  bloodPressure: z
    .object({
      systolic: z.number().min(50).max(300), // 収縮期
      diastolic: z.number().min(30).max(200), // 拡張期
    })
    .optional(),
  pulse: z.number().min(30).max(250).optional(), // 脈拍
  oxygenSaturation: z.number().min(50).max(100).optional(), // 血中酸素飽和度 (SpO2)
  respiratoryRate: z.number().min(5).max(60).optional(), // 呼吸数
  measurementTime: z.string().datetime().optional(),
});

export type VitalSigns = z.infer<typeof VitalSignsSchema>;

// ========================================
// 4. AI解析サマリー（medical_records.ai_summary）
// ========================================
export const AiSummarySchema = z.object({
  extractedSymptoms: z
    .array(
      z.object({
        symptom: z.string(),
        severity: z.enum(['mild', 'moderate', 'severe']),
        duration: z.string().optional(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),

  suggestedDiagnoses: z
    .array(
      z.object({
        diagnosis: z.string(),
        probability: z.number().min(0).max(1),
        reasoning: z.string(),
        icdCode: z.string().optional(),
      })
    )
    .optional(),

  keyPoints: z.array(z.string()).optional(),

  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),

  followUpRecommendations: z.array(z.string()).optional(),
});

export type AiSummary = z.infer<typeof AiSummarySchema>;

// ========================================
// 5. 処方薬（prescriptions.medications）
// ========================================
export const MedicationSchema = z.object({
  name: z.string(),
  genericName: z.string().optional(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string(),
  route: z.enum(['oral', 'injection', 'topical', 'inhalation', 'other']).default('oral'),
});

export const MedicationsSchema = z.array(MedicationSchema);

export type Medications = z.infer<typeof MedicationsSchema>;

// ========================================
// 6. 添付ファイルメタデータ（attachments.metadata）
// ========================================
export const AttachmentMetadataSchema = z.object({
  originalName: z.string().optional(), // アップロード時の元ファイル名
  width: z.number().positive().optional(), // 画像の幅（ピクセル）
  height: z.number().positive().optional(), // 画像の高さ（ピクセル）
  duration: z.number().positive().optional(), // 動画・音声の長さ（秒）
  pages: z.number().positive().optional(), // PDFのページ数
  encoding: z.string().optional(), // ファイルエンコーディング
  compressionRatio: z.number().optional(), // 圧縮率
  hash: z.string().optional(), // ファイルハッシュ（重複検出用）
  exifData: z.record(z.any()).optional(), // 画像のEXIFデータ
  scanStatus: z.enum(['pending', 'clean', 'infected']).optional(), // ウイルススキャン状態
  ocrText: z.string().optional(), // OCR抽出テキスト
});

export type AttachmentMetadata = z.infer<typeof AttachmentMetadataSchema>;

// ========================================
// 7. ビデオセッション参加者（video_sessions.participants）
// ========================================
export const ParticipantSchema = z.object({
  userId: z.number(),
  userType: z.enum(['patient', 'worker']),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
  role: z.enum(['host', 'participant']),
  deviceInfo: z
    .object({
      browser: z.string().optional(),
      os: z.string().optional(),
      deviceType: z.enum(['desktop', 'mobile', 'tablet']).optional(),
    })
    .optional(),
});

export const ParticipantsSchema = z.array(ParticipantSchema);

export type Participants = z.infer<typeof ParticipantsSchema>;

// ========================================
// 8. セッションメトリクス（video_sessions.session_metrics）
// ========================================
export const SessionMetricsSchema = z.object({
  duration: z.number().positive(), // 秒
  quality: z
    .object({
      averageVideoQuality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
      averageAudioQuality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
      connectionStability: z.number().min(0).max(100).optional(), // パーセンテージ
    })
    .optional(),
  networkStats: z
    .object({
      averageLatency: z.number().optional(), // ミリ秒
      packetLoss: z.number().min(0).max(100).optional(), // パーセンテージ
      bandwidth: z
        .object({
          upload: z.number().optional(), // Mbps
          download: z.number().optional(), // Mbps
        })
        .optional(),
    })
    .optional(),
  recordingInfo: z
    .object({
      recorded: z.boolean(),
      duration: z.number().optional(),
      fileSize: z.number().optional(),
    })
    .optional(),
});

export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

// ========================================
// 9. AI解析結果（medical_record_ai_analyses.result）
// ========================================
export const AiAnalysisResultSchema = z.discriminatedUnion('analysisType', [
  z.object({
    analysisType: z.literal('transcription'),
    transcript: z.string(),
    language: z.string().default('ja'),
    duration: z.number().optional(),
    wordCount: z.number().optional(),
  }),

  z.object({
    analysisType: z.literal('symptom_extraction'),
    symptoms: z.array(
      z.object({
        name: z.string(),
        severity: z.enum(['mild', 'moderate', 'severe']),
        bodyPart: z.string().optional(),
        duration: z.string().optional(),
        frequency: z.string().optional(),
      })
    ),
    chiefComplaint: z.string(),
    reviewOfSystems: z.record(z.string(), z.boolean()).optional(),
  }),

  z.object({
    analysisType: z.literal('diagnosis_suggestion'),
    differentialDiagnoses: z.array(
      z.object({
        diagnosis: z.string(),
        probability: z.number().min(0).max(1),
        supportingSymptoms: z.array(z.string()),
        ruleOutTests: z.array(z.string()).optional(),
        icdCode: z.string().optional(),
      })
    ),
    recommendedTests: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
  }),

  z.object({
    analysisType: z.literal('summary'),
    summary: z.string(),
    keyPoints: z.array(z.string()),
    actionItems: z.array(z.string()),
    followUpRequired: z.boolean(),
    nextSteps: z.array(z.string()).optional(),
  }),
]);

export type AiAnalysisResult = z.infer<typeof AiAnalysisResultSchema>;
```

### 2.3 Drizzleスキーマでの使用例

```typescript
// src/db/schema/index.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { json, MedicalHistorySchema, VitalSignsSchema } from './json-schemas';

export const patients = sqliteTable('patients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // ... 他のフィールド

  // Zodスキーマを使用したJSON型フィールド
  medicalHistory: json(MedicalHistorySchema)('medical_history'),
});

export const medicalRecords = sqliteTable('medical_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // ... 他のフィールド

  // Zodスキーマを使用したJSON型フィールド
  vitalSigns: json(VitalSignsSchema)('vital_signs'),
});
```

## 3. 使用例

### 3.1 データの挿入

```typescript
// 型安全な挿入
await db.insert(patients).values({
  name: '田中太郎',
  email: 'tanaka@example.com',
  medicalHistory: {
    allergies: [{ name: '花粉', severity: 'mild' }],
    medications: [],
    conditions: [
      {
        name: '高血圧',
        status: 'active',
        diagnosedDate: '2023-01-15T00:00:00Z',
      },
    ],
  },
});
```

### 3.2 データの取得と型安全性

```typescript
// 取得時も型が保証される
const patient = await db.select().from(patients).where(eq(patients.id, 1)).get();

if (patient) {
  // TypeScriptの補完が効く
  patient.medicalHistory.allergies.forEach((allergy) => {
    console.log(`${allergy.name}: ${allergy.severity}`);
  });
}
```

### 3.3 バリデーションエラーのハンドリング

```typescript
try {
  await db.insert(medicalRecords).values({
    appointmentId: 1,
    vitalSigns: {
      temperature: 60, // エラー：範囲外
      pulse: 70,
    },
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation failed:', error.errors);
    // [{ path: ['temperature'], message: 'Number must be less than or equal to 45' }]
  }
}
```

## 4. ハッカソン参加者へのガイドライン

### 4.1 新しいJSON型フィールドの追加方法

1. `json-schemas.ts`に新しいZodスキーマを定義
2. 型をエクスポート
3. Drizzleスキーマで`json()`ヘルパーを使用

### 4.2 ベストプラクティス

- **適度な粒度**: 過度に正規化せず、関連データはJSONにまとめる
- **バリデーション**: 必要な制約は必ずZodスキーマに含める
- **デフォルト値**: `.default()`を活用して初期値を設定
- **オプショナル**: 必須でないフィールドは`.optional()`を使用

### 4.3 注意点

- JSONフィールドはインデックスが効かないため、検索条件には使わない
- 大きなデータ（画像等）は含めず、URLを保存する
- 深いネストは避け、フラットな構造を心がける

## まとめ

Zodを使用することで、JSONフィールドの型安全性とランタイム検証を両立できます。開発効率が向上し、バグの早期発見にもつながります。ハッカソン参加者も、TypeScriptの知識があれば容易に拡張可能です。
