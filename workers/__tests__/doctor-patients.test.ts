import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { MockRepositoryFactory } from '../repositories/mock/factory';
import doctorPatientHandlers from '../api/handlers/doctor-patients';

// Mock auth middleware for a doctor
vi.mock('../auth/middleware', () => ({
  authMiddleware: () => async (c: any, next: any) => {
    c.set('user', {
      sub: 'doctor1',
      userType: 'worker',
      id: 2, // Assuming doctor's ID is 2
      role: 'doctor',
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

const mockAppointments = [
    { id: 1, patientId: 1, workerId: 2, status: 'completed' },
    { id: 2, patientId: 2, workerId: 2, status: 'completed' },
    { id: 3, patientId: 1, workerId: 3, status: 'completed' }, // Different doctor
];


vi.mock('../repositories', () => ({
  DrizzleRepositoryFactory: vi.fn().mockImplementation(() => {
    return new MockRepositoryFactory({
        patients: mockPatients,
        appointments: mockAppointments,
        workers: [
            { id: 2, name: "山田太郎", role: 'doctor' }
        ]
    });
  }),
}));


const env = {
  DB: {} as any,
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_TOKEN_EXPIRY: 3600,
  JWT_REFRESH_TOKEN_EXPIRY: 604800,
};

describe('医師向け患者API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();

    // 認証ミドルウェアを手動で適用
    app.use('/api/worker/doctor/patients/*', async (c: any, next: any) => {
      c.set('user', {
        sub: 'doctor1',
        userType: 'worker',
        id: 2,
        role: 'doctor',
      });
      await next();
    });

    // ハンドラーをマウント
    app.route('/api/worker/doctor/patients', doctorPatientHandlers);
  });

  describe('GET /api/worker/doctor/patients', () => {
    it('担当患者の一覧を取得できること', async () => {
        const res = await app.request('/api/worker/doctor/patients', {}, env);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.patients).toHaveLength(2);
        expect(json.patients[0].name).toBe('患者A');
    });
  });

  describe('GET /api/worker/doctor/patients/:id', () => {
    it('担当患者の詳細情報を取得できること', async () => {
        const res = await app.request('/api/worker/doctor/patients/1', {}, env);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.patient.name).toBe('患者A');
    });

    it('担当でない患者の情報を取得しようとした場合、404エラーを返すこと', async () => {
        // 患者ID3は存在しないため、404が返される
        const res = await app.request('/api/worker/doctor/patients/3', {}, env);
        expect(res.status).toBe(404);
    });
  });
});
