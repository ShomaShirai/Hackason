import type { MedicalRecord } from '../../db/schema'
import type { MedicalRecordRepository } from '../interfaces'

export class MockMedicalRecordRepository implements MedicalRecordRepository {
  private medicalRecords: Map<number, MedicalRecord> = new Map()
  private nextId = 1

  constructor(initialData: MedicalRecord[] = []) {
    initialData.forEach(record => {
      this.medicalRecords.set(record.id, record)
      this.nextId = Math.max(this.nextId, record.id + 1)
    })
  }

  async findById(id: number): Promise<MedicalRecord | null> {
    return this.medicalRecords.get(id) || null
  }

  async findAll(): Promise<MedicalRecord[]> {
    return Array.from(this.medicalRecords.values())
  }

  async create(data: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const record: MedicalRecord = {
      id: this.nextId++,
      appointmentId: data.appointmentId!,
      subjective: data.subjective || null,
      objective: data.objective || null,
      assessment: data.assessment || null,
      plan: data.plan || null,
      vitalSigns: data.vitalSigns || '{}',
      prescriptions: data.prescriptions || '[]',
      aiSummary: data.aiSummary || '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.medicalRecords.set(record.id, record)
    return record
  }

  async update(id: number, data: Partial<MedicalRecord>): Promise<MedicalRecord | null> {
    const existing = this.medicalRecords.get(id)
    if (!existing) {
      return null
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    }
    this.medicalRecords.set(id, updated)
    return updated
  }

  async delete(id: number): Promise<boolean> {
    return this.medicalRecords.delete(id)
  }

  async findByAppointmentId(appointmentId: number): Promise<MedicalRecord | null> {
    return Array.from(this.medicalRecords.values())
      .find(record => record.appointmentId === appointmentId) || null
  }
}
