import type { VideoSession } from '../../db/schema'
import type { VideoSessionRepository } from '../interfaces'

export class MockVideoSessionRepository implements VideoSessionRepository {
  private videoSessions: Map<string, VideoSession> = new Map()

  constructor(initialData: VideoSession[] = []) {
    initialData.forEach(session => {
      this.videoSessions.set(session.id, session)
    })
  }

  async findById(id: string): Promise<VideoSession | null> {
    return this.videoSessions.get(id) || null
  }

  async findAll(): Promise<VideoSession[]> {
    return Array.from(this.videoSessions.values())
  }

  async create(data: Partial<VideoSession>): Promise<VideoSession> {
    const session: VideoSession = {
      id: data.id || `session-${Date.now()}`,
      appointmentId: data.appointmentId!,
      realtimeSessionId: data.realtimeSessionId || null,
      status: data.status || 'waiting',
      recordingUrl: data.recordingUrl || null,
      participants: data.participants || null,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      endReason: data.endReason || null,
      sessionMetrics: data.sessionMetrics || null,
      createdAt: new Date(),
    }
    this.videoSessions.set(session.id, session)
    return session
  }

  async update(id: string, data: Partial<VideoSession>): Promise<VideoSession | null> {
    const existing = this.videoSessions.get(id)
    if (!existing) {
      return null
    }
    
    const updated = {
      ...existing,
      ...data,
    }
    this.videoSessions.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.videoSessions.delete(id)
  }

  async findByAppointmentId(appointmentId: number): Promise<VideoSession | null> {
    return Array.from(this.videoSessions.values())
      .find(session => session.appointmentId === appointmentId) || null
  }

  async findActiveSession(sessionId: string): Promise<VideoSession | null> {
    const session = this.videoSessions.get(sessionId)
    if (session && session.status === 'active') {
      return session
    }
    return null
  }

  async updateSessionStatus(sessionId: string, status: string): Promise<VideoSession | null> {
    return this.update(sessionId, { status: status as any })
  }
}