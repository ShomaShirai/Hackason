import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  patients,
  workers,
  appointments,
  questionnaires,
  medicalRecords,
  videoSessions,
  workerSchedules,
  chatMessages,
  sessionParticipants
} from './schema';

// Select types (for reading from database)
export type Patient = InferSelectModel<typeof patients>;
export type Worker = InferSelectModel<typeof workers>;
export type Appointment = InferSelectModel<typeof appointments>;
export type Questionnaire = InferSelectModel<typeof questionnaires>;

export type MedicalRecord = InferSelectModel<typeof medicalRecords>;
export type VideoSession = InferSelectModel<typeof videoSessions>;
export type WorkerSchedule = InferSelectModel<typeof workerSchedules>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type SessionParticipant = InferSelectModel<typeof sessionParticipants>;

// Insert types (for inserting into database)
export type NewPatient = InferInsertModel<typeof patients>;
export type NewWorker = InferInsertModel<typeof workers>;
export type NewAppointment = InferInsertModel<typeof appointments>;
export type NewQuestionnaire = InferInsertModel<typeof questionnaires>;

export type NewMedicalRecord = InferInsertModel<typeof medicalRecords>;
export type NewVideoSession = InferInsertModel<typeof videoSessions>;
export type NewWorkerSchedule = InferInsertModel<typeof workerSchedules>;
export type NewChatMessage = InferInsertModel<typeof chatMessages>;
export type NewSessionParticipant = InferInsertModel<typeof sessionParticipants>;

// JOIN query result types
export type AppointmentWithWorker = Appointment & {
  worker: Worker | null;
};

export type AppointmentWithPatientAndWorker = Appointment & {
  patient: Patient;
  worker: Worker | null;
};

export type MedicalRecordWithPatient = MedicalRecord & {
  patient: Patient;
};



// Enums and constants
export type WorkerRole = Worker['role'];
export type AppointmentStatus = Appointment['status'];
export type AppointmentType = Appointment['appointmentType'];
export type Gender = Patient['gender'];
export type UrgencyLevel = Questionnaire['urgencyLevel'];
export type VideoSessionStatus = VideoSession['status'];
