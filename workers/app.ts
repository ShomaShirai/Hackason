import { Hono } from 'hono';
import { createRequestHandler } from 'react-router';
import { cors } from 'hono/cors';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { shouldIgnorePath } from './config/ignored-paths';

// ローカル開発環境で.env.localを読み込む
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.local' });
}
import { patients, workers, appointments, videoSessions, medicalRecords, questionnaires } from './db/schema';
import { eq, and, gte, lt, desc, or, isNotNull, min, sql, type SQL } from 'drizzle-orm';

// 認証関連のインポート
import { verifyPassword } from './auth/password';
// import { hashPassword } from './auth/password';
import { generateTokenPair, JWT_CONFIG, updateJWTConfig } from './auth/jwt';
import type { JWTPayload } from './auth/jwt';
import { SessionManager } from './auth/session';
import { authMiddleware } from './auth/middleware';
// import { patientAuthMiddleware, workerAuthMiddleware } from './auth/middleware';

// APIハンドラーのインポート
import appointmentHandlers from './api/handlers/appointments';
import questionnaireHandlers from './api/handlers/questionnaire';
import adminDoctorHandlers from './api/handlers/admin-doctors';
import chatHandlers from './api/handlers/chat';
import doctorScheduleHandlers from './api/handlers/doctor-schedule';
import patientPrescriptionsHandlers from './api/handlers/patient-prescriptions';
import doctorPatientHandlers from './api/handlers/doctor-patients';
import operatorAppointmentHandlers from './api/handlers/operator-appointments';
import { videoSessionsApp } from './api/video-sessions';

// Cloudflare Realtime関連のインポート
import { CloudflareCallsClient } from './realtime/calls-client';
import { SessionManager as VideoSessionManager } from './realtime/session-manager';

// Durable Objectsのエクスポート
export { SignalingRoom } from './durable-objects/SignalingRoom';

// 環境変数の型定義
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRY: string;
  JWT_REFRESH_TOKEN_EXPIRY: string;
  CF_CALLS_APP_ID: string;
  CF_CALLS_APP_SECRET: string;
  TURN_SERVICE_ID?: string;
  TURN_SERVICE_TOKEN?: string;
  SIGNALING_ROOM: DurableObjectNamespace;
}

// Hono型定義の拡張
type Variables = {
  user: JWTPayload;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// API Routes
import { webSocketSignalingApp } from './api/websocket-signaling';
import { wsSimpleApp } from './api/websocket-simple';
import turnApi from './api/turn-credentials';

// データベース接続を環境に応じて初期化
export function initializeDatabase(env?: Env) {
  // ローカル開発環境の判定
  if (!env?.DB && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    // ローカル開発環境（libSQL/SQLite）
    console.log('Using local SQLite database');
    const client = createClient({
      url: 'file:local.db',
    });
    return drizzleLibSQL(client);
  } else if (env?.DB) {
    // 本番環境（Cloudflare Workers D1）
    return drizzleD1(env.DB);
  } else {
    // フォールバック: libSQLでローカルファイルデータベースを使用
    console.warn('フォールバック: ローカルSQLiteデータベースを使用');
    const client = createClient({
      url: 'file:local.db',
    });
    return drizzleLibSQL(client);
  }
}




// JWT初期化状態を追跡（Cloudflare Workers環境での永続化）
let jwtInitialized = false;

function initializeAuth(env?: Env) {
  // 環境変数からJWT_SECRETを取得
  // const jwtSecret = env?.JWT_SECRET;

  const jwtSecret = JWT_CONFIG.secret;

  if (!jwtSecret) {
    console.warn('⚠️ JWT_SECRET環境変数が設定されていません。開発用フォールバックを使用します。');
    // フォールバック設定でJWT設定を更新
    updateJWTConfig('fallback-secret-for-development', 8 * 60 * 60, 60 * 60 * 24 * 7);
    jwtInitialized = true;
    return SessionManager;
  }

  // 既に同じJWT_SECRETで初期化済みの場合はスキップ（開発環境での重複初期化を防ぐ）
  if (jwtInitialized && jwtSecret) {
    console.log('✅ JWT認証システムは既に初期化済みです');
    return SessionManager;
  }

  // JWT_SECRETに 'local_development' が含まれる場合は開発環境と判定
  const isDevelopment = jwtSecret.includes('local_development');

  // アクセストークン有効期限の決定
  let accessExpiry: number | undefined;
  if (isDevelopment) {
    // 開発環境: 8時間
    accessExpiry = 8 * 60 * 60;
  } else if (env?.JWT_ACCESS_TOKEN_EXPIRY) {
    // 本番環境: 環境変数から取得
    const parsed = parseInt(env.JWT_ACCESS_TOKEN_EXPIRY);
    accessExpiry = isNaN(parsed) ? undefined : parsed;
  }

  // リフレッシュトークン有効期限の決定
  let refreshExpiry: number | undefined;
  if (env?.JWT_REFRESH_TOKEN_EXPIRY) {
    const parsed = parseInt(env.JWT_REFRESH_TOKEN_EXPIRY);
    refreshExpiry = isNaN(parsed) ? undefined : parsed;
  }

  updateJWTConfig(jwtSecret, accessExpiry, refreshExpiry);
  jwtInitialized = true;

  if (isDevelopment) {
    console.log('✅ JWT認証システムを初期化しました（開発環境: アクセストークン有効期限 8時間）');
  } else {
    console.log('✅ JWT認証システムを初期化しました（本番環境）');
  }

  // セッションマネージャーは直接使用（オブジェクトなので初期化不要）
  return SessionManager;
}

// CORS設定
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// API Routes
const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// ヘルスチェック
api.get('/health', (c) => {
  const isProduction = c.env?.DB !== undefined;
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    database: isProduction ? 'cloudflare-d1' : 'local-development',
    note: isProduction
      ? '本番環境 - Cloudflare D1使用'
      : 'ローカル開発時は app-local-dev.ts を使用してください',
  });
});

// 認証エンドポイント
api.post('/auth/patient/login', async (c) => {
  const { email, password } = await c.req.json();
  const db = initializeDatabase(c.env);
  const sessionManager = initializeAuth(c.env);

  if (!db) {
    return c.json(
      {
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      },
      500
    );
  }

  try {
    console.log('患者ログイン試行:', { email, password: '***' });
    console.log('データベース接続状況:', !!db);

    const patient = await db.select().from(patients).where(eq(patients.email, email)).get();
    console.log('患者データ取得結果:', patient ? { id: patient.id, email: patient.email, hasPassword: !!patient.passwordHash } : null);

    if (!patient) {
      console.log('患者が見つかりません');
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // パスワード検証
    console.log('パスワード検証開始');
    console.log('入力パスワード:', '***');
    console.log('DBパスワードハッシュ:', patient.passwordHash.substring(0, 5) + '...');
    console.log('DBパスワードハッシュ型:', typeof patient.passwordHash);
    const isValidPassword = await verifyPassword(password, patient.passwordHash);
    console.log('パスワード検証結果:', isValidPassword);

    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // JWTトークン生成
    const tokenPair = await generateTokenPair(
      patient.id.toString(),
      patient.id,
      patient.email,
      'patient',
      undefined,
      JWT_CONFIG.secret
    );

    // セッション作成
    sessionManager.createSession(
      patient.id.toString(),
      patient.email,
      'patient'
    );

    return c.json({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        id: patient.id,
        email: patient.email,
        name: patient.name,
        userType: 'patient' as const,
      },
    });
  } catch (error) {
    console.error('患者ログインエラー:', error);
    console.error('エラースタック:', error instanceof Error ? error.stack : 'Unknown error');
    return c.json({ error: 'Database error', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

api.post('/auth/worker/login', async (c) => {
  const { email, password } = await c.req.json();
  const db = initializeDatabase(c.env);
  const sessionManager = initializeAuth(c.env);

  if (!db) {
    return c.json(
      {
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      },
      500
    );
  }

  try {
    const worker = await db.select().from(workers).where(eq(workers.email, email)).get();

    if (!worker) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // パスワード検証
    const isValidPassword = await verifyPassword(password, worker.passwordHash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // JWTトークン生成
    const tokenPair = await generateTokenPair(
      worker.id.toString(),
      worker.id,
      worker.email,
      'worker',
      worker.role,
      JWT_CONFIG.secret
    );

    // セッション作成
    sessionManager.createSession(
      worker.id.toString(),
      worker.email,
      worker.role
    );

    return c.json({
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        id: worker.id,
        email: worker.email,
        name: worker.name,
        userType: 'worker' as const,
        role: worker.role,
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// ログアウトエンドポイント
api.post('/auth/logout', authMiddleware(), async (c) => {
  const sessionManager = initializeAuth(c.env);

  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      // JWTからユーザーIDを取得（ミドルウェアによって検証済み）
      const user = c.get('user');
      if (user) {
        sessionManager.deleteSession(user.id.toString());
      }
    }

    return c.json({
      message: 'Successfully logged out',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

// 患者登録
api.post('/auth/patient/register', async (c) => {
  const { email, name, phoneNumber } = await c.req.json();
  const db = initializeDatabase(c.env);

  if (!db) {
    return c.json(
      {
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      },
      500
    );
  }

  try {
    const result = await db
      .insert(patients)
      .values({
        email,
        name,
        phoneNumber,
        passwordHash: 'hashed_test123',
      })
      .returning();

    return c.json({
      message: 'Patient registered successfully',
      patient: result[0],
    });
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// 患者プロフィール
api.get('/patient/profile', authMiddleware(), async (c) => {
  const user = c.get('user');

  // 患者のみアクセス可能
  if (user.userType !== 'patient') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = initializeDatabase(c.env);
  if (!db) {
    return c.json(
      {
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      },
      500
    );
  }

  try {
    const patientId = user.id; // JWTから取得
    const patient = await db.select().from(patients).where(eq(patients.id, patientId)).get();

    if (!patient) {
      return c.json({ error: 'Patient not found' }, 404);
    }

    return c.json(patient);
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// Worker向けAPIエンドポイント
api.get('/worker/profile', authMiddleware(), async (c) => {
  const user = c.get('user');

  // 医療従事者のみアクセス可能
  if (user.userType !== 'worker') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = initializeDatabase(c.env);
  if (!db) {
    return c.json(
      {
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      },
      500
    );
  }

  try {
    const workerId = user.id; // JWTから取得
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    if (!worker) {
      return c.json({ error: 'Worker not found' }, 404);
    }

    return c.json(worker);
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// 医師の予約一覧
api.get('/worker/doctor/appointments', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 日付パラメータを取得
    const date = c.req.query('date');
    let whereClause;

    if (date) {
      // 特定の日付の予約を取得
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause = and(
        eq(appointments.assignedWorkerId, user.id),
        gte(appointments.scheduledAt, startOfDay),
        lt(appointments.scheduledAt, endOfDay)
      );
    } else {
      // 全ての予約を取得
      whereClause = eq(appointments.assignedWorkerId, user.id);
    }

    // 予約と患者情報を結合
    const doctorAppointments = await db
      .select()
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(whereClause)
      .orderBy(desc(appointments.scheduledAt));

    return c.json({
      appointments: doctorAppointments.map(row => ({
        id: row.appointments.id,
        scheduledAt: row.appointments.scheduledAt,
        status: row.appointments.status,
        chiefComplaint: row.appointments.chiefComplaint || '',
        appointmentType: row.appointments.appointmentType || 'initial',
        durationMinutes: row.appointments.durationMinutes || 30,
        startedAt: row.appointments.startedAt,
        endedAt: row.appointments.endedAt,
        patient: {
          id: row.appointments.patientId,
          name: row.patients?.name || '未登録',
          email: row.patients?.email || '',
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

// 医師の統計情報（モック）
api.get('/worker/doctor/statistics', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // モック統計データ
    const statistics = {
      today: {
        totalAppointments: 8,
        completedAppointments: 3,
        upcomingAppointments: 5,
        averageConsultationTime: 25, // 分
        totalConsultationTime: 75, // 分
      },
      thisWeek: {
        totalAppointments: 32,
        completedAppointments: 24,
        cancelledAppointments: 2,
        averageConsultationTime: 22,
      },
      thisMonth: {
        totalAppointments: 128,
        completedAppointments: 115,
        cancelledAppointments: 8,
        averageConsultationTime: 23,
        totalRevenue: 384000, // 円
      },
      patientSatisfaction: {
        averageRating: 4.8,
        totalReviews: 89,
        distribution: {
          5: 72,
          4: 15,
          3: 2,
          2: 0,
          1: 0,
        },
      },
      commonChiefComplaints: [
        { complaint: '風邪の症状', count: 28 },
        { complaint: '頭痛', count: 22 },
        { complaint: '腹痛', count: 18 },
        { complaint: '発熱', count: 15 },
        { complaint: 'アレルギー症状', count: 12 },
      ],
      appointmentTypes: {
        initial: 45,
        follow_up: 68,
        emergency: 15,
      },
    };

    return c.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
});

// 旧エンドポイント（互換性のため残す）
api.get('/worker/appointments/today', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer jwt-token-worker')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // TODO: 実際の appointments テーブルから取得
  const mockTodayAppointments = [
    {
      id: 1,
      patientId: 1,
      patientName: '山田太郎',
      scheduledAt: new Date().toISOString(),
      status: 'scheduled',
      chiefComplaint: '風邪の症状',
      appointmentType: 'general',
    },
    {
      id: 2,
      patientId: 2,
      patientName: '佐藤花子',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'waiting',
      chiefComplaint: '頭痛',
      appointmentType: 'general',
    },
  ];

  return c.json(mockTodayAppointments);
});

api.get('/worker/appointments/waiting', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer jwt-token-worker')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // TODO: 実際の appointments テーブルから取得
  const mockWaitingAppointments = [
    {
      id: 2,
      patientId: 2,
      patientName: '佐藤花子',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'waiting',
      chiefComplaint: '頭痛',
      appointmentType: 'general',
      waitingSince: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      patientId: 3,
      patientName: '田中太郎',
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'waiting',
      chiefComplaint: '腹痛',
      appointmentType: 'urgent',
      waitingSince: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ];

  return c.json(mockWaitingAppointments);
});

// 予約詳細エンドポイント（医療従事者用）
api.get('/worker/appointments/:id/details', authMiddleware(), async (c) => {
  const appointmentId = c.req.param('id');
  const user = c.get('user');

  // 医療従事者のみアクセス可能
  if (user.userType !== 'worker') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = initializeDatabase(c.env);
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    // 予約情報を取得（単一レコード取得を型安全に）
    const appointmentResult = await db.select().from(appointments)
      .where(eq(appointments.id, parseInt(appointmentId)))
      .limit(1)
      .get();

    const appointment = appointmentResult;

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 患者情報を取得（型安全な単一レコード取得）
    const patientResult = await db.select().from(patients)
      .where(eq(patients.id, appointment.patientId))
      .limit(1)
      .get();

    const patient = patientResult;

    if (!patient) {
      return c.json({ error: 'Patient not found' }, 404);
    }

    // 医師情報を取得（もし割り当てられている場合）
    let doctor: typeof workers.$inferSelect | null = null;
    if (appointment.assignedWorkerId) {
      const doctorResult = await db.select().from(workers)
        .where(eq(workers.id, appointment.assignedWorkerId))
        .limit(1)
        .get();
      doctor = doctorResult || null;
    }

    return c.json({
      appointment: {
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        chiefComplaint: appointment.chiefComplaint,
        appointmentType: appointment.appointmentType,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt
      },
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phoneNumber: patient.phoneNumber,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender
      },
      doctor: doctor ? {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        licenseNumber: doctor.medicalLicenseNumber
      } : null
    });
  } catch (error) {
    console.error('Failed to fetch appointment details:', error);
    return c.json({ error: 'Failed to fetch appointment details' }, 500);
  }
});

// 今日の予約一覧（患者用） - ハンドラー経由で正常に動作しているため削除
// このAPIは /api/patient/appointments で利用可能

// 通知一覧（患者用） - モック実装
api.get('/patient/notifications', authMiddleware(), async (c) => {
  try {
    // const _user = c.get('user'); // 通知のモック実装のため未使用

    // モック通知データ
    const mockNotifications = [
      {
        id: 1,
        type: 'appointment_reminder',
        title: '予約のリマインド',
        message: '本日14:00に診察予約があります',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1時間前
        isRead: false,
        data: {
          appointmentId: 1,
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2時間後
        },
      },
      {
        id: 2,
        type: 'prescription_ready',
        title: '処方箋の準備完了',
        message: '処方箋の準備が完了しました',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1日前
        isRead: true,
        data: {
          prescriptionId: 1,
        },
      },
      {
        id: 3,
        type: 'questionnaire_request',
        title: '事前問診のお願い',
        message: '診察前に事前問診の入力をお願いします',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2時間前
        isRead: false,
        data: {
          appointmentId: 1,
          questionnaireUrl: '/patient/appointments/1/questionnaire',
        },
      },
    ];

    // 未読数のカウント
    const unreadCount = mockNotifications.filter(n => !n.isRead).length;

    return c.json({
      notifications: mockNotifications,
      unreadCount,
      totalCount: mockNotifications.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

// 予約一覧（患者用）
api.get('/patient/appointments', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // ページネーションパラメータ
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status'); // フィルタリング用
    const offset = (page - 1) * limit;

    // 基本的な条件
    let whereConditions: SQL | undefined = eq(appointments.patientId, user.id);

    // ステータスフィルタ
    if (status && ['scheduled', 'waiting', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      whereConditions = and(
        whereConditions,
        eq(appointments.status, status as any)
      );
    }

    // 予約を取得（新しい順） - Context7ベストプラクティス適用
    const appointmentsList = await db
      .select()
      .from(appointments)
      .leftJoin(workers, eq(appointments.assignedWorkerId, workers.id))
      .where(whereConditions)
      .orderBy(desc(appointments.scheduledAt))
      .limit(limit)
      .offset(offset)
      .all();

    // 総数を取得（型安全なcount実装）
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(whereConditions)
      .all();

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    return c.json({
      appointments: appointmentsList.map(row => ({
        id: row.appointments.id,
        scheduledAt: row.appointments.scheduledAt,
        status: row.appointments.status,
        chiefComplaint: row.appointments.chiefComplaint || '',
        appointmentType: row.appointments.appointmentType || 'initial',
        durationMinutes: row.appointments.durationMinutes || 30,
        startedAt: row.appointments.startedAt,
        endedAt: row.appointments.endedAt,
        doctor: row.appointments.assignedWorkerId ? {
          id: row.appointments.assignedWorkerId,
          name: row.workers?.name || '未定',
          role: row.workers?.role || 'doctor',
        } : null,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (_error) {
    console.error('Error fetching appointments:', _error);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

// 利用可能なスロット取得
api.get('/patient/appointments/available-slots', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403);
    }

    const date = c.req.query('date');
    const _specialty = c.req.query('specialty');

    if (!date) {
      return c.json({ error: '日付パラメータが必要です' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // TODO: 実際のスロット計算ロジックを実装
    // 現時点では簡易的な実装
    const _targetDate = new Date(date);
    const slots = [];

    // 医師のスケジュール情報を取得（簡易実装）
    const doctors = await db
      .select({
        id: workers.id,
        name: workers.name,
        role: workers.role, // TODO: 専門科を別テーブルで管理
      })
      .from(workers)
      .where(eq(workers.role, 'doctor'))
      .all();

    for (const doctor of doctors) {
      const doctorSlots = [];
      // 9:00-17:00の30分刻みでスロットを生成
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : 30;
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

          // 既存の予約をチェック（簡易実装）
          const isBooked = false; // TODO: 実際の予約チェック

          doctorSlots.push({
            startTime,
            endTime,
            available: !isBooked,
          });
        }
      }

      slots.push({
        date: date,
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialty: doctor.role, // role をspecialtyとして使用
        timeSlots: doctorSlots,
      });
    }

    return c.json({ slots });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return c.json({ error: 'Failed to fetch available slots' }, 500);
  }
});

// 予約作成
api.post('/patient/appointments', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403);
    }

    const body = await c.req.json();
    const {
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      appointmentType,
      chiefComplaint,
    } = body;

    // 必須フィールドチェック
    if (!doctorId || !appointmentDate || !startTime || !endTime) {
      return c.json({ error: '必須フィールドが不足しています' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 重複チェック
    const scheduledAt = new Date(`${appointmentDate} ${startTime}`);
    const endAt = new Date(`${appointmentDate} ${endTime}`);

    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.assignedWorkerId, doctorId),
          gte(appointments.scheduledAt, scheduledAt),
          lt(appointments.scheduledAt, endAt)
        )
      )
      .all();

    if (existingAppointments.length > 0) {
      return c.json({ error: 'その時間帯にはすでに予約があります' }, 409);
    }

    // 予約作成
    const durationMinutes = Math.floor((endAt.getTime() - scheduledAt.getTime()) / 1000 / 60);
    const result = await db
      .insert(appointments)
      .values({
        patientId: user.id,
        assignedWorkerId: doctorId,
        scheduledAt,
        durationMinutes,
        status: 'scheduled',
        appointmentType: appointmentType || 'initial',
        chiefComplaint: chiefComplaint || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .all();

    // 配列の最初の要素を取得
    const newAppointment = result[0];

    return c.json(
      {
        appointment: {
          id: newAppointment.id,
          patientId: newAppointment.patientId,
          doctorId: newAppointment.assignedWorkerId,
          scheduledAt: newAppointment.scheduledAt,
          durationMinutes: newAppointment.durationMinutes,
          status: newAppointment.status,
          appointmentType: newAppointment.appointmentType,
          chiefComplaint: newAppointment.chiefComplaint,
          createdAt: newAppointment.createdAt,
          updatedAt: newAppointment.updatedAt,
        },
      },
      201
    );
  } catch (error) {
    console.error('Error creating appointment:', error);
    return c.json({ error: 'Failed to create appointment' }, 500);
  }
});

// 問診票取得
api.get('/patient/questionnaire/:appointmentId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const appointmentId = parseInt(c.req.param('appointmentId'));
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 患者のみアクセス可能
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403);
    }

    // 予約情報を取得
    const appointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.patientId, user.id)
        )
      )
      .get();

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 問診票を取得
    const questionnaire = await db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.appointmentId, appointmentId))
      .get();

    if (questionnaire) {
      return c.json({
        questionnaire: {
          id: questionnaire.id,
          appointmentId: questionnaire.appointmentId,
          answers: JSON.parse((questionnaire.questionsAnswers as string) || '{}'),
          completedAt: questionnaire.completedAt,
          createdAt: questionnaire.createdAt,
          updatedAt: questionnaire.updatedAt,
        },
        template: getQuestionnaireTemplate(appointment.appointmentType || 'initial'),
      });
    }

    // 問診票が存在しない場合、新規作成用のテンプレートを返す
    return c.json({
      questionnaire: {
        appointmentId,
        answers: {},
        completedAt: null,
      },
      template: getQuestionnaireTemplate(appointment.appointmentType || 'initial'),
    });
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    return c.json({ error: 'Failed to fetch questionnaire' }, 500);
  }
});

// 問診票回答保存
api.post('/patient/questionnaire/answer', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { appointmentId, questionId, answer } = body;

    if (!appointmentId || !questionId || answer === undefined) {
      return c.json({ error: '必須フィールドが不足しています' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 予約の所有者確認
    const appointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.patientId, user.id)
        )
      )
      .get();

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 既存の問診票を取得または新規作成
    const questionnaire = await db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.appointmentId, appointmentId))
      .get();

    const currentAnswers = questionnaire ? JSON.parse((questionnaire.questionsAnswers as string) || '{}') : {};
    currentAnswers[questionId] = answer;

    if (questionnaire) {
      // 更新
      await db
        .update(questionnaires)
        .set({
          questionsAnswers: JSON.stringify(currentAnswers),
          updatedAt: new Date(),
        })
        .where(eq(questionnaires.id, questionnaire.id))
        .run();
    } else {
      // 新規作成
      await db
        .insert(questionnaires)
        .values({
          appointmentId,
          questionsAnswers: JSON.stringify(currentAnswers),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error saving questionnaire answer:', error);
    return c.json({ error: 'Failed to save answer' }, 500);
  }
});

// 問診票完了
api.post('/patient/questionnaire/complete', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { appointmentId } = body;

    if (!appointmentId) {
      return c.json({ error: 'appointmentIdが必要です' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 予約の所有者確認
    const appointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.patientId, user.id)
        )
      )
      .get();

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 問診票を完了に更新
    const result = await db
      .update(questionnaires)
      .set({
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(questionnaires.appointmentId, appointmentId))
      .returning()
      .get();

    if (!result) {
      return c.json({ error: 'Questionnaire not found' }, 404);
    }

    return c.json({
      success: true,
      questionnaire: {
        id: result.id,
        appointmentId: result.appointmentId,
        completedAt: result.completedAt,
      },
    });
  } catch (error) {
    console.error('Error completing questionnaire:', error);
    return c.json({ error: 'Failed to complete questionnaire' }, 500);
  }
});

// 問診票テンプレート取得関数
function getQuestionnaireTemplate(appointmentType: string) {
  const basicQuestions = [
    {
      id: 'symptoms',
      type: 'textarea',
      question: '現在の症状を詳しくお教えください',
      required: true,
    },
    {
      id: 'symptom_duration',
      type: 'select',
      question: '症状はいつからありますか？',
      options: ['今日', '昨日', '2-3日前', '1週間前', '1ヶ月以上前'],
      required: true,
    },
    {
      id: 'allergies',
      type: 'textarea',
      question: 'アレルギーはありますか？',
      required: false,
    },
    {
      id: 'medications',
      type: 'textarea',
      question: '現在服用中のお薬はありますか？',
      required: false,
    },
    {
      id: 'medical_history',
      type: 'textarea',
      question: '過去の病歴について教えてください',
      required: false,
    },
  ];

  if (appointmentType === 'followup') {
    basicQuestions.unshift({
      id: 'previous_treatment',
      type: 'textarea',
      question: '前回の診察後の経過はいかがでしたか？',
      required: true,
    });
  }

  return basicQuestions;
}

// カルテ取得（診察予約IDから）
api.get('/worker/medical-records/:appointmentId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const appointmentId = parseInt(c.req.param('appointmentId'));
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医療従事者のみアクセス可能
    if (user.userType !== 'worker') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // 診察記録を取得
    const record = await db
      .select()
      .from(medicalRecords)
      .innerJoin(appointments, eq(medicalRecords.appointmentId, appointments.id))
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(workers, eq(appointments.assignedWorkerId, workers.id))
      .where(eq(medicalRecords.appointmentId, appointmentId))
      .all();

    if (record.length === 0) {
      // 新規作成用のデータを返す
      const appointmentResult = await db
        .select()
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(workers, eq(appointments.assignedWorkerId, workers.id))
        .where(eq(appointments.id, appointmentId))
        .get();

      if (!appointmentResult) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      return c.json({
        isNew: true,
        appointment: {
          id: appointmentResult.appointments.id,
          patient: {
            id: appointmentResult.appointments.patientId,
            name: appointmentResult.patients.name,
          },
          scheduledAt: appointmentResult.appointments.scheduledAt,
          chiefComplaint: appointmentResult.appointments.chiefComplaint,
          doctor: appointmentResult.appointments.assignedWorkerId ? {
            id: appointmentResult.appointments.assignedWorkerId,
            name: appointmentResult.workers?.name || '未定',
          } : null,
        },
      });
    }

    const firstRecord = record[0];

    // 処方箋データを変換（medical_records.prescriptionsフィールドから取得）
    const prescriptionsFormatted = (() => {
      try {
        const prescriptionsData = firstRecord.medical_records.prescriptions;
        if (typeof prescriptionsData === 'string') {
          const parsed = JSON.parse(prescriptionsData);
          return Array.isArray(parsed) ? parsed : [];
        }
        return Array.isArray(prescriptionsData) ? prescriptionsData : [];
      } catch (error) {
        console.error('Error parsing prescription data:', error);
        return [];
      }
    })();

    return c.json({
      isNew: false,
      record: {
        id: firstRecord.medical_records.id,
        appointmentId: firstRecord.medical_records.appointmentId,
        subjective: firstRecord.medical_records.subjective || '',
        objective: firstRecord.medical_records.objective || '',
        assessment: firstRecord.medical_records.assessment || '',
        plan: firstRecord.medical_records.plan || '',
        vitalSigns: firstRecord.medical_records.vitalSigns ? JSON.parse(firstRecord.medical_records.vitalSigns as string) : {},
        prescriptions: prescriptionsFormatted, // 処方箋データを追加
        aiSummary: firstRecord.medical_records.aiSummary ? JSON.parse(firstRecord.medical_records.aiSummary as string) : null,
        createdAt: firstRecord.medical_records.createdAt,
        updatedAt: firstRecord.medical_records.updatedAt,
      },
      appointment: {
        id: firstRecord.appointments.id,
        patient: {
          id: firstRecord.appointments.patientId,
          name: firstRecord.patients.name,
        },
        scheduledAt: firstRecord.appointments.scheduledAt,
        chiefComplaint: firstRecord.appointments.chiefComplaint,
        doctor: firstRecord.appointments.assignedWorkerId ? {
          id: firstRecord.appointments.assignedWorkerId,
          name: firstRecord.workers?.name || '未定',
        } : null,
      },
    });
  } catch (error) {
    console.error('Error fetching medical record:', error);
    return c.json({ error: 'Failed to fetch medical record' }, 500);
  }
});

// カルテ作成
api.post('/worker/medical-records', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医師のみ作成可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const {
      appointmentId,
      subjective,
      objective,
      assessment,
      plan,
      vitalSigns,
      prescriptions,
      aiSummary,
      attachmentIds: _attachmentIds,
    } = body;

    // 既存のレコードがないか確認
    const existing = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.appointmentId, appointmentId))
      .get();

    if (existing) {
      return c.json({ error: 'Medical record already exists for this appointment' }, 400);
    }

    // 処方箋データのバリデーション
    if (prescriptions && Array.isArray(prescriptions)) {
      for (const prescription of prescriptions) {
        if (!prescription.name || !prescription.dosage || !prescription.frequency || !prescription.duration) {
          return c.json({ error: '処方箋データの必須フィールドが不足しています' }, 400);
        }
      }
    }

    // 新規作成
    const result = await db
      .insert(medicalRecords)
      .values({
        appointmentId,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        vitalSigns: vitalSigns ? JSON.stringify(vitalSigns) : '{}',
        prescriptions: prescriptions ? JSON.stringify(prescriptions) : '[]',
        aiSummary: aiSummary ? JSON.stringify(aiSummary) : '{}',
      })
      .returning();

    return c.json({
      success: true,
      record: result[0],
    }, 201);
  } catch (error) {
    console.error('Error creating medical record:', error);
    return c.json({ error: 'Failed to create medical record' }, 500);
  }
});

// カルテ更新
api.put('/worker/medical-records/:id', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const recordId = parseInt(c.req.param('id'));
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医師のみ更新可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const {
      subjective,
      objective,
      assessment,
      plan,
      vitalSigns,
      prescriptions,
      aiSummary,
    } = body;

    // 既存のレコードを確認
    const existing = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.id, recordId))
      .get();

    if (!existing) {
      return c.json({ error: 'Medical record not found' }, 404);
    }

    // 処方箋データのバリデーション
    if (prescriptions && Array.isArray(prescriptions)) {
      for (const prescription of prescriptions) {
        if (!prescription.name || !prescription.dosage || !prescription.frequency || !prescription.duration) {
          return c.json({ error: '処方箋データの必須フィールドが不足しています' }, 400);
        }
      }
    }

    // 更新
    const result = await db
      .update(medicalRecords)
      .set({
        subjective: subjective || existing.subjective,
        objective: objective || existing.objective,
        assessment: assessment || existing.assessment,
        plan: plan || existing.plan,
        vitalSigns: vitalSigns ? JSON.stringify(vitalSigns) : existing.vitalSigns,
        prescriptions: prescriptions ? JSON.stringify(prescriptions) : existing.prescriptions,
        aiSummary: aiSummary ? JSON.stringify(aiSummary) : existing.aiSummary,
        updatedAt: new Date(),
      })
      .where(eq(medicalRecords.id, recordId))
      .returning();

    return c.json({
      success: true,
      record: result[0],
    });
  } catch (error) {
    console.error('Error updating medical record:', error);
    return c.json({ error: 'Failed to update medical record' }, 500);
  }
});

// オペレータダッシュボードAPI
api.get('/worker/operator/dashboard', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // オペレータまたは管理者のみアクセス可能
    if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 現在の日付を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 統計情報を収集
    // 待機中の患者数
    const waitingPatientsResult = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'waiting'),
          gte(appointments.scheduledAt, today),
          lt(appointments.scheduledAt, tomorrow)
        )
      )
      .all();

    const waitingPatientsCount = waitingPatientsResult.length;

    // 診察中の数
    const inProgressResult = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'in_progress'),
          gte(appointments.scheduledAt, today),
          lt(appointments.scheduledAt, tomorrow)
        )
      )
      .all();

    const inProgressCount = inProgressResult.length;

    // 医師の稼働状況
    const allDoctors = await db
      .select()
      .from(workers)
      .where(eq(workers.role, 'doctor'))
      .all();

    // 現在診察中の医師を取得
    const busyDoctorIds = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'in_progress'),
          isNotNull(appointments.assignedWorkerId)
        )
      )
      .all();

    const busyDoctorSet = new Set(busyDoctorIds.map(d => d.assignedWorkerId).filter(id => id !== null));

    const doctorStatuses = allDoctors.map(doctor => ({
      ...doctor,
      status: busyDoctorSet.has(doctor.id) ? 'busy' : (doctor.isActive ? 'available' : 'offline'),
      currentPatientCount: busyDoctorSet.has(doctor.id) ? 1 : 0,
    }));

    // 待機中の患者リスト（詳細）
    const waitingPatientsList = await db
      .select()
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.status, 'waiting'),
          gte(appointments.scheduledAt, today),
          lt(appointments.scheduledAt, tomorrow)
        )
      )
      .orderBy(appointments.scheduledAt)
      .all();

    // 待機時間を計算
    const now = new Date();
    const waitingPatientsWithTime = waitingPatientsList.map((row) => ({
      id: row.appointments.id,
      patient: {
        id: row.patients.id,
        name: row.patients.name,
      },
      chiefComplaint: row.appointments.chiefComplaint,
      appointmentType: row.appointments.appointmentType,
      scheduledAt: row.appointments.scheduledAt,
      waitingTime: Math.floor((now.getTime() - new Date(row.appointments.scheduledAt).getTime()) / 1000 / 60), // 分単位
      priority: 'normal',
    }));

    // アラート（30分以上待機）
    const alerts = waitingPatientsWithTime
      .filter(p => p.waitingTime > 30)
      .map(p => ({
        type: 'long_wait',
        severity: p.waitingTime > 60 ? 'high' : 'medium',
        message: `${p.patient.name}様が${p.waitingTime}分待機中`,
        patientId: p.patient.id,
        appointmentId: p.id,
      }));

    // 時間帯別統計（簡易版）
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      appointments: 0,
      avgWaitTime: 0,
    }));

    return c.json({
      statistics: {
        waitingPatients: waitingPatientsCount,
        inProgressConsultations: inProgressCount,
        availableDoctors: doctorStatuses.filter(d => d.status === 'available').length,
        totalDoctors: allDoctors.length,
      },
      doctors: doctorStatuses,
      waitingPatients: waitingPatientsWithTime,
      alerts,
      hourlyStats,
    });

  } catch (error) {
    console.error('Error fetching operator dashboard:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// リアルタイムステータスAPI
api.get('/worker/operator/realtime-status', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // オペレータまたは管理者のみアクセス可能
    if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // 待機中の統計
    const waitingStats = await db
      .select()
      .from(appointments)
      .where(eq(appointments.status, 'waiting'))
      .all();

    const longestWaitTime = waitingStats.length > 0
      ? Math.floor((now.getTime() - new Date(waitingStats[0].scheduledAt).getTime()) / 1000 / 60)
      : 0;

    // アクティブな診察数
    const activeConsultations = await db
      .select()
      .from(appointments)
      .where(eq(appointments.status, 'in_progress'))
      .all();

    // 本日の完了数
    const completedToday = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'completed'),
          gte(appointments.endedAt, today)
        )
      )
      .all();

    // 最近のイベント（簡易版）
    const recentEvents = await db
      .select()
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        or(
          eq(appointments.status, 'waiting'),
          eq(appointments.status, 'in_progress'),
          and(
            eq(appointments.status, 'completed'),
            gte(appointments.endedAt, new Date(now.getTime() - 30 * 60 * 1000)) // 過去30分
          )
        )
      )
      .orderBy(desc(appointments.updatedAt))
      .limit(10)
      .all();

    const events = recentEvents.map((row) => ({
      id: row.appointments.id,
      type: row.appointments.status,
      patientName: row.patients.name,
      doctorId: row.appointments.assignedWorkerId,
      timestamp: row.appointments.updatedAt,
      message: `${row.patients.name}様 - ${
        row.appointments.status === 'waiting' ? '待機中' :
        row.appointments.status === 'in_progress' ? '診察中' : '診察完了'
      }`,
    }));

    // 緊急アラート
    const waitingCount = waitingStats.length;
    const criticalAlerts = waitingCount > 10
      ? [{
          type: 'high_load',
          message: `待機患者が${waitingCount}名を超えています`,
          severity: 'critical',
        }]
      : [];

    return c.json({
      timestamp: now.toISOString(),
      status: {
        waitingCount: waitingCount,
        averageWaitTime: Math.floor(longestWaitTime / 2), // 簡易計算
        longestWaitTime,
        activeConsultations: activeConsultations.length,
        completedToday: completedToday.length,
      },
      recentEvents: events,
      criticalAlerts,
    });

  } catch (error) {
    console.error('Error fetching realtime status:', error);
    return c.json({ error: 'Failed to fetch realtime status' }, 500);
  }
});

// 医師差配ボードAPI
api.get('/worker/operator/assignment-board', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // オペレータまたは管理者のみアクセス可能
    if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 日付パラメータ（デフォルトは今日）
    const dateParam = c.req.query('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // 医師リスト取得
    const doctorsList = await db
      .select()
      .from(workers)
      .where(eq(workers.role, 'doctor'))
      .all();

    // 待機中の患者取得
    const waitingPatientsList = await db
      .select({
        appointment: appointments,
        patient: patients,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.status, 'waiting'),
          gte(appointments.scheduledAt, targetDate),
          lt(appointments.scheduledAt, nextDate)
        )
      )
      .all();

    // 割り当て済みの予約取得
    const assignedAppointments = await db
      .select({
        appointment: appointments,
        patient: patients,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          or(
            eq(appointments.status, 'assigned'),
            eq(appointments.status, 'in_progress'),
            eq(appointments.status, 'completed')
          ),
          gte(appointments.scheduledAt, targetDate),
          lt(appointments.scheduledAt, nextDate),
          isNotNull(appointments.assignedWorkerId)
        )
      )
      .all();

    // タイムスロット生成（30分単位、9:00-18:00）
    const timeSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    // 医師ごとの割り当て整理
    const assignments = assignedAppointments.reduce((acc, { appointment, patient }) => {
      const doctorId = appointment.assignedWorkerId!;
      const timeSlot = new Date(appointment.scheduledAt).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (!acc[doctorId]) {
        acc[doctorId] = {};
      }

      acc[doctorId][timeSlot] = {
        appointmentId: appointment.id,
        patientName: patient.name,
        chiefComplaint: appointment.chiefComplaint,
        status: appointment.status,
        duration: appointment.durationMinutes,
      };

      return acc;
    }, {} as Record<number, Record<string, any>>);

    return c.json({
      date: targetDate.toISOString().split('T')[0],
      doctors: doctorsList.map(doctor => ({
        id: doctor.id,
        name: doctor.name,
        specialties: [], // specialtiesフィールドがないため空配列
        isActive: doctor.isActive,
      })),
      waitingPatients: waitingPatientsList.map(({ appointment, patient }) => ({
        appointmentId: appointment.id,
        patient: {
          id: patient.id,
          name: patient.name,
        },
        chiefComplaint: appointment.chiefComplaint,
        appointmentType: appointment.appointmentType,
        priority: appointment.priority || 'normal',
        requestedAt: appointment.scheduledAt,
      })),
      assignments,
      timeSlots,
    });

  } catch (error) {
    console.error('Error fetching assignment board:', error);
    return c.json({ error: 'Failed to fetch assignment board data' }, 500);
  }
});

// 医師割り当てAPI
api.post('/worker/operator/assign-doctor', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // オペレータまたは管理者のみアクセス可能
    if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const { appointmentId, doctorId, timeSlot, date } = await c.req.json();

    if (!appointmentId || !doctorId || !timeSlot) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 予約の存在確認
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .get();

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 医師の存在確認
    const doctor = await db
      .select()
      .from(workers)
      .where(
        and(
          eq(workers.id, doctorId),
          eq(workers.role, 'doctor')
        )
      )
      .get();

    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    // 予約時間の更新
    const appointmentDate = date ? new Date(date) : new Date(appointment.scheduledAt);
    const [hours, minutes] = timeSlot.split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);

    // 予約を更新
    const updated = await db
      .update(appointments)
      .set({
        assignedWorkerId: doctorId,
        status: 'assigned',
        scheduledAt: appointmentDate,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning()
      .get();

    return c.json({
      success: true,
      assignment: {
        appointmentId: updated.id,
        doctorId: updated.assignedWorkerId,
        scheduledAt: updated.scheduledAt,
        status: updated.status,
      },
    });

  } catch (error) {
    console.error('Error assigning doctor:', error);
    return c.json({ error: 'Failed to assign doctor' }, 500);
  }
});

// ビデオセッション作成エンドポイント
api.post('/video-sessions/create', authMiddleware(), async (c) => {
  try {
    const { appointmentId } = await c.req.json();
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // Cloudflare Calls設定の確認
    if (!c.env?.CF_CALLS_APP_ID || !c.env?.CF_CALLS_APP_SECRET) {
      return c.json({
        error: 'Cloudflare Calls configuration missing',
        details: 'CF_CALLS_APP_ID and CF_CALLS_APP_SECRET must be set'
      }, 500);
    }

    // Cloudflare CallsクライアントとVideoSessionManagerの初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID,
      c.env.CF_CALLS_APP_SECRET
    );

    // データベースの型を確認
    console.log('Database type check:', {
      dbType: typeof db,
      hasInsert: typeof db.insert === 'function',
      hasSelect: typeof db.select === 'function',
      hasUpdate: typeof db.update === 'function',
      dbKeys: Object.keys(db)
    });

    const videoSessionManager = new VideoSessionManager(db, callsClient);

    // セッション作成
    try {
      const result = await videoSessionManager.createSession(appointmentId, user);

      return c.json({
        sessionId: result.session.id,
        realtimeSessionId: result.session.realtimeSessionId,
        token: result.callsSession.token,
        expiresAt: result.callsSession.expiresAt,
        status: result.session.status,
        isNewSession: true
      });
    } catch (error) {
      // アクティブなセッションが既に存在する場合は、そのセッションに参加
      if (error instanceof Error && error.message.includes('Active session already exists')) {
        console.log('Active session found, joining existing session');

        // 既存のセッションを取得して参加
        const activeSessions = await db.select().from(videoSessions)
          .where(eq(videoSessions.appointmentId, parseInt(appointmentId)))
          .all();

        if (activeSessions.length > 0) {
          const activeSession = activeSessions[0];
          const joinResult = await videoSessionManager.joinSession(activeSession.id, user);

          return c.json({
            sessionId: joinResult.session.id,
            realtimeSessionId: joinResult.session.realtimeSessionId,
            token: joinResult.callsSession.token,
            expiresAt: joinResult.callsSession.expiresAt,
            status: joinResult.session.status,
            isNewSession: false
          });
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('Failed to create video session:', error);

    // エラーメッセージの適切な変換
    let statusCode = 500;
    let errorMessage = 'Failed to create video session';

    if (error instanceof Error) {
      if (error.message === 'Appointment not found') {
        errorMessage = 'Appointment not found. Please check the appointment ID.';
        statusCode = 404;
      } else if (error.message.includes('Permission denied')) {
        errorMessage = error.message;
        statusCode = 403;
      } else if (error.message.includes('Active session already exists')) {
        errorMessage = 'A session already exists for this appointment.';
        statusCode = 409;
      } else {
        errorMessage = error.message;
      }
    }

    return c.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined
    }, statusCode as any);
  }
});

// ビデオセッション参加エンドポイント
api.post('/video-sessions/:sessionId/join', authMiddleware(), async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // Cloudflare Calls設定の確認
    if (!c.env?.CF_CALLS_APP_ID || !c.env?.CF_CALLS_APP_SECRET) {
      return c.json({
        error: 'Cloudflare Calls configuration missing',
        details: 'CF_CALLS_APP_ID and CF_CALLS_APP_SECRET must be set'
      }, 500);
    }

    // Cloudflare CallsクライアントとVideoSessionManagerの初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID,
      c.env.CF_CALLS_APP_SECRET
    );
    const videoSessionManager = new VideoSessionManager(db as any, callsClient);

    // セッション参加
    const result = await videoSessionManager.joinSession(sessionId, user);

    return c.json({
      sessionId: result.session.id,
      realtimeSessionId: result.session.realtimeSessionId,
      token: result.callsSession.token,
      permissions: result.permissions,
      status: result.session.status
    });

  } catch (error) {
    console.error('Failed to join video session:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to join video session'
    }, 400);
  }
});

// ビデオセッション退出エンドポイント
api.post('/video-sessions/:sessionId/leave', authMiddleware(), async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // Cloudflare CallsクライアントとVideoSessionManagerの初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID || '',
      c.env.CF_CALLS_APP_SECRET || ''
    );
    const videoSessionManager = new VideoSessionManager(db as any, callsClient);

    // セッション退出
    await videoSessionManager.leaveSession(sessionId, user);

    return c.json({
      message: 'Successfully left the session'
    });

  } catch (error) {
    console.error('Failed to leave video session:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to leave video session'
    }, 400);
  }
});

// ビデオセッション終了エンドポイント（医療従事者のみ）
api.post('/video-sessions/:sessionId/end', authMiddleware(), async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const user = c.get('user');

    // 医療従事者のみ終了可能
    if (user.userType !== 'worker') {
      return c.json({ error: 'Permission denied' }, 403);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // Cloudflare CallsクライアントとVideoSessionManagerの初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID || '',
      c.env.CF_CALLS_APP_SECRET || ''
    );
    const videoSessionManager = new VideoSessionManager(db as any, callsClient);

    // セッション終了
    await videoSessionManager.endSession(sessionId, 'completed');

    return c.json({
      message: 'Session ended successfully'
    });

  } catch (error) {
    console.error('Failed to end video session:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to end video session'
    }, 400);
  }
});

// APIハンドラーをマウント
api.route('/patient/appointments', appointmentHandlers);
api.route('/patient/questionnaire', questionnaireHandlers);
api.route('/patient/prescriptions', patientPrescriptionsHandlers);

api.route('/worker/admin/doctors', adminDoctorHandlers);
api.route('/worker/doctor/schedule', doctorScheduleHandlers);
api.route('/worker/doctor/patients', doctorPatientHandlers);
api.route('/worker/operator/appointments', operatorAppointmentHandlers);
api.route('/worker/appointments', operatorAppointmentHandlers);
api.route('/chat', chatHandlers);

// APIルートをマウント（React Routerより前に定義して優先度を上げる）
app.route('/api', api);
// videoSessionsAppを追加で有効化（新しいrealtime/createエンドポイント用）
app.route('/api/video-sessions', videoSessionsApp);
app.route('/api/websocket-signaling', webSocketSignalingApp);
app.route('/api/ws', wsSimpleApp); // シンプルなWebSocket実装
app.route('/api', turnApi); // Cloudflare TURN認証情報


// React Router統合（フロントエンド）- APIパス以外のすべて
app.all('*', async (c) => {
  // APIパスはスキップ
  if (c.req.path.startsWith('/api/')) {
    return c.notFound();
  }

  // 無視すべきパスのチェック
  if (shouldIgnorePath(c.req.path)) {
    return c.notFound();
  }

  const requestHandler = createRequestHandler(
    () => import('virtual:react-router/server-build'),
    import.meta.env.MODE
  );

  return requestHandler(c.req.raw, {
    cloudflare: { env: c.env, ctx: c.executionCtx },
  });
});

export default app;
