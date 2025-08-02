import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

// Zodスキーマ定義
export const VitalSignsSchema = z.object({
  temperature: z.number().optional(),
  bloodPressure: z.object({
    systolic: z.number(),
    diastolic: z.number(),
  }).optional(),
  pulse: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
});

export const PrescriptionMedicationSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  genericName: z.string().optional(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string(),
});

export const PrescriptionsSchema = z.array(PrescriptionMedicationSchema);

export const AILSummarySchema = z.object({
  extractedSymptoms: z.array(z.string()).optional(),
  suggestedDiagnoses: z.array(z.string()).optional(),
  keyPoints: z.array(z.string()).optional(),
});

// TypeScript型エクスポート
export type VitalSigns = z.infer<typeof VitalSignsSchema>;
export type PrescriptionMedication = z.infer<typeof PrescriptionMedicationSchema>;
export type Prescriptions = z.infer<typeof PrescriptionsSchema>;
export type AISummary = z.infer<typeof AILSummarySchema>;

// 患者テーブル - 基準文書に合わせて修正
export const patients = sqliteTable('patients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  phoneNumber: text('phone_number'),
  dateOfBirth: integer('date_of_birth', { mode: 'timestamp' }),
  gender: text('gender', { enum: ['male', 'female', 'other'] }),
  address: text('address'),
  emergencyContact: text('emergency_contact').default('{}'), // JSON: {name, relation, phone}
  medicalHistory: text('medical_history').default('{}'),
  // JSON形式: { allergies: [], medications: [], conditions: [] }
  profileImageUrl: text('profile_image_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 医療従事者テーブル - 基準文書に合わせて修正
export const workers = sqliteTable('workers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', {
    enum: ['doctor', 'operator', 'admin'],
  }).notNull(),
  passwordHash: text('password_hash').notNull(),
  phoneNumber: text('phone_number'),
  medicalLicenseNumber: text('medical_license_number'), // 医師のみ必須
  profileImageUrl: text('profile_image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 専門科マスターテーブル
export const specialties = sqliteTable('specialties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 内部識別子 (例: internal_medicine)
  displayName: text('display_name').notNull(), // 表示名 (例: 内科)
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 資格マスターテーブル
export const qualifications = sqliteTable('qualifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // 内部識別子 (例: internist_specialist)
  displayName: text('display_name').notNull(), // 表示名 (例: 内科専門医)
  description: text('description'),
  category: text('category', {
    enum: ['specialist', 'certified', 'instructor', 'subspecialty', 'designated'],
  }).notNull(),
  certifyingBody: text('certifying_body'), // 認定機関（例: 日本内科学会）
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 医師-専門科関連テーブル
export const doctorSpecialties = sqliteTable('doctor_specialties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerId: integer('worker_id')
    .notNull()
    .references(() => workers.id),
  specialtyId: integer('specialty_id')
    .notNull()
    .references(() => specialties.id),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 医師-資格関連テーブル
export const doctorQualifications = sqliteTable('doctor_qualifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerId: integer('worker_id')
    .notNull()
    .references(() => workers.id),
  qualificationId: integer('qualification_id')
    .notNull()
    .references(() => qualifications.id),
  certificateNumber: text('certificate_number'), // 資格証番号
  acquiredDate: integer('acquired_date', { mode: 'timestamp' }), // 取得日
  expiryDate: integer('expiry_date', { mode: 'timestamp' }), // 有効期限
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 予約テーブル - workerId に修正
export const appointments = sqliteTable('appointments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  assignedWorkerId: integer('assigned_worker_id').references(() => workers.id), // 担当医師
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  status: text('status', {
    enum: ['scheduled', 'waiting', 'assigned', 'in_progress', 'completed', 'cancelled'],
  })
    .notNull()
    .default('scheduled'), // 'scheduled'→'waiting'→'assigned'→'in_progress'→'completed'
  chiefComplaint: text('chief_complaint'),
  meetingId: text('meeting_id'), // Amazon Chime SDK用
  appointmentType: text('appointment_type', {
    enum: ['initial', 'follow_up', 'emergency'],
  }).default('initial'),
  durationMinutes: integer('duration_minutes').default(30),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 問診票テーブル - 基準文書に合わせて修正
export const questionnaires = sqliteTable('questionnaires', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appointmentId: integer('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id),
  questionsAnswers: text('questions_answers', { mode: 'json' }).notNull(),
  // JSON形式: { questions: [{ id, text, answer, timestamp }] }
  aiSummary: text('ai_summary'),
  urgencyLevel: text('urgency_level', {
    enum: ['low', 'medium', 'high', 'critical'],
  }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 診察記録テーブル（SOAP形式）
export const medicalRecords = sqliteTable('medical_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appointmentId: integer('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id),
  subjective: text('subjective'), // S: 主観的所見
  objective: text('objective'), // O: 客観的所見
  assessment: text('assessment'), // A: 評価
  plan: text('plan'), // P: 計画
  vitalSigns: text('vital_signs').default('{}'),
  // JSON形式: { temperature, bloodPressure: {systolic, diastolic}, pulse, respiratoryRate, oxygenSaturation }
  prescriptions: text('prescriptions', { mode: 'json' }).default('[]'),
  // JSON形式: [{ id?, name, genericName?, dosage, frequency, duration, instructions }]
  aiSummary: text('ai_summary').default('{}'),
  // JSON形式: { extractedSymptoms, suggestedDiagnoses, keyPoints }
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});


// 医師スケジュールテーブル - 基準文書に合わせて修正
export const workerSchedules = sqliteTable('worker_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workerId: integer('worker_id')
    .notNull()
    .references(() => workers.id),
  scheduleDate: integer('schedule_date', { mode: 'timestamp' }).notNull(),
  startTime: text('start_time').notNull(), // HH:MM形式
  endTime: text('end_time').notNull(), // HH:MM形式
  status: text('status', {
    enum: ['available', 'busy', 'break', 'off'],
  })
    .notNull()
    .default('available'),
  maxAppointments: integer('max_appointments').default(10),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// チャットメッセージテーブル - 基準文書の排他的外部キー設計に修正
export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  appointmentId: integer('appointment_id')
    .notNull()
    .references(() => appointments.id),
  // 送信者は患者またはワーカーのいずれか（排他的）
  patientId: integer('patient_id').references(() => patients.id),
  workerId: integer('worker_id').references(() => workers.id),
  messageType: text('message_type', {
    enum: ['text', 'image', 'file', 'system'],
  })
    .notNull()
    .default('text'),
  content: text('content').notNull(),
  // attachmentsはattachmentsテーブルで管理
  sentAt: integer('sent_at', { mode: 'timestamp' }).notNull().defaultNow(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// ビデオセッションテーブル - 基準文書に合わせて修正
export const videoSessions = sqliteTable('video_sessions', {
  id: text('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id),
  realtimeSessionId: text('realtime_session_id'), // Cloudflare Realtime Session ID
  status: text('status', {
    enum: ['scheduled', 'waiting', 'active', 'ended', 'failed'],
  })
    .notNull()
    .default('waiting'),
  recordingUrl: text('recording_url'),
  participants: text('participants', { mode: 'json' }),
  // JSON形式: [{ userId, userType, joinedAt, leftAt }]
  startedAt: integer('started_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  endReason: text('end_reason', { enum: ['completed', 'timeout', 'error', 'cancelled'] }),
  sessionMetrics: text('session_metrics', { mode: 'json' }),
  // JSON形式: { duration, quality, networkStats }
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// セッション参加者テーブル
export const sessionParticipants = sqliteTable('session_participants', {
  id: text('id').primaryKey(),
  videoSessionId: text('video_session_id')
    .notNull()
    .references(() => videoSessions.id),
  userType: text('user_type', { enum: ['patient', 'worker'] }).notNull(),
  userId: integer('user_id').notNull(),
  role: text('role', { enum: ['doctor', 'operator', 'admin'] }), // workerの場合のみ
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
  leftAt: integer('left_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// セッションイベントログテーブル
export const sessionEvents = sqliteTable('session_events', {
  id: text('id').primaryKey(),
  videoSessionId: text('video_session_id')
    .notNull()
    .references(() => videoSessions.id),
  eventType: text('event_type').notNull(), // 'joined', 'left', 'muted', 'unmuted', etc.
  userType: text('user_type', { enum: ['patient', 'worker'] }).notNull(),
  userId: integer('user_id').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 健康記録テーブル - 基準文書に合わせて修正
export const healthRecords = sqliteTable('health_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  recordType: text('record_type').notNull(), // 'weight', 'blood_pressure', 'temperature' など
  data: text('data', { mode: 'json' }).notNull(),
  // JSON形式: { value, unit, notes }
  recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 添付ファイルテーブル - 基準文書に合わせて修正
export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // アップロード者情報（患者または医療従事者）
  uploadedByPatientId: integer('uploaded_by_patient_id').references(() => patients.id),
  uploadedByWorkerId: integer('uploaded_by_worker_id').references(() => workers.id),

  // 関連エンティティ（どれか一つに紐付く）
  questionnaireId: integer('questionnaire_id').references(() => questionnaires.id),
  medicalRecordId: integer('medical_record_id').references(() => medicalRecords.id),
  chatMessageId: integer('chat_message_id').references(() => chatMessages.id),

  // ファイル情報
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(), // bytes
  contentType: text('content_type').notNull(), // MIME type (e.g., 'image/jpeg', 'application/pdf')

  // ストレージ情報
  storageUrl: text('storage_url').notNull(), // R2/ローカルストレージのURL
  thumbnailUrl: text('thumbnail_url'), // 画像の場合のサムネイルURL

  // メタデータ
  attachmentType: text('attachment_type', {
    enum: ['questionnaire', 'medical_record', 'chat', 'other'],
  }).notNull(),
  description: text('description'), // ファイルの説明
  metadata: text('metadata', { mode: 'json' }), // 追加メタデータ

  // セキュリティ
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 有効期限

  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull().defaultNow(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// Infer TypeScript types from the schema
export type Patient = typeof patients.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Questionnaire = typeof questionnaires.$inferSelect;
export type MedicalRecord = typeof medicalRecords.$inferSelect;

export type WorkerSchedule = typeof workerSchedules.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type VideoSession = typeof videoSessions.$inferSelect;
export type SessionParticipant = typeof sessionParticipants.$inferSelect;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
