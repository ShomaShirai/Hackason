import { beforeEach } from 'vitest'

// モック環境変数
export const mockEnv = {
  DB: null as any, // テストでは実際のDBは使わない
  JWT_SECRET: 'test-secret-key',
  JWT_ACCESS_TOKEN_EXPIRY: '3600',
  JWT_REFRESH_TOKEN_EXPIRY: '604800',
  CF_CALLS_APP_ID: 'test-app-id',
  CF_CALLS_APP_SECRET: 'test-app-secret',
  SIGNALING_ROOM: {} as any,
}

// モックデータベース（簡易的な実装）
export const mockDb = {
  patients: [
    {
      id: 1,
      email: 'patient@test.com',
      name: '山田太郎',
      passwordHash: '$2b$10$cXuk.g3RS.0rVcPampiUX.CgjoCYUXOONeZduVb2ZPQwwLjzbEO/e', // test1234
      phoneNumber: '090-1234-5678',
    },
  ],
  workers: [
    {
      id: 1,
      email: 'doctor@test.com',
      name: '田中医師',
      role: 'doctor',
      passwordHash: '$2b$10$cXuk.g3RS.0rVcPampiUX.CgjoCYUXOONeZduVb2ZPQwwLjzbEO/e', // test1234
      phoneNumber: '090-2345-6789',
    },
  ],
  appointments: [
    {
      id: 1,
      patientId: 1,
      workerId: 1,
      scheduledAt: new Date(),
      status: 'scheduled',
      chiefComplaint: 'テスト診察',
    },
  ],
  videoSessions: [] as any[],
  sessionParticipants: [] as any[],
  
  // Drizzle ORMのようなインターフェースを模倣
  select() {
    return {
      from: (table: any) => ({
        where: (_condition: any) => ({
          get: async () => {
            // 簡易的な実装：メールアドレスで検索
            if (table === 'patients') {
              return mockDb.patients.find(p => p.email === mockEnv.testEmail)
            }
            if (table === 'workers') {
              return mockDb.workers.find(w => w.email === mockEnv.testEmail)
            }
            if (table === 'appointments') {
              return mockDb.appointments[0]
            }
            if (table === 'videoSessions') {
              return mockDb.videoSessions.find(s => s.appointmentId === mockEnv.testAppointmentId)
            }
            return null
          },
        }),
      }),
    }
  },
  
  insert() {
    return {
      values: (data: any) => ({
        returning: async () => {
          if (data.realtimeSessionId) {
            // ビデオセッション作成
            const session = { ...data, id: 'test-session-' + Date.now() }
            mockDb.videoSessions.push(session)
            return [session]
          }
          if (data.videoSessionId) {
            // 参加者追加
            const participant = { ...data, id: 'participant-' + Date.now() }
            mockDb.sessionParticipants.push(participant)
            return [participant]
          }
          return [data]
        },
      }),
    }
  },
  
  update() {
    return {
      set: (_data: any) => ({
        where: (_condition: any) => ({
          run: async () => {
            // 簡易実装
            return { success: true }
          },
        }),
      }),
    }
  },
}

// テスト前の初期化
beforeEach(() => {
  // モックデータをリセット
  mockDb.videoSessions = []
  mockDb.sessionParticipants = []
  
  // 環境変数をリセット
  mockEnv.testEmail = undefined
  mockEnv.testAppointmentId = undefined
})

// グローバル変数を設定（必要に応じて）
;(global as any).mockEnv = mockEnv
;(global as any).mockDb = mockDb