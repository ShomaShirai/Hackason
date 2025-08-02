import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { chatMessages } from '../../db/schema'
import type { ChatMessage, NewChatMessage } from '../../db/types'
import type { ChatMessageRepository } from '../interfaces'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleChatMessageRepository implements ChatMessageRepository {
  constructor(private db: Database) {}

  async findById(id: number): Promise<ChatMessage | null> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<ChatMessage[]> {
    let query = this.db.select().from(chatMessages).orderBy(desc(chatMessages.sentAt))

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async findByAppointmentId(
    appointmentId: number,
    options?: { limit?: number; offset?: number }
  ): Promise<ChatMessage[]> {
    let query = this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.appointmentId, appointmentId))
      .orderBy(asc(chatMessages.sentAt))

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async create(data: Partial<NewChatMessage>): Promise<ChatMessage> {
    const result = await this.db
      .insert(chatMessages)
      .values({
        appointmentId: data.appointmentId!,
        patientId: data.patientId ?? null,
        workerId: data.workerId ?? null,
        messageType: data.messageType ?? 'text',
        content: data.content!,
        sentAt: data.sentAt ?? new Date(),
        readAt: data.readAt ?? null
      })
      .returning()
      .all()

    return result[0]!
  }

  async update(id: number, data: Partial<ChatMessage>): Promise<ChatMessage | null> {
    const result = await this.db
      .update(chatMessages)
      .set(data)
      .where(eq(chatMessages.id, id))
      .returning()
      .all()

    return result[0] ?? null
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.id, id))
      .returning()
      .all()

    return result.length > 0
  }

  async markAsRead(messageId: number, readAt: Date): Promise<ChatMessage | null> {
    const result = await this.db
      .update(chatMessages)
      .set({ readAt })
      .where(eq(chatMessages.id, messageId))
      .returning()
      .all()

    return result[0] ?? null
  }

  async countUnreadForUser(userId: number, userType: 'patient' | 'worker'): Promise<number> {
    let condition

    if (userType === 'patient') {
      // 患者の場合：医師からのメッセージ（workerId !== null, patientId === null）で未読
      condition = and(
        isNull(chatMessages.readAt),
        isNull(chatMessages.patientId)
      )
    } else {
      // 医師の場合：患者からのメッセージ（patientId !== null, workerId === null）で未読
      condition = and(
        isNull(chatMessages.readAt),
        isNull(chatMessages.workerId)
      )
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(condition)
      .all()

    return result[0]?.count ?? 0
  }
}
