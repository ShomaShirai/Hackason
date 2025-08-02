import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type {
  RepositoryFactory,
  PatientRepository,
  WorkerRepository,
  AppointmentRepository,
  QuestionnaireRepository,
  MedicalRecordRepository,
  VideoSessionRepository,
  WorkerScheduleRepository,
  ChatMessageRepository
} from '../interfaces'
import { DrizzlePatientRepository } from './patient.repository'
import { DrizzleAppointmentRepository } from './appointment.repository'
import { DrizzleQuestionnaireRepository } from './questionnaire.repository'

import { DrizzleWorkerRepository } from './worker.repository'
import { DrizzleWorkerScheduleRepository } from './worker-schedule.repository'
import { DrizzleChatMessageRepository } from './chat-message.repository'
import { DrizzleVideoSessionRepository } from './video-session.repository'


type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleRepositoryFactory implements RepositoryFactory {
  constructor(private db: Database) {}

  createPatientRepository(): PatientRepository {
    return new DrizzlePatientRepository(this.db)
  }

  createWorkerRepository(): WorkerRepository {
    return new DrizzleWorkerRepository(this.db)
  }

  createAppointmentRepository(): AppointmentRepository {
    return new DrizzleAppointmentRepository(this.db)
  }

  createQuestionnaireRepository(): QuestionnaireRepository {
    return new DrizzleQuestionnaireRepository(this.db)
  }

  createMedicalRecordRepository(): MedicalRecordRepository {
    // TODO: 実装
    throw new Error('MedicalRecordRepository not implemented yet')
  }



  createVideoSessionRepository(): VideoSessionRepository {
    return new DrizzleVideoSessionRepository(this.db)
  }

  createWorkerScheduleRepository(): WorkerScheduleRepository {
    return new DrizzleWorkerScheduleRepository(this.db)
  }

  createChatMessageRepository(): ChatMessageRepository {
    return new DrizzleChatMessageRepository(this.db)
  }
}
