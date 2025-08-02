import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { MockRepositoryFactory } from '../repositories/mock/factory'
import appointmentHandlers from '../api/handlers/appointments'
import questionnaireHandlers from '../api/handlers/questionnaire'
import { authMiddleware } from '../auth/middleware'

// Mock auth middleware
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    const userType = c.req.path.includes('/patient/') ? 'patient' : 'worker'
    c.set('user', {
      sub: userType === 'patient' ? 'patient1' : 'doctor1',
      userType,
      id: 1,
      role: userType === 'worker' ? 'doctor' : undefined
    })
    await next()
  }
}))

// Mock database initialization to return mock factory
vi.mock('../app', () => ({
  initializeDatabase: vi.fn(() => ({})), // Return a dummy object
  Env: {}
}))

vi.mock('../repositories', () => ({
  DrizzleRepositoryFactory: vi.fn().mockImplementation(() => {
    return new MockRepositoryFactory({
      appointments: [
        {
          id: 1,
          patientId: 1,
          assignedWorkerId: 1,
          scheduledAt: new Date('2025-01-31 09:00'),
          durationMinutes: 30,
          status: 'scheduled',
          appointmentType: 'initial',
          chiefComplaint: '発熱と頭痛',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ],
      questionnaires: [
        {
          id: 1,
          appointmentId: 1,
          questionsAnswers: '{"symptoms": "発熱と頭痛", "symptom_duration": "2-3日前"}',
          aiSummary: null,
          urgencyLevel: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
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

describe('Phase 2 APIs with Repository Pattern', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a new Hono app and mount handlers
    app = new Hono()
    app.route('/api/patient/appointments', appointmentHandlers)
    app.route('/api/patient/questionnaire', questionnaireHandlers)
  })

  describe('予約API', () => {
    describe('GET /api/patient/appointments/available-slots', () => {
      it('利用可能なスロットを取得できること', async () => {
        const res = await app.request(
          '/api/patient/appointments/available-slots?date=2025-01-31',
          {
            headers: {
              Authorization: 'Bearer valid-token'
            }
          },
          env
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toHaveProperty('slots')
        expect(Array.isArray(json.slots)).toBe(true)
        
        if (json.slots.length > 0) {
          expect(json.slots[0]).toHaveProperty('doctorId')
          expect(json.slots[0]).toHaveProperty('doctorName')
          expect(json.slots[0]).toHaveProperty('startTime')
          expect(json.slots[0]).toHaveProperty('endTime')
          expect(json.slots[0]).toHaveProperty('available')
        }
      })

      it('日付パラメータがない場合400エラーを返すこと', async () => {
        const res = await app.request(
          '/api/patient/appointments/available-slots',
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

    describe('POST /api/patient/appointments', () => {
      it('新規予約を作成できること', async () => {
        const newAppointment = {
          doctorId: 1,
          appointmentDate: '2025-01-31',
          startTime: '14:00',
          endTime: '14:30',
          appointmentType: '初診',
          chiefComplaint: '発熱と頭痛',
        }

        const res = await app.request(
          '/api/patient/appointments',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify(newAppointment)
          },
          env
        )

        expect(res.status).toBe(201)
        const json = await res.json()
        expect(json).toHaveProperty('appointment')
        expect(json.appointment).toHaveProperty('id')
        expect(json.appointment.patientId).toBe(1)
        expect(json.appointment.doctorId).toBe(1)
        expect(json.appointment.status).toBe('scheduled')
      })

      it('必須フィールドが不足している場合400エラーを返すこと', async () => {
        const incompleteAppointment = {
          doctorId: 1,
          // appointmentDate, startTime, endTimeが不足
        }

        const res = await app.request(
          '/api/patient/appointments',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify(incompleteAppointment)
          },
          env
        )

        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toContain('必須フィールド')
      })
    })

    describe('GET /api/patient/appointments', () => {
      it('患者の予約一覧を取得できること', async () => {
        const res = await app.request(
          '/api/patient/appointments',
          {
            headers: {
              Authorization: 'Bearer valid-token'
            }
          },
          env
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toHaveProperty('appointments')
        expect(Array.isArray(json.appointments)).toBe(true)
        expect(json).toHaveProperty('pagination')
        
        if (json.appointments.length > 0) {
          expect(json.appointments[0]).toHaveProperty('id')
          expect(json.appointments[0]).toHaveProperty('scheduledAt')
          expect(json.appointments[0]).toHaveProperty('status')
        }
      })
    })
  })

  describe('問診API', () => {
    describe('GET /api/patient/questionnaire/:appointmentId', () => {
      it('問診票を取得できること', async () => {
        const res = await app.request(
          '/api/patient/questionnaire/1',
          {
            headers: {
              Authorization: 'Bearer valid-token'
            }
          },
          env
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toHaveProperty('questionnaire')
        expect(json.questionnaire).toHaveProperty('appointmentId', 1)
        expect(json.questionnaire).toHaveProperty('answers')
        expect(json.questionnaire.answers).toHaveProperty('symptoms', '発熱と頭痛')
      })

      it('存在しない予約の場合404エラーを返すこと', async () => {
        const res = await app.request(
          '/api/patient/questionnaire/999',
          {
            headers: {
              Authorization: 'Bearer valid-token'
            }
          },
          env
        )

        expect(res.status).toBe(404)
        const json = await res.json()
        expect(json.error).toBe('Appointment not found')
      })
    })

    describe('POST /api/patient/questionnaire/answer', () => {
      it('回答を保存できること', async () => {
        const answerData = {
          appointmentId: 1,
          questionId: 'allergies',
          answer: 'なし'
        }

        const res = await app.request(
          '/api/patient/questionnaire/answer',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify(answerData)
          },
          env
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toHaveProperty('success', true)
      })

      it('必須フィールドが不足している場合400エラーを返すこと', async () => {
        const incompleteAnswer = {
          appointmentId: 1,
          // questionId, answerが不足
        }

        const res = await app.request(
          '/api/patient/questionnaire/answer',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify(incompleteAnswer)
          },
          env
        )

        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toContain('必須フィールド')
      })
    })

    describe('POST /api/patient/questionnaire/complete', () => {
      it('問診票を完了できること', async () => {
        const res = await app.request(
          '/api/patient/questionnaire/complete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify({ appointmentId: 1 })
          },
          env
        )

        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json).toHaveProperty('success', true)
        expect(json).toHaveProperty('questionnaire')
        expect(json.questionnaire).toHaveProperty('completedAt')
      })

      it('appointmentIdがない場合400エラーを返すこと', async () => {
        const res = await app.request(
          '/api/patient/questionnaire/complete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer valid-token'
            },
            body: JSON.stringify({})
          },
          env
        )

        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toBe('appointmentIdが必要です')
      })
    })
  })
})