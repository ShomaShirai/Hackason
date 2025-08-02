import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { mockEnv, mockDb } from './setup'

// ビデオセッションAPIのモック実装
const createApp = () => {
  const app = new Hono()
  
  // セッション作成エンドポイント
  app.post('/api/video-sessions/create', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    const { appointmentId } = await c.req.json()
    
    // 予約の存在確認
    mockEnv.testAppointmentId = appointmentId
    const appointment = mockDb.appointments.find(a => a.id === appointmentId)
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404)
    }
    
    // 既存セッションの確認
    const existingSession = mockDb.videoSessions.find(s => s.appointmentId === appointmentId)
    if (existingSession) {
      // 既存セッションへの参加として処理
      return c.json({
        sessionId: existingSession.id,
        realtimeSessionId: existingSession.realtimeSessionId,
        token: 'mock-existing-session-token',
        status: existingSession.status,
        isNewSession: false,
      })
    }
    
    // 新規セッション作成
    const newSession = {
      id: 'test-session-' + Date.now(),
      appointmentId,
      realtimeSessionId: 'realtime-' + Date.now(),
      status: 'waiting',
      createdAt: new Date(),
    }
    mockDb.videoSessions.push(newSession)
    
    return c.json({
      sessionId: newSession.id,
      realtimeSessionId: newSession.realtimeSessionId,
      token: 'mock-new-session-token',
      status: newSession.status,
      isNewSession: true,
    })
  })
  
  // セッション参加エンドポイント
  app.post('/api/video-sessions/:sessionId/join', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    const sessionId = c.req.param('sessionId')
    const token = authHeader.split(' ')[1]
    
    // セッションの存在確認
    const session = mockDb.videoSessions.find(s => s.id === sessionId)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    
    // 権限チェック（簡易実装）
    // トークンから userId と userType を取得（モック）
    // mock-jwt-patient-1 形式のトークンをパース
    const parts = token.split('-')
    const userType = parts[2] // patient or worker
    const userId = parts[3] // userId
    
    // 予約情報を取得
    const appointment = mockDb.appointments.find(a => a.id === session.appointmentId)
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404)
    }
    
    // 患者の場合、自分の予約かチェック
    if (userType === 'patient' && appointment.patientId !== parseInt(userId)) {
      return c.json({ error: 'Permission denied' }, 403)
    }
    
    // 医師の場合、担当医かチェック
    if (userType === 'worker' && appointment.workerId !== parseInt(userId)) {
      return c.json({ error: 'Permission denied' }, 403)
    }
    
    // 参加者を追加
    const participant = {
      id: 'participant-' + Date.now(),
      videoSessionId: sessionId,
      userType,
      userId: parseInt(userId),
      joinedAt: new Date(),
      isActive: true,
    }
    mockDb.sessionParticipants.push(participant)
    
    return c.json({
      sessionId: session.id,
      realtimeSessionId: session.realtimeSessionId,
      token: 'mock-join-token',
      status: 'active',
      permissions: [
        { action: 'join', allowed: true },
        { action: 'leave', allowed: true },
        { action: 'mute', allowed: true },
        { action: 'unmute', allowed: true },
      ],
    })
  })
  
  // セッション終了エンドポイント
  app.post('/api/video-sessions/:sessionId/end', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    const sessionId = c.req.param('sessionId')
    const token = authHeader.split(' ')[1]
    
    // トークンから userType を取得（モック）
    const parts = token.split('-')
    const userType = parts[2] // patient or worker
    
    // 医師のみ終了可能
    if (userType !== 'worker') {
      return c.json({ error: 'Permission denied' }, 403)
    }
    
    // セッションの存在確認
    const session = mockDb.videoSessions.find(s => s.id === sessionId)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }
    
    // セッション終了
    session.status = 'ended'
    session.endedAt = new Date()
    
    return c.json({
      message: 'Session ended successfully',
    })
  })
  
  return app
}

describe('ビデオセッションAPI', () => {
  let app: ReturnType<typeof createApp>
  
  beforeEach(() => {
    app = createApp()
    // データをリセット
    mockDb.videoSessions = []
    mockDb.sessionParticipants = []
  })
  
  describe('セッション作成', () => {
    it('正常系：新規セッション作成', async () => {
      const res = await app.request('/api/video-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-patient-1',
        },
        body: JSON.stringify({
          appointmentId: 1,
        }),
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      
      expect(data).toHaveProperty('sessionId')
      expect(data).toHaveProperty('realtimeSessionId')
      expect(data).toHaveProperty('token')
      expect(data).toHaveProperty('isNewSession', true)
      expect(data.status).toBe('waiting')
    })
    
    it('異常系：重複セッション作成→既存セッションへの参加', async () => {
      // 最初のセッション作成
      await app.request('/api/video-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-patient-1',
        },
        body: JSON.stringify({
          appointmentId: 1,
        }),
      })
      
      // 2回目の作成試行
      const res = await app.request('/api/video-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-worker-1',
        },
        body: JSON.stringify({
          appointmentId: 1,
        }),
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      
      expect(data).toHaveProperty('isNewSession', false)
      expect(data).toHaveProperty('sessionId')
      expect(data).toHaveProperty('token', 'mock-existing-session-token')
    })
  })
  
  describe('既存セッションへの参加', () => {
    beforeEach(async () => {
      // セッションを事前に作成
      await app.request('/api/video-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-patient-1',
        },
        body: JSON.stringify({
          appointmentId: 1,
        }),
      })
    })
    
    it('正常系：医師が既存セッションに参加', async () => {
      const sessionId = mockDb.videoSessions[0].id
      
      const res = await app.request(`/api/video-sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-worker-1',
        },
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      
      expect(data).toHaveProperty('sessionId', sessionId)
      expect(data).toHaveProperty('token')
      expect(data).toHaveProperty('permissions')
      expect(data.status).toBe('active')
      
      // 参加者が追加されているか確認
      expect(mockDb.sessionParticipants).toHaveLength(1)
      expect(mockDb.sessionParticipants[0]).toMatchObject({
        videoSessionId: sessionId,
        userType: 'worker',
        userId: 1,
        isActive: true,
      })
    })
    
    it('異常系：権限のないユーザーの参加拒否', async () => {
      const sessionId = mockDb.videoSessions[0].id
      
      // 別の患者としてアクセス
      const res = await app.request(`/api/video-sessions/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-patient-2',
        },
      })
      
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data).toHaveProperty('error', 'Permission denied')
    })
  })
  
  describe('セッション終了', () => {
    beforeEach(async () => {
      // セッションを事前に作成
      await app.request('/api/video-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-patient-1',
        },
        body: JSON.stringify({
          appointmentId: 1,
        }),
      })
    })
    
    it('正常系：医師によるセッション終了', async () => {
      const sessionId = mockDb.videoSessions[0].id
      
      const res = await app.request(`/api/video-sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-worker-1',
        },
      })
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('message', 'Session ended successfully')
      
      // セッションステータスが更新されているか確認
      const session = mockDb.videoSessions[0]
      expect(session.status).toBe('ended')
      expect(session.endedAt).toBeDefined()
    })
  })
})