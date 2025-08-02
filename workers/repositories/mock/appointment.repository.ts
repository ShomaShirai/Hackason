import type { AppointmentRepository, AvailableSlot, FindOptions } from '../interfaces'
import type { Appointment } from '../../db/schema'

export class MockAppointmentRepository implements AppointmentRepository {
  private appointments: Map<number, any> = new Map()
  private nextId = 1

  constructor(initialData: any[] = []) {
    initialData.forEach(appointment => {
      this.appointments.set(appointment.id, appointment)
      if (appointment.id >= this.nextId) {
        this.nextId = appointment.id + 1
      }
    })
  }

  async findById(id: number): Promise<Appointment | null> {
    return this.appointments.get(id) || null
  }

  async findAll(options?: FindOptions): Promise<Appointment[]> {
    let results = Array.from(this.appointments.values())
    
    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = a[options.orderBy!]
        const bVal = b[options.orderBy!]
        const order = options.orderDirection === 'desc' ? -1 : 1
        return aVal < bVal ? -order : order
      })
    }
    
    if (options?.offset) {
      results = results.slice(options.offset)
    }
    
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }
    
    return results
  }

  async create(data: Partial<Appointment>): Promise<Appointment> {
    if (!data.patientId || !data.scheduledAt) {
      throw new Error('Required fields are missing')
    }
    
    const appointment: Appointment = {
      id: this.nextId++,
      patientId: data.patientId,
      assignedWorkerId: data.assignedWorkerId || null,
      scheduledAt: data.scheduledAt,
      status: data.status || 'scheduled',
      chiefComplaint: data.chiefComplaint || null,
      meetingId: data.meetingId || null,
      appointmentType: data.appointmentType || 'initial',
      durationMinutes: data.durationMinutes || 30,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.appointments.set(appointment.id, appointment)
    return appointment
  }

  async update(id: number, data: Partial<Appointment>): Promise<Appointment | null> {
    const existing = this.appointments.get(id)
    if (!existing) {
      return null
    }
    
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    }
    this.appointments.set(id, updated)
    return updated
  }

  async delete(id: number): Promise<boolean> {
    return this.appointments.delete(id)
  }

  async findByPatientId(patientId: number, options?: FindOptions): Promise<Appointment[]> {
    const results = Array.from(this.appointments.values())
      .filter(apt => apt.patientId === patientId)
    
    return this.applyOptions(results, options)
  }

  async findByWorkerId(workerId: number, options?: FindOptions): Promise<Appointment[]> {
    const results = Array.from(this.appointments.values())
      .filter(apt => apt.assignedWorkerId === workerId)
    
    return this.applyOptions(results, options)
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(apt => {
        const aptDate = new Date(apt.scheduledAt)
        return aptDate >= startDate && aptDate < endDate
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  async findAvailableSlots(_date: Date, doctorId?: number): Promise<AvailableSlot[]> {
    // モックデータを返す
    const slots: AvailableSlot[] = []
    const doctors = doctorId 
      ? [{ id: doctorId, name: 'テスト医師', specialty: '内科' }]
      : [
          { id: 1, name: '山田太郎', specialty: '内科' },
          { id: 2, name: '佐藤花子', specialty: '小児科' }
        ]
    
    for (const doctor of doctors) {
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          const endHour = minute === 30 ? hour + 1 : hour
          const endMinute = minute === 30 ? 0 : 30
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
          
          slots.push({
            doctorId: doctor.id,
            doctorName: doctor.name,
            specialty: doctor.specialty,
            startTime,
            endTime,
            available: Math.random() > 0.3, // ランダムに空き状況を設定
          })
        }
      }
    }
    
    return slots
  }

  async findConflicting(doctorId: number, startTime: Date, endTime: Date) {
    return Array.from(this.appointments.values())
      .filter(apt => {
        if (apt.assignedWorkerId !== doctorId) {
          return false
        }
        
        const aptStart = new Date(apt.scheduledAt)
        const aptEnd = new Date(aptStart)
        aptEnd.setMinutes(aptEnd.getMinutes() + (apt.durationMinutes || 30))
        
        return (startTime < aptEnd && endTime > aptStart)
      })
  }

  async updateStatus(id: number, status: string): Promise<Appointment | null> {
    return this.update(id, { status: status as any })
  }

  private applyOptions(results: any[], options?: FindOptions) {
    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = a[options.orderBy!]
        const bVal = b[options.orderBy!]
        const order = options.orderDirection === 'desc' ? -1 : 1
        return aVal < bVal ? -order : order
      })
    }
    
    if (options?.offset) {
      results = results.slice(options.offset)
    }
    
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }
    
    return results
  }
}