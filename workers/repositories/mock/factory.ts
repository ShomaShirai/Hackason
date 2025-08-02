import type { RepositoryFactory } from '../interfaces'
import { MockPatientRepository } from './patient.repository'
import { MockAppointmentRepository } from './appointment.repository'
import { MockQuestionnaireRepository } from './questionnaire.repository'

import { MockWorkerRepository } from './worker.repository'
import { MockWorkerScheduleRepository } from './worker-schedule.repository'
import { MockChatMessageRepository } from './chat-message.repository'
import { MockMedicalRecordRepository } from './medical-record.repository'
import { MockVideoSessionRepository } from './video-session.repository'

interface MockData {
  appointments?: any[]
  questionnaires?: any[]
  patients?: any[]
  workers?: any[]
  medicalRecords?: any[]
  videoSessions?: any[]
  workerSchedules?: any[]
  chatMessages?: any[]
}

export class MockRepositoryFactory implements RepositoryFactory {
  private patientRepo: MockPatientRepository
  private appointmentRepo: MockAppointmentRepository
  private questionnaireRepo: MockQuestionnaireRepository

  private workerRepo: MockWorkerRepository
  private workerScheduleRepo: MockWorkerScheduleRepository
  private chatMessageRepo: MockChatMessageRepository
  private medicalRecordRepo: MockMedicalRecordRepository
  private videoSessionRepo: MockVideoSessionRepository

  constructor(mockData: MockData = {}) {
    this.patientRepo = new MockPatientRepository(
      mockData.patients || [],
      mockData.appointments || []
    )
    this.appointmentRepo = new MockAppointmentRepository(mockData.appointments || [])
    this.questionnaireRepo = new MockQuestionnaireRepository(mockData.questionnaires || [])

    this.workerRepo = new MockWorkerRepository(mockData.workers || [])
    this.workerScheduleRepo = new MockWorkerScheduleRepository(mockData.workerSchedules || [])
    this.chatMessageRepo = new MockChatMessageRepository(mockData.chatMessages || [])
    this.medicalRecordRepo = new MockMedicalRecordRepository(mockData.medicalRecords || [])
    this.videoSessionRepo = new MockVideoSessionRepository(mockData.videoSessions || [])
  }

  createPatientRepository() {
    return this.patientRepo
  }

  createWorkerRepository() {
    return this.workerRepo
  }

  createAppointmentRepository() {
    return this.appointmentRepo
  }

  createQuestionnaireRepository() {
    return this.questionnaireRepo
  }

  createMedicalRecordRepository() {
    return this.medicalRecordRepo
  }



  createVideoSessionRepository() {
    return this.videoSessionRepo
  }

  createWorkerScheduleRepository() {
    return this.workerScheduleRepo
  }

  createChatMessageRepository() {
    return this.chatMessageRepo
  }
}
