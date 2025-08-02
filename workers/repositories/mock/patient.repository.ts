import type { PatientRepository, FindOptions } from '../interfaces'
import type { Patient } from '../../db/schema'

export class MockPatientRepository implements PatientRepository {
  private patients: Patient[]
  private appointments: any[]

  constructor(initialData: any[] = [], appointments: any[] = []) {
    this.patients = initialData
    this.appointments = appointments
  }

  async findById(id: number): Promise<Patient | null> {
    return this.patients.find(p => p.id === id) || null
  }

  async findAll(options?: FindOptions): Promise<Patient[]> {
    let result = [...this.patients]

    if (options?.offset) {
      result = result.slice(options.offset)
    }

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  async findByEmail(email: string): Promise<Patient | null> {
    return this.patients.find(p => p.email === email) || null
  }

  async create(data: Partial<Patient>): Promise<Patient> {
    if (!data.email || !data.name || !data.passwordHash) {
      throw new Error('Required fields are missing')
    }

    const newPatient: Patient = {
      id: this.patients.length + 1,
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      phoneNumber: data.phoneNumber || null,
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || null,
      address: data.address || null,
      emergencyContact: data.emergencyContact || '{}',
      medicalHistory: data.medicalHistory || '{}',
      profileImageUrl: data.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.patients.push(newPatient)
    return newPatient
  }

  async update(id: number, data: Partial<Patient>): Promise<Patient | null> {
    const index = this.patients.findIndex(p => p.id === id)
    if (index === -1) {
      return null
    }

    this.patients[index] = {
      ...this.patients[index],
      ...data,
      updatedAt: new Date()
    }
    return this.patients[index]
  }

  async delete(id: number): Promise<boolean> {
    const index = this.patients.findIndex(p => p.id === id)
    if (index === -1) {
      return false
    }

    this.patients.splice(index, 1)
    return true
  }

  async getPatientsByDoctorId(doctorId: number): Promise<Patient[]> {
    // この医師が担当した予約から患者IDを取得
    const doctorAppointments = this.appointments.filter(
      (appointment: any) => appointment.workerId === doctorId
    )

    // 重複を排除して患者IDのリストを作成
    const uniquePatientIds = [
      ...new Set(doctorAppointments.map((appointment: any) => appointment.patientId))
    ]

    // 該当する患者の詳細情報を取得
    return this.patients.filter(patient =>
      uniquePatientIds.includes(patient.id)
    )
  }

  async getPatientByIdAndDoctorId(patientId: number, doctorId: number): Promise<Patient | null> {
    // この医師がこの患者を担当したことがあるかチェック
    const hasAppointment = this.appointments.some(
      (appointment: any) =>
        appointment.patientId === patientId && appointment.workerId === doctorId
    )

    if (!hasAppointment) {
      return null
    }

    // 患者の詳細情報を取得
    return this.findById(patientId)
  }
}
