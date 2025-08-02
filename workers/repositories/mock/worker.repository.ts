import type { WorkerRepository, FindOptions } from '../interfaces'
import type { Worker, NewWorker } from '../../db/types'

export class MockWorkerRepository implements WorkerRepository {
  private workers: Map<number, Worker> = new Map()
  private nextId = 1

  constructor(initialData: Worker[] = []) {
    initialData.forEach(worker => {
      this.workers.set(worker.id, worker)
      if (worker.id >= this.nextId) {
        this.nextId = worker.id + 1
      }
    })
  }

  async findById(id: number): Promise<Worker | null> {
    return this.workers.get(id) ?? null
  }

  async findAll(options?: FindOptions): Promise<Worker[]> {
    let results = Array.from(this.workers.values())

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

  async create(data: Partial<NewWorker>): Promise<Worker> {
    if (!data.email || !data.name || !data.role || !data.passwordHash) {
      throw new Error('Required fields are missing')
    }

    const worker: Worker = {
      id: this.nextId++,
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash: data.passwordHash,
      phoneNumber: data.phoneNumber ?? null,
      medicalLicenseNumber: data.medicalLicenseNumber ?? null,
      profileImageUrl: data.profileImageUrl ?? null,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.workers.set(worker.id, worker)
    return worker
  }

  async update(id: number, data: Partial<Worker>): Promise<Worker | null> {
    const existing = this.workers.get(id)
    if (!existing) {
      return null
    }

    const updated: Worker = {
      ...existing,
      ...data,
      id: existing.id, // IDは変更不可
      updatedAt: new Date(),
    }
    this.workers.set(id, updated)
    return updated
  }

  async delete(id: number): Promise<boolean> {
    return this.workers.delete(id)
  }

  async findByEmail(email: string): Promise<Worker | null> {
    return Array.from(this.workers.values())
      .find(w => w.email === email) ?? null
  }

  async findByRole(role: Worker['role']): Promise<Worker[]> {
    return Array.from(this.workers.values())
      .filter(w => w.role === role)
  }

  async findAvailableDoctors(_date: Date): Promise<Worker[]> {
    // モック実装: role が doctor で isActive が true の人を返す
    return Array.from(this.workers.values())
      .filter(w => w.role === 'doctor' && w.isActive)
  }

  /* private applyOptions<T>(results: T[], options?: FindOptions): T[] {
    if (options?.orderBy) {
      results.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[options.orderBy!]
        const bVal = (b as Record<string, unknown>)[options.orderBy!]
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
  } */
}
