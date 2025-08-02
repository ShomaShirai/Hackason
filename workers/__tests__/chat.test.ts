import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { MockRepositoryFactory } from '../repositories/mock/factory'

// Mock auth middleware
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    const userType = c.req.header('X-User-Type') || 'patient'
    const userId = parseInt(c.req.header('X-User-Id') || '1')
    c.set('user', { 
      sub: `${userType}${userId}`,
      userType,
      id: userId,
      role: userType === 'worker' ? 'doctor' : undefined
    })
    await next()
  }
}))

// Mock database initialization
vi.mock('../app', () => ({
  initializeDatabase: vi.fn(() => ({})),
  Env: {}
}))

vi.mock('../repositories', () => ({
  DrizzleRepositoryFactory: vi.fn().mockImplementation(() => {
    return new MockRepositoryFactory({
      patients: [
        {
          id: 1,
          email: 'patient1@example.com',
          name: '山田太郎',
          passwordHash: 'hashed',
          phoneNumber: '090-1234-5678',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'male',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      workers: [
        {
          id: 2,
          email: 'doctor1@example.com',
          name: '田中医師',
          role: 'doctor',
          passwordHash: 'hashed',
          phoneNumber: '090-8765-4321',
          medicalLicenseNumber: 'MED123456',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      appointments: [
        {
          id: 1,
          patientId: 1,
          workerId: 2,
          appointmentDate: new Date('2025-02-01T10:00:00Z'),
          status: 'confirmed',
          appointmentType: 'initial',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      chatMessages: [
        {
          id: 1,
          appointmentId: 1,
          patientId: 1,
          workerId: null,
          messageType: 'text',
          content: '体調が悪いです',
          sentAt: new Date('2025-02-01T09:00:00Z'),
          readAt: null,
          createdAt: new Date('2025-02-01T09:00:00Z')
        },
        {
          id: 2,
          appointmentId: 1,
          patientId: null,
          workerId: 2,
          messageType: 'text',
          content: '具体的にどのような症状ですか？',
          sentAt: new Date('2025-02-01T09:05:00Z'),
          readAt: new Date('2025-02-01T09:10:00Z'),
          createdAt: new Date('2025-02-01T09:05:00Z')
        }
      ]
    })
  })
}))

// Import after mocks
const chatHandlers = await vi.importActual('../api/handlers/chat').then((m: any) => m.default)

const env = {
  DB: {} as any,
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_TOKEN_EXPIRY: 3600,
  JWT_REFRESH_TOKEN_EXPIRY: 604800,
}

describe('チャットAPI', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.route('/api/chat', chatHandlers)
  })

  describe('GET /api/chat/appointments/:appointmentId/messages', () => {
    it('患者が自分の予約のメッセージを取得できること', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages',
        {
          headers: {
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'patient',
            'X-User-Id': '1'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('messages')
      expect(Array.isArray(json.messages)).toBe(true)
      expect(json.messages).toHaveLength(2)
      expect(json.messages[0]).toHaveProperty('content', '体調が悪いです')
      expect(json.messages[0]).toHaveProperty('sender')
      expect(json.messages[0].sender).toHaveProperty('type', 'patient')
    })

    it('医師が担当予約のメッセージを取得できること', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages',
        {
          headers: {
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'worker',
            'X-User-Id': '2'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.messages).toHaveLength(2)
    })

    it('limitパラメータでメッセージ数を制限できること', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages?limit=1',
        {
          headers: {
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'patient',
            'X-User-Id': '1'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.messages).toHaveLength(1)
    })
  })

  describe('POST /api/chat/appointments/:appointmentId/messages', () => {
    it('患者がメッセージを送信できること', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'patient',
            'X-User-Id': '1'
          },
          body: JSON.stringify({
            content: '頭痛がひどいです',
            messageType: 'text'
          })
        },
        env
      )

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json).toHaveProperty('message')
      expect(json.message).toHaveProperty('content', '頭痛がひどいです')
      expect(json.message).toHaveProperty('patientId', 1)
      expect(json.message).toHaveProperty('workerId', null)
    })

    it('医師がメッセージを送信できること', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'worker',
            'X-User-Id': '2'
          },
          body: JSON.stringify({
            content: '薬を処方します',
            messageType: 'text'
          })
        },
        env
      )

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.message).toHaveProperty('workerId', 2)
      expect(json.message).toHaveProperty('patientId', null)
    })

    it('contentがない場合400エラーを返すこと', async () => {
      const res = await app.request(
        '/api/chat/appointments/1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'patient',
            'X-User-Id': '1'
          },
          body: JSON.stringify({
            messageType: 'text'
          })
        },
        env
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('メッセージ内容が必要です')
    })
  })

  describe('PUT /api/chat/messages/:messageId/read', () => {
    it('メッセージを既読にできること', async () => {
      const res = await app.request(
        '/api/chat/messages/1/read',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'worker',
            'X-User-Id': '2'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('readAt')
    })

    it('自分宛てでないメッセージは既読にできないこと', async () => {
      const res = await app.request(
        '/api/chat/messages/2/read',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer valid-token',
            'X-User-Type': 'worker',
            'X-User-Id': '3' // 別の医師
          }
        },
        env
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toContain('このメッセージを既読にする権限がありません')
    })
  })
})