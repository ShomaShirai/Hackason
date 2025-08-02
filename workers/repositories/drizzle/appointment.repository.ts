import { eq, and, gte, lt, lte, desc, asc, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { appointments, workers } from '../../db/schema'
import { createJstDate, utcToJstDateString } from '../../utils/timezone'
import type { Appointment, NewAppointment } from '../../db/types'
import type { AppointmentRepository, AvailableSlot, FindOptions } from '../interfaces'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleAppointmentRepository implements AppointmentRepository {
  constructor(private db: Database) {}

  async findById(id: number): Promise<Appointment | null> {
    const result = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1)
      .all()

    return result[0] ?? null
  }

  async findAll(options?: FindOptions): Promise<Appointment[]> {
    let query = this.db.select().from(appointments)

    if (options?.orderBy) {
      const column = appointments[options.orderBy as keyof typeof appointments]
      query = options.orderDirection === 'desc'
        ? query.orderBy(desc(column))
        : query.orderBy(asc(column))
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async create(data: Partial<NewAppointment>): Promise<Appointment> {
    const result = await this.db
      .insert(appointments)
      .values({
        patientId: data.patientId!,
        scheduledAt: data.scheduledAt!,
        status: data.status || 'scheduled',
        chiefComplaint: data.chiefComplaint || '',
        appointmentType: data.appointmentType || 'initial',
        assignedWorkerId: data.assignedWorkerId,
        durationMinutes: data.durationMinutes || 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .all()

    return result[0]!
  }

  async update(id: number, data: Partial<typeof appointments.$inferInsert>) {
    const result = await this.db
      .update(appointments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning()
      .get()

    return result
  }

  async delete(id: number) {
    const result = await this.db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .run()

    return result.meta.changes > 0
  }

  async findByPatientId(patientId: number, options?: FindOptions) {
    let query = this.db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        assignedWorkerId: appointments.assignedWorkerId,
        scheduledAt: appointments.scheduledAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        appointmentType: appointments.appointmentType,
        chiefComplaint: appointments.chiefComplaint,
        startedAt: appointments.startedAt,
        endedAt: appointments.endedAt,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        doctorName: workers.name,
        doctorRole: workers.role,
      })
      .from(appointments)
      .leftJoin(workers, eq(appointments.assignedWorkerId, workers.id))
      .where(eq(appointments.patientId, patientId))

    if (options?.orderBy) {
      query = query.orderBy(desc(appointments[options.orderBy as keyof typeof appointments]))
    } else {
      query = query.orderBy(desc(appointments.scheduledAt))
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async findByWorkerId(workerId: number, options?: FindOptions) {
    let query = this.db
      .select()
      .from(appointments)
      .where(eq(appointments.assignedWorkerId, workerId))

    if (options?.orderBy) {
      query = query.orderBy(desc(appointments[options.orderBy as keyof typeof appointments]))
    } else {
      query = query.orderBy(desc(appointments.scheduledAt))
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return await this.db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.scheduledAt, startDate),
          lt(appointments.scheduledAt, endDate)
        )
      )
      .orderBy(asc(appointments.scheduledAt))
      .all()
  }

  async findAvailableSlots(date: Date, doctorId?: number): Promise<AvailableSlot[]> {
    // 医師リストを取得
    let doctorsQuery = this.db
      .select({
        id: workers.id,
        name: workers.name,
        role: workers.role,
      })
      .from(workers)
      .where(eq(workers.role, 'doctor'))

    if (doctorId) {
      doctorsQuery = doctorsQuery.where(eq(workers.id, doctorId))
    }

    const doctors = await doctorsQuery.all()

    // 各医師のスロットを生成
    const slots: AvailableSlot[] = []
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    for (const doctor of doctors) {
      // その日の予約を取得
      const existingAppointments = await this.db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.assignedWorkerId, doctor.id),
            gte(appointments.scheduledAt, startOfDay),
            lte(appointments.scheduledAt, endOfDay)
          )
        )
        .all()

      // 9:00-17:00の30分刻みでスロットを生成
      const dateStr = utcToJstDateString(date)
      
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          // JST時刻でスロットを作成し、UTCに変換
          const slotStart = createJstDate(dateStr, hour, minute)
          const slotEnd = createJstDate(dateStr, hour, minute + 30)

          // 既存予約との重複チェック
          const isBooked = existingAppointments.some(apt => {
            const aptStart = new Date(apt.scheduledAt)
            const aptEnd = new Date(aptStart)
            aptEnd.setMinutes(aptEnd.getMinutes() + (apt.durationMinutes || 30))

            return (slotStart >= aptStart && slotStart < aptEnd) ||
                   (slotEnd > aptStart && slotEnd <= aptEnd)
          })

          slots.push({
            doctorId: doctor.id,
            doctorName: doctor.name,
            specialty: doctor.role, // TODO: 専門科を別テーブルで管理
            startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
            endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
            available: !isBooked,
          })
        }
      }
    }

    return slots
  }

  async findConflicting(doctorId: number, startTime: Date, endTime: Date) {
    return await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.assignedWorkerId, doctorId),
          // 時間が重複する条件
          lt(appointments.scheduledAt, endTime),
          sql`datetime(${appointments.scheduledAt}, '+' || ${appointments.durationMinutes} || ' minutes') > ${startTime}`
        )
      )
      .all()
  }

  async updateStatus(id: number, status: string) {
    return await this.db
      .update(appointments)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning()
      .get()
  }
}
