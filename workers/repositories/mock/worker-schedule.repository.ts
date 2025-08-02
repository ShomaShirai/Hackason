import type { WorkerScheduleRepository, FindOptions } from '../interfaces'
import type { WorkerSchedule, NewWorkerSchedule } from '../../db/types'

export class MockWorkerScheduleRepository implements WorkerScheduleRepository {
  private schedules: Map<number, WorkerSchedule> = new Map()
  private nextId = 1

  constructor(initialData: WorkerSchedule[] = []) {
    initialData.forEach(schedule => {
      this.schedules.set(schedule.id, schedule)
      if (schedule.id >= this.nextId) {
        this.nextId = schedule.id + 1
      }
    })
  }

  async findById(id: number): Promise<WorkerSchedule | null> {
    return this.schedules.get(id) ?? null
  }

  async findAll(options?: FindOptions): Promise<WorkerSchedule[]> {
    let results = Array.from(this.schedules.values())

    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[options.orderBy!]
        const bVal = (b as Record<string, unknown>)[options.orderBy!]
        const order = options.orderDirection === 'desc' ? -1 : 1

        // 型ガード関数
        const isComparable = (val: unknown): val is string | number =>
          typeof val === 'string' || typeof val === 'number'

        // 型安全な比較ロジック
        if (isComparable(aVal) && isComparable(bVal) && typeof aVal === typeof bVal) {
          return aVal < bVal ? -order : aVal > bVal ? order : 0
        }

        // フォールバック: 文字列として比較
        return String(aVal) < String(bVal) ? -order : String(aVal) > String(bVal) ? order : 0
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

  async create(data: Partial<NewWorkerSchedule>): Promise<WorkerSchedule> {
    if (!data.workerId || !data.scheduleDate || !data.startTime || !data.endTime || !data.status) {
      throw new Error('Required fields are missing')
    }

    const schedule: WorkerSchedule = {
      id: this.nextId++,
      workerId: data.workerId,
      scheduleDate: data.scheduleDate,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      maxAppointments: data.maxAppointments ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.schedules.set(schedule.id, schedule)
    return schedule
  }

  async update(id: number, data: Partial<WorkerSchedule>): Promise<WorkerSchedule | null> {
    const existing = this.schedules.get(id)
    if (!existing) {
      return null
    }

    const updated: WorkerSchedule = {
      ...existing,
      ...data,
      id: existing.id, // IDは変更不可
      updatedAt: new Date(),
    }
    this.schedules.set(id, updated)
    return updated
  }

  async delete(id: number): Promise<boolean> {
    return this.schedules.delete(id)
  }

  async findByWorkerId(workerId: number, startDate: Date, endDate: Date): Promise<WorkerSchedule[]> {
    return Array.from(this.schedules.values())
      .filter(schedule => {
        const scheduleDate = new Date(schedule.scheduleDate)
        return schedule.workerId === workerId &&
               scheduleDate >= startDate &&
               scheduleDate <= endDate
      })
      .sort((a, b) => new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime())
  }

  async findByDate(date: Date): Promise<WorkerSchedule[]> {
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)

    return Array.from(this.schedules.values())
      .filter(schedule => {
        const scheduleDate = new Date(schedule.scheduleDate)
        scheduleDate.setHours(0, 0, 0, 0)
        return scheduleDate.getTime() === targetDate.getTime()
      })
  }

  async bulkCreate(schedules: Partial<NewWorkerSchedule>[]): Promise<WorkerSchedule[]> {
    const created: WorkerSchedule[] = []

    for (const scheduleData of schedules) {
      const schedule = await this.create(scheduleData)
      created.push(schedule)
    }

    return created
  }

  async deleteByWorkerIdAndDateRange(workerId: number, startDate: Date, endDate: Date): Promise<boolean> {
    const toDelete = await this.findByWorkerId(workerId, startDate, endDate)

    for (const schedule of toDelete) {
      this.schedules.delete(schedule.id)
    }

    return toDelete.length > 0
  }
}
