/**
 * API共通の型定義
 */

// エラーレスポンス
export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

// ページネーション
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// 患者情報
export interface Patient {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | 'other' | null;
  address: string | null;
  emergencyContact: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  insuranceNumber: string | null;
  age?: number;
}

// 医療従事者情報
export interface Worker {
  id: number;
  email: string;
  name: string;
  role: 'doctor' | 'operator' | 'admin';
  phoneNumber: string | null;
  medicalLicenseNumber: string | null;
  specialties?: string[];
  profileImageUrl: string | null;
  isActive: boolean;
}

// 予約情報
export interface Appointment {
  id: number;
  patientId: number;
  workerId?: number | null;
  assignedWorkerId?: number | null;
  scheduledAt: Date | string;
  status: 'scheduled' | 'waiting' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  chiefComplaint: string | null;
  appointmentType: string | null;
  durationMinutes: number | null;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  completedAt?: Date | string | null;
  priority?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// 予約詳細（患者情報付き）
export interface AppointmentWithPatient extends Appointment {
  patient: Patient;
}

// 予約詳細（医師情報付き）
export interface AppointmentWithDoctor extends Appointment {
  doctor: Worker | null;
}

// 予約詳細（患者・医師情報付き）
export interface AppointmentDetails extends Appointment {
  patient: Patient;
  doctor: Worker | null;
}

// 医師の予約一覧レスポンス
export interface DoctorAppointmentsResponse {
  appointments: Array<{
    id: number;
    scheduledAt: Date | string;
    status: string;
    chiefComplaint: string;
    appointmentType: string;
    durationMinutes: number;
    patient: {
      id: number;
      name: string;
      email: string;
      phoneNumber: string | null;
    };
  }>;
  summary: {
    total: number;
    statusCounts: {
      scheduled: number;
      waiting: number;
      assigned: number;
      in_progress: number;
      completed: number;
      cancelled: number;
    };
    nextAppointment: any | null;
  };
  date: string;
}

// 患者の予約一覧レスポンス
export interface PatientAppointmentsResponse {
  appointments: Array<{
    id: number;
    scheduledAt: Date | string;
    status: string;
    chiefComplaint: string;
    appointmentType: string;
    durationMinutes: number;
    startedAt?: Date | string | null;
    endedAt?: Date | string | null;
    doctor: {
      id: number;
      name: string;
      role: string;
    } | null;
    questionnaireCompletedAt?: Date | string | null;
  }>;
  pagination: PaginationInfo;
}

// 通知
export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  data?: Record<string, any>;
}

// 通知一覧レスポンス
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}

// 問診票
export interface Questionnaire {
  id?: number;
  appointmentId: number;
  answers: Record<string, any>;
  completedAt: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// 問診票テンプレート
export interface QuestionnaireTemplate {
  id: string;
  type: string;
  question: string;
  required: boolean;
  options?: string[];
}

// 問診票レスポンス
export interface QuestionnaireResponse {
  questionnaire: Questionnaire;
  template?: QuestionnaireTemplate[];
}

// チャットメッセージ
export interface ChatMessage {
  id: number;
  appointmentId: number;
  senderId: number;
  senderType: 'patient' | 'worker';
  message: string;
  sentAt: Date | string;
  readAt?: Date | string | null;
  attachmentUrl?: string | null;
}

// チャットメッセージレスポンス
export interface ChatMessagesResponse {
  messages: Array<{
    id: number;
    appointmentId: number;
    content: string;
    messageType: string;
    sentAt: Date | string;
    readAt: Date | string | null;
    sender: {
      type: 'patient' | 'worker';
      name: string;
    };
  }>;
  hasMore: boolean;
  nextCursor?: string;
}

// 医師スケジュール
export interface DoctorSchedule {
  id: number;
  workerId: number;
  scheduleDate: Date | string;
  startTime: string;
  endTime: string;
  status: 'available' | 'busy' | 'break' | 'off';
  maxAppointments: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// スケジュールスロット
export interface ScheduleSlot {
  date: string;
  doctorId: number;
  doctorName: string;
  specialty: string;
  timeSlots: Array<{
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
}

// 利用可能スロットレスポンス
export interface AvailableSlotsResponse {
  slots: ScheduleSlot[];
}

// ビデオセッション
export interface VideoSession {
  id: number | string;
  appointmentId: number;
  realtimeSessionId: string;
  status: string;
  token?: string;
  expiresAt?: string;
  isNewSession?: boolean;
}

// 処方箋
export interface Prescription {
  id: number;
  appointmentId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  prescribedAt: Date | string;
}

// カルテ
export interface MedicalRecord {
  id: number;
  appointmentId: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  vitalSigns: Record<string, any>;
  aiSummary: Record<string, any> | null;
  attachmentIds: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

// カルテレスポンス
export interface MedicalRecordResponse {
  isNew: boolean;
  record?: MedicalRecord;
  appointment: {
    id: number;
    patient: {
      id: number;
      name: string;
    };
    scheduledAt: Date | string;
    chiefComplaint: string | null;
    doctor: {
      id: number;
      name: string;
    } | null;
  };
}