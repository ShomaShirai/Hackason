// リポジトリインターフェースの定義

import type {
  Patient,
  // NewPatient, // 現在未使用だが将来的に使用予定
  Worker,
  Appointment,
  Questionnaire,
  MedicalRecord,
  VideoSession,
  WorkerSchedule,
  ChatMessage as ChatMessageType
} from '../db/types'

// 基本的なCRUD操作のインターフェース
export interface Repository<T> {
  findById(id: number | string): Promise<T | null>
  findAll(options?: FindOptions): Promise<T[]>
  create(data: Partial<T>): Promise<T>
  update(id: number | string, data: Partial<T>): Promise<T | null>
  delete(id: number | string): Promise<boolean>
}

export interface FindOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

// 患者リポジトリ
export interface PatientRepository extends Repository<Patient> {
  findByEmail(email: string): Promise<Patient | null>
  getPatientsByDoctorId(doctorId: number): Promise<Patient[]>
  getPatientByIdAndDoctorId(
    patientId: number,
    doctorId: number,
  ): Promise<Patient | null>
}

// 医療従事者リポジトリ
export interface WorkerRepository extends Repository<Worker> {
  findByEmail(email: string): Promise<Worker | null>
  findByRole(role: Worker['role']): Promise<Worker[]>
  findAvailableDoctors(date: Date): Promise<Worker[]>
}

// 予約リポジトリ
export interface AppointmentRepository extends Repository<Appointment> {
  findByPatientId(patientId: number, options?: FindOptions): Promise<Appointment[]>
  findByWorkerId(workerId: number, options?: FindOptions): Promise<Appointment[]>
  findByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>
  findAvailableSlots(date: Date, doctorId?: number): Promise<AvailableSlot[]>
  findConflicting(doctorId: number, startTime: Date, endTime: Date): Promise<Appointment[]>
  updateStatus(id: number, status: string): Promise<Appointment | null>
}

export interface AvailableSlot {
  doctorId: number
  doctorName: string
  specialty: string
  startTime: string
  endTime: string
  available: boolean
}

// 問診票リポジトリ
export interface QuestionnaireRepository extends Repository<Questionnaire> {
  findByAppointmentId(appointmentId: number): Promise<Questionnaire | null>
  updateAnswers(id: number, answers: Record<string, any>): Promise<Questionnaire | null>
  markAsCompleted(id: number): Promise<Questionnaire | null>
}

// カルテリポジトリ
export interface MedicalRecordRepository extends Repository<MedicalRecord> {
  findByAppointmentId(appointmentId: number): Promise<MedicalRecord | null>
}



// 医薬品検索結果
export interface MedicationSearchResult {
  name: string
  genericName?: string
  manufacturer?: string
  dosageForms?: string[]
}

// ビデオセッションリポジトリ
export interface VideoSessionRepository extends Repository<VideoSession> {
  findByAppointmentId(appointmentId: number): Promise<VideoSession | null>
  findActiveSession(sessionId: string): Promise<VideoSession | null>
  updateSessionStatus(sessionId: string, status: string): Promise<VideoSession | null>
}

// 医師スケジュールリポジトリ
export interface WorkerScheduleRepository extends Repository<WorkerSchedule> {
  findByWorkerId(workerId: number, startDate: Date, endDate: Date): Promise<WorkerSchedule[]>
  findByDate(date: Date): Promise<WorkerSchedule[]>
  bulkCreate(schedules: Partial<WorkerSchedule>[]): Promise<WorkerSchedule[]>
  deleteByWorkerIdAndDateRange(workerId: number, startDate: Date, endDate: Date): Promise<boolean>
}

// チャットメッセージのインターフェース型
export type ChatMessage = ChatMessageType

// チャットメッセージリポジトリ
export interface ChatMessageRepository extends Repository<ChatMessage> {
  findByAppointmentId(appointmentId: number, options?: { limit?: number; offset?: number }): Promise<ChatMessage[]>
  markAsRead(messageId: number, readAt: Date): Promise<ChatMessage | null>
  countUnreadForUser(userId: number, userType: 'patient' | 'worker'): Promise<number>
}

// リポジトリファクトリインターフェース
export interface RepositoryFactory {
  createPatientRepository(): PatientRepository
  createWorkerRepository(): WorkerRepository
  createAppointmentRepository(): AppointmentRepository
  createQuestionnaireRepository(): QuestionnaireRepository
  createMedicalRecordRepository(): MedicalRecordRepository
  createVideoSessionRepository(): VideoSessionRepository
  createWorkerScheduleRepository(): WorkerScheduleRepository
  createChatMessageRepository(): ChatMessageRepository
}
