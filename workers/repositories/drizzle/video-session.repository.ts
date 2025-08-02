import { eq, and } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { videoSessions } from '../../db/schema'
import type { VideoSessionRepository } from '../interfaces'
import type { VideoSession } from '../../db/types'

type Database = DrizzleD1Database | LibSQLDatabase

export class DrizzleVideoSessionRepository implements VideoSessionRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<VideoSession | null> {
    const results = await this.db
      .select()
      .from(videoSessions)
      .where(eq(videoSessions.id, id))
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<VideoSession[]> {
    let query = this.db.select().from(videoSessions)

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.offset(options.offset)
    }

    return await query.all()
  }

  async findByAppointmentId(appointmentId: number): Promise<VideoSession | null> {
    const results = await this.db
      .select()
      .from(videoSessions)
      .where(
        and(
          eq(videoSessions.appointmentId, appointmentId),
          eq(videoSessions.status, 'active')
        )
      )
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async findActiveSession(sessionId: string): Promise<VideoSession | null> {
    const results = await this.db
      .select()
      .from(videoSessions)
      .where(
        and(
          eq(videoSessions.id, sessionId),
          eq(videoSessions.status, 'active')
        )
      )
      .limit(1)
      .all()

    return results[0] ?? null
  }

  async updateSessionStatus(sessionId: string, status: string): Promise<VideoSession | null> {
    const result = await this.db
      .update(videoSessions)
      .set({
        status: status as 'scheduled' | 'waiting' | 'active' | 'ended' | 'failed',
        endedAt: status === 'ended' ? new Date() : undefined
      })
      .where(eq(videoSessions.id, sessionId))
      .returning()
      .all()

    return result[0] ?? null
  }

  async create(data: Omit<VideoSession, 'updatedAt'> & { id: string }): Promise<VideoSession> {
    const result = await this.db
      .insert(videoSessions)
      .values({
        id: data.id,
        appointmentId: data.appointmentId,
        realtimeSessionId: data.realtimeSessionId,
        status: data.status,
        createdAt: data.createdAt,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        recordingUrl: data.recordingUrl,
        participants: data.participants,
        endReason: data.endReason,
        sessionMetrics: data.sessionMetrics
      })
      .returning()
      .all()

    return result[0]!
  }

  async update(id: string, data: Partial<VideoSession>): Promise<VideoSession | null> {
    const result = await this.db
      .update(videoSessions)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(videoSessions.id, id))
      .returning()
      .all()

    return result[0] ?? null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(videoSessions)
      .where(eq(videoSessions.id, id))
      .returning()
      .all()

    return result.length > 0
  }
}
