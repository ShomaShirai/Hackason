import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { questionnaires } from '../../db/schema'
import type { QuestionnaireRepository, FindOptions } from '../interfaces'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleQuestionnaireRepository implements QuestionnaireRepository {
  constructor(private db: Database) {}

  async findById(id: number) {
    return await this.db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.id, id))
      .get()
  }

  async findAll(options?: FindOptions) {
    let query = this.db.select().from(questionnaires)
    
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    
    if (options?.offset) {
      query = query.offset(options.offset)
    }
    
    return await query.all()
  }

  async create(data: Partial<typeof questionnaires.$inferInsert>) {
    const result = await this.db
      .insert(questionnaires)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get()
    
    return result
  }

  async update(id: number, data: Partial<typeof questionnaires.$inferInsert>) {
    const result = await this.db
      .update(questionnaires)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.id, id))
      .returning()
      .get()
    
    return result
  }

  async delete(id: number) {
    const result = await this.db
      .delete(questionnaires)
      .where(eq(questionnaires.id, id))
      .run()
    
    return result.meta.changes > 0
  }

  async findByAppointmentId(appointmentId: number) {
    return await this.db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.appointmentId, appointmentId))
      .get()
  }

  async updateAnswers(id: number, answers: Record<string, any>) {
    // 既存の回答を取得
    const existing = await this.findById(id)
    if (!existing) {
      return null
    }

    const currentAnswers = existing.answers ? JSON.parse(existing.answers) : {}
    const updatedAnswers = { ...currentAnswers, ...answers }

    return await this.db
      .update(questionnaires)
      .set({
        answers: JSON.stringify(updatedAnswers),
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.id, id))
      .returning()
      .get()
  }

  async markAsCompleted(id: number) {
    return await this.db
      .update(questionnaires)
      .set({
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.id, id))
      .returning()
      .get()
  }
}