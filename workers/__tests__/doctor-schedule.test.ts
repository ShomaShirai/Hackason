import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import doctorScheduleHandlers from '../api/handlers/doctor-schedule'

// Mock auth middleware
let mockRole = 'doctor'
let mockUserId = 2
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    if (mockRole === 'unauthenticated') {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userType = 'worker'
    c.set('user', {
      sub: `doctor${mockUserId}`,
      userType,
      id: mockUserId,
      role: mockRole
    })
    await next()
  }
}))

// Simple mock for database
const mockDbResponse: any = []
let mockScheduleData: any = null

vi.mock('../app', () => ({
  initializeDatabase: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockDbResponse)),
            then: vi.fn((resolve) => resolve(mockDbResponse))
          })),
          then: vi.fn((resolve) => resolve(mockDbResponse)),
          get: vi.fn(() => Promise.resolve(mockScheduleData)),
          all: vi.fn(() => Promise.resolve(mockDbResponse))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            id: 1,
            workerId: 2,
            scheduleDate: '2025-08-02',
            startTime: '10:00',
            endTime: '12:00',
            status: 'available',
            maxAppointments: 8,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({
              id: 1,
              workerId: 2,
              scheduleDate: '2025-08-02',
              startTime: '14:00',
              endTime: '16:00',
              status: 'available',
              maxAppointments: 10,
              updatedAt: new Date()
            }))
          }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    }))
  })),
  Env: {}
}))

// Mock drizzle ORM functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'mocked-eq'),
  and: vi.fn(() => 'mocked-and'),
  gte: vi.fn(() => 'mocked-gte'),
  lte: vi.fn(() => 'mocked-lte'),
  or: vi.fn(() => 'mocked-or')
}))

// Mock schema
vi.mock('../db/schema', () => ({
  workerSchedules: {
    id: 'id',
    workerId: 'workerId',
    scheduleDate: 'scheduleDate',
    startTime: 'startTime',
    endTime: 'endTime',
    status: 'status',
    maxAppointments: 'maxAppointments'
  }
}))

describe('Doctor Schedule API', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    mockRole = 'doctor'
    mockUserId = 2

    app = new Hono()
    app.route('/api/worker/doctor/schedule', doctorScheduleHandlers)
  })

  describe('GET /api/worker/doctor/schedule', () => {
    it('should return 403 when user is not a doctor', async () => {
      mockRole = 'operator'

      const resp = await app.request('/api/worker/doctor/schedule')
      expect(resp.status).toBe(403)
    })

    it('should return 200 for valid doctor request', async () => {
      const resp = await app.request('/api/worker/doctor/schedule')
      expect(resp.status).toBe(200)
    })
  })

  describe('POST /api/worker/doctor/schedule', () => {
    it('should return 201 for valid schedule creation', async () => {
      const newSchedule = {
        date: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        maxAppointments: 8
      }

      const resp = await app.request('/api/worker/doctor/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSchedule)
      })

      expect(resp.status).toBe(201)
    })

    it('should return 400 for missing required fields', async () => {
      const incompleteSchedule = {
        date: '2025-08-02'
        // missing startTime, endTime
      }

      const resp = await app.request('/api/worker/doctor/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(incompleteSchedule)
      })

      expect(resp.status).toBe(400)
    })

    it('should return 403 when user is not a doctor', async () => {
      mockRole = 'operator'

      const newSchedule = {
        date: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        maxAppointments: 8
      }

      const resp = await app.request('/api/worker/doctor/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSchedule)
      })

      expect(resp.status).toBe(403)
    })
  })

  describe('PUT /api/worker/doctor/schedule/:id', () => {
    it('should return 200 for valid schedule update', async () => {
      // Set mock data for existing schedule
      mockScheduleData = {
        id: 1,
        workerId: 2, // Same as mockUserId
        scheduleDate: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'available',
        maxAppointments: 8
      }
      mockDbResponse.length = 0 // No conflicting schedules

      const updateData = {
        date: '2025-08-02',
        startTime: '14:00',
        endTime: '16:00',
        maxAppointments: 10
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(resp.status).toBe(200)
    })

    it('should return 404 when schedule does not exist', async () => {
      // Set mock data to null (schedule not found)
      mockScheduleData = null

      const updateData = {
        date: '2025-08-02',
        startTime: '14:00',
        endTime: '16:00',
        maxAppointments: 10
      }

      const resp = await app.request('/api/worker/doctor/schedule/999', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(resp.status).toBe(404)
    })

    it('should return 403 when user is not the owner of the schedule', async () => {
      // Set mock data for schedule belonging to different doctor
      mockScheduleData = {
        id: 1,
        workerId: 999, // Different from mockUserId (2)
        scheduleDate: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'available',
        maxAppointments: 8
      }

      const updateData = {
        date: '2025-08-02',
        startTime: '14:00',
        endTime: '16:00',
        maxAppointments: 10
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(resp.status).toBe(403)
    })

    it('should return 400 for invalid time range', async () => {
      // Set mock data for existing schedule
      mockScheduleData = {
        id: 1,
        workerId: 2,
        scheduleDate: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'available',
        maxAppointments: 8
      }

      const updateData = {
        date: '2025-08-02',
        startTime: '16:00',
        endTime: '14:00', // End time before start time
        maxAppointments: 10
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(resp.status).toBe(400)
    })

    it('should return 403 when user is not a doctor', async () => {
      mockRole = 'operator'

      const updateData = {
        date: '2025-08-02',
        startTime: '14:00',
        endTime: '16:00',
        maxAppointments: 10
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      expect(resp.status).toBe(403)
    })
  })

  describe('DELETE /api/worker/doctor/schedule/:id', () => {
    it('should return 204 for successful deletion', async () => {
      // Set mock data for existing schedule
      mockScheduleData = {
        id: 1,
        workerId: 2, // Same as mockUserId
        scheduleDate: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'available',
        maxAppointments: 8
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'DELETE'
      })

      expect(resp.status).toBe(204)
    })

    it('should return 404 when schedule does not exist', async () => {
      // Set mock data to null (schedule not found)
      mockScheduleData = null

      const resp = await app.request('/api/worker/doctor/schedule/999', {
        method: 'DELETE'
      })

      expect(resp.status).toBe(404)
    })

    it('should return 403 when user is not the owner of the schedule', async () => {
      // Set mock data for schedule belonging to different doctor
      mockScheduleData = {
        id: 1,
        workerId: 999, // Different from mockUserId (2)
        scheduleDate: '2025-08-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'available',
        maxAppointments: 8
      }

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'DELETE'
      })

      expect(resp.status).toBe(403)
    })

    it('should return 403 when user is not a doctor', async () => {
      mockRole = 'operator'

      const resp = await app.request('/api/worker/doctor/schedule/1', {
        method: 'DELETE'
      })

      expect(resp.status).toBe(403)
    })
  })
})
