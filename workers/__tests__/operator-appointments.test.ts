import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { MockRepositoryFactory } from '../repositories/mock/factory';
import operatorAppointmentHandlers from '../api/handlers/operator-appointments';

// Mock auth middleware for an operator
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    c.set('user', {
      sub: 'operator1',
      userType: 'worker',
      id: 3, // Operator ID
      role: 'operator',
    });
    await next();
  },
}));

// Mock database initialization
vi.mock('../app', () => ({
  initializeDatabase: vi.fn(() => ({})),
  Env: {},
}));

const mockPatients = [
  {
    id: 1,
    name: '患者A',
    email: 'patientA@test.com',
    phoneNumber: '080-1111-2222',
  },
  {
    id: 2,
    name: '患者B',
    email: 'patientB@test.com',
    phoneNumber: '080-3333-4444',
  },
];

const mockWorkers = [
  { id: 2, name: '山田太郎', role: 'doctor' },
  { id: 3, name: '佐藤花子', role: 'operator' },
];

const mockAppointments = [
  {
    id: 1,
    patientId: 1,
    assignedWorkerId: 2,
    status: 'scheduled',
    scheduledAt: new Date('2025-02-01T10:00:00'),
    durationMinutes: 30,
    chiefComplaint: '頭痛',
    appointmentType: 'initial',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    patientId: 2,
    assignedWorkerId: 2,
    status: 'waiting',
    scheduledAt: new Date('2025-02-01T11:00:00'),
    durationMinutes: 30,
    chiefComplaint: '腹痛',
    appointmentType: 'follow_up',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    patientId: 1,
    assignedWorkerId: null,
    status: 'cancelled',
    scheduledAt: new Date('2025-02-01T14:00:00'),
    durationMinutes: 30,
    chiefComplaint: '発熱',
    appointmentType: 'initial',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock('../repositories', () => ({
  DrizzleRepositoryFactory: vi.fn().mockImplementation(() => {
    return new MockRepositoryFactory({
      patients: mockPatients,
      workers: mockWorkers,
      appointments: mockAppointments,
    });
  }),
}));

const env = {
  DB: {} as any,
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_TOKEN_EXPIRY: 3600,
  JWT_REFRESH_TOKEN_EXPIRY: 604800,
};

describe('オペレータ向け予約管理API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();

    // 認証ミドルウェアを手動で適用
    app.use('/api/worker/operator/appointments/*', async (c: any, next: any) => {
      c.set('user', {
        sub: 'operator1',
        userType: 'worker',
        id: 3,
        role: 'operator',
      });
      await next();
    });

    app.use('/api/worker/appointments/*', async (c: any, next: any) => {
      c.set('user', {
        sub: 'operator1',
        userType: 'worker',
        id: 3,
        role: 'operator',
      });
      await next();
    });

    // ハンドラーをマウント
    app.route('/api/worker/operator/appointments', operatorAppointmentHandlers);
    app.route('/api/worker/appointments', operatorAppointmentHandlers);
  });

  describe('GET /api/worker/operator/appointments', () => {
    it('予約一覧を取得できること', async () => {
      const res = await app.request('/api/worker/operator/appointments', {}, env);
      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.appointments).toHaveLength(3);
      expect(json.appointments[0]).toHaveProperty('id');
      expect(json.appointments[0]).toHaveProperty('patient');
      expect(json.appointments[0]).toHaveProperty('doctor');
      expect(json.appointments[0]).toHaveProperty('status');
    });

    it('ステータスフィルタで予約一覧を取得できること', async () => {
      const res = await app.request('/api/worker/operator/appointments?status=scheduled', {}, env);
      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.appointments).toHaveLength(1);
      expect(json.appointments[0].status).toBe('scheduled');
    });

    it('日付フィルタで予約一覧を取得できること', async () => {
      const res = await app.request('/api/worker/operator/appointments?date=2025-02-01', {}, env);
      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.appointments.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/worker/appointments/:id', () => {
    it('予約情報を更新できること', async () => {
      const updateData = {
        status: 'assigned',
        assignedWorkerId: 2,
        scheduledAt: '2025-02-01T15:00:00',
        chiefComplaint: '頭痛（更新）',
      };

      const res = await app.request('/api/worker/appointments/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }, env);

      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.success).toBe(true);
      expect(json.appointment.status).toBe('assigned');
      expect(json.appointment.chiefComplaint).toBe('頭痛（更新）');
    });

    it('存在しない予約IDの場合404エラーを返すこと', async () => {
      const updateData = { status: 'assigned' };

      const res = await app.request('/api/worker/appointments/999', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }, env);

      expect(res.status).toBe(404);
      const json: any = await res.json();
      expect(json.error).toBe('Appointment not found');
    });
  });

  describe('DELETE /api/worker/appointments/:id', () => {
    it('予約をキャンセル（削除）できること', async () => {
      const res = await app.request('/api/worker/appointments/1', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Appointment cancelled successfully');
    });

    it('存在しない予約IDの場合404エラーを返すこと', async () => {
      const res = await app.request('/api/worker/appointments/999', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(404);
      const json: any = await res.json();
      expect(json.error).toBe('Appointment not found');
    });

    it('既にキャンセル済みの予約を削除しようとした場合400エラーを返すこと', async () => {
      const res = await app.request('/api/worker/appointments/3', {
        method: 'DELETE',
      }, env);

      expect(res.status).toBe(400);
      const json: any = await res.json();
      expect(json.error).toBe('Appointment is already cancelled');
    });
  });
});
