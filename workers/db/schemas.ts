import { z } from 'zod';

// 緊急連絡先スキーマ - 基準文書に合わせて修正
export const EmergencyContactSchema = z.object({
  name: z.string().min(1),
  relation: z.string().min(1), // relationshipから変更
  phone: z.string().min(1), // phoneNumberから変更
});

// 医療履歴スキーマ - 基準文書に合わせて新規追加
export const MedicalHistorySchema = z.object({
  allergies: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
});

// 問診票の回答スキーマ - 基準文書に合わせて修正
export const QuestionAnswerSchema = z.object({
  id: z.string(),
  text: z.string(),
  answer: z.string(),
  timestamp: z.string().datetime().optional(),
});

export const QuestionsSchema = z.array(QuestionAnswerSchema);

// バイタルサインスキーマ - 基準文書に合わせて修正
export const VitalSignsSchema = z.object({
  temperature: z.number().min(30).max(45).optional(), // 摂氏
  bloodPressure: z
    .object({
      systolic: z.number().min(50).max(300), // 収縮期
      diastolic: z.number().min(30).max(200), // 拡張期
    })
    .optional(),
  pulse: z.number().min(30).max(250).optional(), // 脈拍
  respiratoryRate: z.number().min(5).max(60).optional(), // 呼吸数
  oxygenSaturation: z.number().min(50).max(100).optional(), // 血中酸素飽和度 (SpO2) - 名前変更
});

// AI解析結果スキーマ
export const AiSummarySchema = z.object({
  extractedSymptoms: z.array(z.string()).optional(),
  suggestedDiagnoses: z.array(z.string()).optional(),
  keyPoints: z.array(z.string()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  processingTime: z.number().optional(),
});

// 処方薬スキーマ - 基準文書に合わせて修正
export const PrescriptionMedicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  instructions: z.string(),
});

export const PrescriptionMedicationsSchema = z.array(PrescriptionMedicationSchema);

// ビデオセッション参加者スキーマ - 基準文書に合わせて新規追加
export const ParticipantSchema = z.object({
  userId: z.number(),
  userType: z.enum(['patient', 'worker']),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
});

export const ParticipantsSchema = z.array(ParticipantSchema);

// セッションメトリクススキーマ - 基準文書に合わせて新規追加
export const SessionMetricsSchema = z.object({
  duration: z.number().optional(), // 秒
  quality: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  networkStats: z
    .object({
      avgLatency: z.number().optional(),
      packetsLost: z.number().optional(),
      bandwidth: z.number().optional(),
    })
    .optional(),
});

// 添付ファイルメタデータスキーマ - 基準文書に合わせて修正
export const AttachmentMetadataSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  originalFileName: z.string().optional(),
  imageProperties: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      format: z.string().optional(),
    })
    .optional(),
  documentProperties: z
    .object({
      pageCount: z.number().optional(),
      wordCount: z.number().optional(),
    })
    .optional(),
});

// 健康記録データスキーマ - 基準文書に合わせて修正
export const HealthRecordDataSchema = z.object({
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

// 削除済みスキーマ（基準文書では使用しない）
// - InsuranceInfoSchema
// - SymptomSchema、SymptomsSchema
// - MedicationSchema、MedicationsSchema
// - AllergySchema、AllergiesSchema
// - ChimeSessionDataSchema（別途定義）
// - HealthRecordVitalSignsSchema等の個別タイプスキーマ

// 型定義のエクスポート
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;
export type MedicalHistory = z.infer<typeof MedicalHistorySchema>;
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;
export type Questions = z.infer<typeof QuestionsSchema>;
export type VitalSigns = z.infer<typeof VitalSignsSchema>;
export type AiSummary = z.infer<typeof AiSummarySchema>;
export type PrescriptionMedication = z.infer<typeof PrescriptionMedicationSchema>;
export type PrescriptionMedications = z.infer<typeof PrescriptionMedicationsSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Participants = z.infer<typeof ParticipantsSchema>;
export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;
export type AttachmentMetadata = z.infer<typeof AttachmentMetadataSchema>;
export type HealthRecordData = z.infer<typeof HealthRecordDataSchema>;
