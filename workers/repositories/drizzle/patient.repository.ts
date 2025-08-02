import { eq, and } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { patients, appointments } from '../../db/schema'
import type { Patient, NewPatient } from '../../db/types'
import type { PatientRepository } from '../interfaces'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzlePatientRepository implements PatientRepository {
  constructor(private db: Database) {}

  async findById(id: number): Promise<Patient | null> {
    const results = await this.db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<Patient[]> {
    let query = this.db.select().from(patients)

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async findByEmail(email: string): Promise<Patient | null> {
    const results = await this.db
      .select()
      .from(patients)
      .where(eq(patients.email, email))
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async create(data: Partial<NewPatient>): Promise<Patient> {
    const result = await this.db
      .insert(patients)
      .values({
        email: data.email!,
        name: data.name!,
        passwordHash: data.passwordHash!,
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        address: data.address,
        emergencyContact: data.emergencyContact || '{}',
        medicalHistory: data.medicalHistory || '{}',
        profileImageUrl: data.profileImageUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .all()

    return result[0]!
  }

  async update(id: number, data: Partial<Patient>): Promise<Patient | null> {
    const result = await this.db
      .update(patients)
      .set(data)
      .where(eq(patients.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(patients)
      .where(eq(patients.id, id))
      .returning()

    return result.length > 0
  }

  async getPatientsByDoctorId(doctorId: number): Promise<Patient[]> {
    // まず、その医師が担当した予約を取得
    const doctorAppointments = await this.db
      .select({ patientId: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.assignedWorkerId, doctorId))
      .all()

    if (doctorAppointments.length === 0) {
      return []
    }

    // 重複を排除してpatientIdのリストを作成
    const uniquePatientIds = [
      ...new Set(doctorAppointments.map(a => a.patientId))
    ]

    // 各患者の詳細情報を取得
    const patients: Patient[] = []
    for (const patientId of uniquePatientIds) {
      const patient = await this.findById(patientId)
      if (patient) {
        patients.push(patient)
      }
    }

    return patients
  }

  async getPatientByIdAndDoctorId(patientId: number, doctorId: number): Promise<Patient | null> {
    // まず、その医師がその患者を担当したことがあるかチェック
    const appointmentExists = await this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.assignedWorkerId, doctorId)
        )
      )
      .limit(1)
      .all()

    if (appointmentExists.length === 0) {
      return null
    }

    // 患者の詳細情報を取得
    return this.findById(patientId)
  }
}
