import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { MockRepositoryFactory } from '../repositories/mock/factory'
import adminDoctorHandlers from '../api/handlers/admin-doctors'
// Mock auth middleware
let mockRole = 'admin'
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    const userType = 'worker'
    c.set('user', {
      sub: mockRole === 'admin' ? 'admin1' : 'doctor1',
      userType,
      id: mockRole === 'admin' ? 1 : 2,
      role: mockRole
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
      workers: [
        {
          id: 1,
          email: 'admin@example.com',
          name: '管理者',
          role: 'admin',
          passwordHash: 'hashed',
          phoneNumber: '090-0000-0000',
          medicalLicenseNumber: null,
          profileImageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          email: 'doctor1@example.com',
          name: '山田太郎',
          role: 'doctor',
          passwordHash: 'hashed',
          phoneNumber: '090-1111-1111',
          medicalLicenseNumber: 'MED123456',
          profileImageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 3,
          email: 'doctor2@example.com',
          name: '佐藤花子',
          role: 'doctor',
          passwordHash: 'hashed',
          phoneNumber: '090-2222-2222',
          medicalLicenseNumber: 'MED789012',
          profileImageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      workerSchedules: [
        {
          id: 1,
          workerId: 2,
          scheduleDate: new Date('2025-02-01'),
          startTime: '09:00',
          endTime: '17:00',
          status: 'available',
          maxAppointments: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          workerId: 2,
          scheduleDate: new Date('2025-02-02'),
          startTime: '09:00',
          endTime: '12:00',
          status: 'available',
          maxAppointments: 5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    })
  })
}))

const env = {
  DB: {} as any,
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_TOKEN_EXPIRY: 3600,
  JWT_REFRESH_TOKEN_EXPIRY: 604800,
}

describe('医師管理API', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a new Hono app and mount handlers
    app = new Hono()
    app.route('/api/worker/admin/doctors', adminDoctorHandlers)
  })

  describe('GET /api/worker/admin/doctors', () => {
    it('医師一覧を取得できること', async () => {
      const res = await app.request(
        '/api/worker/admin/doctors',
        {
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('doctors')
      expect(Array.isArray(json.doctors)).toBe(true)

      // 管理者以外の医師のみが返される
      expect(json.doctors).toHaveLength(2)
      expect(json.doctors[0].role).toBe('doctor')
      expect(json.doctors[0]).toHaveProperty('name')
      expect(json.doctors[0]).toHaveProperty('email')
      expect(json.doctors[0]).toHaveProperty('medicalLicenseNumber')
    })

    it('非管理者の場合403エラーを返すこと', async () => {
      // roleをdoctorに変更
      mockRole = 'doctor'

      const res = await app.request(
        '/api/worker/admin/doctors',
        {
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        env
      )

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe('Admin only')

      // モックをリセット
      mockRole = 'admin'
    })
  })

  describe('GET /api/worker/admin/doctors/:id/schedule', () => {
    it('医師のスケジュールを取得できること', async () => {
      const res = await app.request(
        '/api/worker/admin/doctors/2/schedule?date=2025-02',
        {
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('schedules')
      expect(Array.isArray(json.schedules)).toBe(true)

      if (json.schedules.length > 0) {
        expect(json.schedules[0]).toHaveProperty('scheduleDate')
        expect(json.schedules[0]).toHaveProperty('startTime')
        expect(json.schedules[0]).toHaveProperty('endTime')
        expect(json.schedules[0]).toHaveProperty('status')
        expect(json.schedules[0]).toHaveProperty('maxAppointments')
      }
    })

    it('日付パラメータがない場合400エラーを返すこと', async () => {
      const res = await app.request(
        '/api/worker/admin/doctors/2/schedule',
        {
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        env
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('日付パラメータが必要です')
    })
  })

  describe('PUT /api/worker/admin/doctors/:id/schedule', () => {
    it('医師のスケジュールを更新できること', async () => {
      const scheduleData = {
        schedules: [
          {
            date: '2025-02-03',
            startTime: '09:00',
            endTime: '17:00',
            status: 'available',
            maxAppointments: 12
          },
          {
            date: '2025-02-04',
            startTime: '13:00',
            endTime: '18:00',
            status: 'available',
            maxAppointments: 8
          }
        ]
      }

      const res = await app.request(
        '/api/worker/admin/doctors/2/schedule',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
          },
          body: JSON.stringify(scheduleData)
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('schedules')
      expect(json.schedules).toHaveLength(2)
    })

    it('必須フィールドが不足している場合400エラーを返すこと', async () => {
      const incompleteData = {
        schedules: [
          {
            date: '2025-02-03',
            // startTime, endTimeが不足
          }
        ]
      }

      const res = await app.request(
        '/api/worker/admin/doctors/2/schedule',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
          },
          body: JSON.stringify(incompleteData)
        },
        env
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('必須フィールド')
    })
  })

  describe('PUT /api/worker/admin/doctors/:id/status', () => {
    it('医師のアクティブ状態を更新できること', async () => {
      const res = await app.request(
        '/api/worker/admin/doctors/2/status',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
          },
          body: JSON.stringify({ isActive: false })
        },
        env
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('doctor')
      expect(json.doctor.isActive).toBe(false)
    })
  })
})
