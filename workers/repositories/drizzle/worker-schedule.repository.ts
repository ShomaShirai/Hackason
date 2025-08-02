import { eq, and, gte, lte, desc, asc, between } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { workerSchedules } from '../../db/schema'
import type { WorkerSchedule, NewWorkerSchedule } from '../../db/types'
import type { WorkerScheduleRepository, FindOptions } from '../interfaces'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleWorkerScheduleRepository implements WorkerScheduleRepository {
  constructor(private db: Database) {}

  async findById(id: number): Promise<WorkerSchedule | null> {
    const result = await this.db
      .select()
      .from(workerSchedules)
      .where(eq(workerSchedules.id, id))
      .limit(1)
      .all()

    return result[0] ?? null
  }

  async findAll(options?: FindOptions): Promise<WorkerSchedule[]> {
    let query = this.db.select().from(workerSchedules)

    if (options?.orderBy) {
      const column = workerSchedules[options.orderBy as keyof typeof workerSchedules]
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

  async create(data: Partial<NewWorkerSchedule>): Promise<WorkerSchedule> {
    const result = await this.db
      .insert(workerSchedules)
      .values({
        workerId: data.workerId!,
        scheduleDate: data.scheduleDate!,
        startTime: data.startTime!,
        endTime: data.endTime!,
        status: data.status!,
        maxAppointments: data.maxAppointments ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()
      .all()

    return result[0]!
  }

  async update(id: number, data: Partial<WorkerSchedule>): Promise<WorkerSchedule | null> {
    const result = await this.db
      .update(workerSchedules)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(workerSchedules.id, id))
      .returning()
      .all()

    return result[0] ?? null
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(workerSchedules)
      .where(eq(workerSchedules.id, id))
      .returning()
      .all()

    return result.length > 0
  }

  async findByWorkerId(workerId: number, startDate: Date, endDate: Date): Promise<WorkerSchedule[]> {
    return await this.db
      .select()
      .from(workerSchedules)
      .where(
        and(
          eq(workerSchedules.workerId, workerId),
          gte(workerSchedules.scheduleDate, startDate),
          lte(workerSchedules.scheduleDate, endDate)
        )
      )
      .orderBy(asc(workerSchedules.scheduleDate))
      .all()
  }

  async findByDate(date: Date): Promise<WorkerSchedule[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return await this.db
      .select()
      .from(workerSchedules)
      .where(
        between(workerSchedules.scheduleDate, startOfDay, endOfDay)
      )
      .all()
  }

  async bulkCreate(schedules: Partial<NewWorkerSchedule>[]): Promise<WorkerSchedule[]> {
    const results: WorkerSchedule[] = []

    // トランザクションがサポートされていない場合は個別に作成
    for (const schedule of schedules) {
      const result = await this.create(schedule)
      results.push(result)
    }

    return results
  }

  async deleteByWorkerIdAndDateRange(workerId: number, startDate: Date, endDate: Date): Promise<boolean> {
    const result = await this.db
      .delete(workerSchedules)
      .where(
        and(
          eq(workerSchedules.workerId, workerId),
          gte(workerSchedules.scheduleDate, startDate),
          lte(workerSchedules.scheduleDate, endDate)
        )
      )
      .returning()
      .all()

    return result.length > 0
  }
}
