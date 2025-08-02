import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { and, eq, or } from 'drizzle-orm';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRequestHandler } from 'react-router';
import { shouldIgnorePath } from './config/ignored-paths';
import { appointments, patients, questionnaires, workers } from './db/schema';
import { TongueDiagnosisService } from './services/tongue-diagnosis';


// ローカル開発環境で.env.localを読み込む
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env' });
}

// 認証関連のインポート
import type { MiddlewareHandler } from 'hono';
import type { JWTPayload } from './auth/jwt';
import { generateTokenPair, JWT_CONFIG, updateJWTConfig, verifyAccessToken } from './auth/jwt';
import { verifyPassword } from './auth/password';
import { SessionManager } from './auth/session';

// APIハンドラーのインポート
import adminDoctorHandlers from './api/handlers/admin-doctors';
import appointmentHandlers from './api/handlers/appointments';
import chatHandlers from './api/handlers/chat';
import doctorPatientHandlers from './api/handlers/doctor-patients';
import doctorScheduleHandlers from './api/handlers/doctor-schedule';
import operatorAppointmentHandlers from './api/handlers/operator-appointments';
import patientPrescriptionsHandlers from './api/handlers/patient-prescriptions';
import questionnaireHandlers from './api/handlers/questionnaire';
import { videoSessionsApp } from './api/video-sessions';

// Cloudflare Realtime関連のインポート

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
  GEMINI_API_KEY?: string;
}

// Hono型定義の拡張
type Variables = {
  user: JWTPayload;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// API Routes
import turnApi from './api/turn-credentials';
import { webSocketSignalingApp } from './api/websocket-signaling';
import { wsSimpleApp } from './api/websocket-simple';

// データベース接続を環境に応じて初期化
export function initializeDatabase(env?: Env) {
  if (!env?.DB && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('Using local SQLite database');
    const client = createClient({
      url: 'file:local.db',
    });
    return drizzleLibSQL(client);
  } else if (env?.DB) {
    return drizzleD1(env.DB);
  } else {
    console.warn('フォールバック: ローカルSQLiteデータベースを使用');
    const client = createClient({
      url: 'file:local.db',
    });
    return drizzleLibSQL(client);
  }
}

// JWT初期化状態を追跡
let jwtInitialized = false;

function initializeAuth(env?: Env) {
  const jwtSecret = JWT_CONFIG.secret;

  if (!jwtSecret) {
    console.warn('⚠️ JWT_SECRET環境変数が設定されていません。開発用フォールバックを使用します。');
    updateJWTConfig('fallback-secret-for-development', 8 * 60 * 60, 60 * 60 * 24 * 7);
    jwtInitialized = true;
    return SessionManager;
  }

  if (jwtInitialized && jwtSecret) {
    console.log('✅ JWT認証システムは既に初期化済みです');
    return SessionManager;
  }

  const isDevelopment = jwtSecret.includes('local_development');

  let accessExpiry: number | undefined;
  if (isDevelopment) {
    accessExpiry = 8 * 60 * 60;
  } else if (env?.JWT_ACCESS_TOKEN_EXPIRY) {
    const parsed = parseInt(env.JWT_ACCESS_TOKEN_EXPIRY);
    accessExpiry = isNaN(parsed) ? undefined : parsed;
  }

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

  return SessionManager;
}

// 認証ミドルウェア
export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    try {
      console.log('🔐 認証ミドルウェア開始');
      console.log('Request path:', c.req.path);
      console.log('Request method:', c.req.method);

      const authHeader = c.req.header('Authorization');
      console.log('Authorization header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'なし');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ Authorization header missing or invalid');
        return c.json({
          error: 'Unauthorized',
          details: 'Missing or invalid Authorization header'
        }, 401);
      }

      const token = authHeader.substring(7);

      if (!token || token.length < 10) {
        console.log('❌ Token is too short or empty');
        return c.json({
          error: 'Unauthorized',
          details: 'Invalid token format'
        }, 401);
      }

      const payload = await verifyAccessToken(token, JWT_CONFIG.secret);

      if (!payload || !payload.id || !payload.userType) {
        console.log('❌ JWT payload is invalid');
        return c.json({
          error: 'Unauthorized',
          details: 'Invalid token payload'
        }, 401);
      }

      console.log('✅ JWT検証成功:', { id: payload.id, userType: payload.userType });
      c.set('user', payload);
      await next();
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return c.json({
        error: 'Unauthorized',
        details: 'Token verification failed'
      }, 401);
    }
  };
};

// CORS設定
app.use(
  '*',
  cors({
    origin: ['http://localhost:8787'],
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
  console.log('🔐 患者ログイン処理開始');

  try {
    const { email, password } = await c.req.json();
    console.log('ログイン試行:', { email, password: '***' });

    const db = initializeDatabase(c.env);
    const sessionManager = initializeAuth(c.env);

    if (!db) {
      console.log('❌ データベース接続失敗');
      return c.json({
        error: 'Database not available',
        note: 'ローカル開発時は app-local-dev.ts を使用してください',
      }, 500);
    }

    const patient = await db.select().from(patients).where(eq(patients.email, email)).get();
    console.log('患者データ取得結果:', patient ? { id: patient.id, email: patient.email } : 'なし');

    if (!patient) {
      console.log('❌ 患者が見つかりません');
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const isValidPassword = await verifyPassword(password, patient.passwordHash);
    console.log('パスワード検証結果:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ パスワードが無効');
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const tokenPair = await generateTokenPair(
      patient.id.toString(),
      patient.id,
      patient.email,
      'patient',
      undefined,
      JWT_CONFIG.secret
    );

    console.log('✅ トークン生成成功:', {
      accessTokenLength: tokenPair.accessToken.length,
      refreshTokenLength: tokenPair.refreshToken.length
    });

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
    console.error('❌ 患者ログインエラー:', error);
    return c.json({
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
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

    const isValidPassword = await verifyPassword(password, worker.passwordHash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const tokenPair = await generateTokenPair(
      worker.id.toString(),
      worker.id,
      worker.email,
      'worker',
      worker.role,
      JWT_CONFIG.secret
    );

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

// 患者プロフィール
api.get('/patient/profile', authMiddleware(), async (c) => {
  console.log('🔍 患者プロフィール取得開始');

  const user = c.get('user');
  console.log('👤 認証済みユーザー:', { id: user.id, userType: user.userType, email: user.email });

  if (user.userType !== 'patient') {
    console.log('❌ 患者以外のアクセス拒否');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = initializeDatabase(c.env);
  if (!db) {
    console.log('❌ データベース接続失敗');
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const patientId = user.id;
    console.log('🔍 患者ID:', patientId);

    const patient = await db.select().from(patients).where(eq(patients.id, patientId)).get();
    console.log('👤 患者データ取得:', patient ? { id: patient.id, name: patient.name } : null);

    if (!patient) {
      console.log('❌ 患者が見つかりません');
      return c.json({ error: 'Patient not found' }, 404);
    }

    console.log('✅ 患者プロフィール取得成功');
    return c.json(patient);
  } catch (error) {
    console.error('❌ データベースエラー:', error);
    return c.json({ error: 'Database error' }, 500);
  }
});

// 予約作成 - 重複チェックを緩和
// 予約作成エンドポイントを修正（450行目付近）
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
      hasImage,
      tongueAnalysis, // ✅ 舌診結果を受け取る
      imageData // ✅ 画像データも受け取る（オプション）
    } = body;

    console.log('📋 予約作成リクエスト:', {
      doctorId,
      appointmentDate,
      appointmentType,
      chiefComplaint: chiefComplaint?.substring(0, 50) + '...',
      hasImage,
      hasTongueAnalysis: !!tongueAnalysis,
      tongueAnalysisConfidence: tongueAnalysis?.confidence_score
    });

    if (!doctorId || !appointmentDate || !startTime || !endTime) {
      return c.json({ error: '必須フィールドが不足しています' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    const scheduledAt = new Date(`${appointmentDate} ${startTime}`);
    const endAt = new Date(`${appointmentDate} ${endTime}`);

    // 重複チェック（警告レベル）
    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.assignedWorkerId, doctorId),
          eq(appointments.scheduledAt, scheduledAt),
          or(
            eq(appointments.status, 'scheduled'),
            eq(appointments.status, 'waiting'),
            eq(appointments.status, 'assigned'),
            eq(appointments.status, 'in_progress')
          )
        )
      )
      .all();

    if (existingAppointments.length > 0) {
      console.warn('⚠️ 同じ時間帯に予約がありますが、予約を続行します');
    }

    const durationMinutes = Math.floor((endAt.getTime() - scheduledAt.getTime()) / 1000 / 60);

    // ✅ 予約を作成
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

    const newAppointment = result[0];
    console.log('✅ 予約作成完了:', newAppointment.id);

    // ✅ 舌診結果がある場合は問診票に保存
    if (tongueAnalysis) {
      try {
        console.log('💾 舌診結果を問診票に保存中...');

        const questionnaire = await db
          .select()
          .from(questionnaires)
          .where(eq(questionnaires.appointmentId, newAppointment.id))
          .get();

        const currentAnswers = questionnaire ? JSON.parse((questionnaire.questionsAnswers as string) || '{}') : {};

        // 舌診結果を問診票に追加
        currentAnswers['tongue_analysis'] = {
          imageData: hasImage ? imageData : null, // 画像データ（オプション）
          analysisResult: tongueAnalysis,
          uploadedAt: new Date().toISOString(),
          aiProvider: 'gemini-1.5-flash',
          patientSymptoms: chiefComplaint
        };

        if (questionnaire) {
          console.log('🔄 既存問診票に舌診結果を追加');
          await db
            .update(questionnaires)
            .set({
              questionsAnswers: JSON.stringify(currentAnswers),
              updatedAt: new Date(),
            })
            .where(eq(questionnaires.id, questionnaire.id))
            .run();
        } else {
          console.log('➕ 新規問診票を舌診結果とともに作成');
          await db
            .insert(questionnaires)
            .values({
              appointmentId: newAppointment.id,
              questionsAnswers: JSON.stringify(currentAnswers),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }

        console.log('✅ 舌診結果の保存完了');
      } catch (questionnaireError) {
        console.error('❌ 舌診結果保存エラー:', questionnaireError);
        // エラーがあっても予約は成功として扱う
        console.warn('⚠️ 舌診結果保存に失敗しましたが、予約は完了しました');
      }
    }

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
        tongueAnalysisSaved: !!tongueAnalysis, // 舌診結果が保存されたかどうか
      },
      201
    );
  } catch (error) {
    console.error('Error creating appointment:', error);
    return c.json({
      error: '予約の作成に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// その他のAPIエンドポイント（簡略化のため主要なもののみ記載）
api.get('/patient/notifications', authMiddleware(), async (c) => {
  try {
    const mockNotifications = [
      {
        id: 1,
        type: 'appointment_reminder',
        title: '予約のリマインド',
        message: '本日14:00に診察予約があります',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        isRead: false,
        data: {
          appointmentId: 1,
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      },
    ];

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

api.get('/patient/appointments/available-slots', authMiddleware(), async (c) => {
  try {
    const date = c.req.query('date');
    const specialty = c.req.query('specialty');

    // モックデータ
    const availableSlots = [
      { time: '09:00', available: true },
      { time: '09:30', available: true },
      { time: '10:00', available: false },
      { time: '10:30', available: true },
      { time: '11:00', available: true },
      { time: '11:30', available: false },
      { time: '14:00', available: true },
      { time: '14:30', available: true },
      { time: '15:00', available: true },
      { time: '15:30', available: false },
      { time: '16:00', available: true },
      { time: '16:30', available: true },
    ];

    return c.json({ availableSlots, date, specialty });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return c.json({ error: 'Failed to fetch available slots' }, 500);
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
      id: 'tongue_photo_instruction',
      type: 'info',
      question: '舌診のお願い',
      description: '診察の精度向上のため、舌の写真撮影にご協力ください。明るい場所で、舌を十分に出して撮影してください。',
      required: false,
    },
    {
      id: 'tongue_analysis',
      type: 'tongue_photo',
      question: '舌の写真を撮影してください',
      description: 'カメラボタンを押して舌の写真を撮影し、AI分析を行います',
      required: false,
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

// 舌診画像アップロードエンドポイント - 最優先配置
// 670行目付近の舌診エンドポイントを以下に完全置き換え
app.post('/api/tongue-diagnosis', authMiddleware(), async (c) => {
  console.log('🔍 舌診エンドポイント呼び出し開始（完全シンプル版）');

  try {
    const user = c.get('user');
    console.log('✅ 認証済みユーザー:', { id: user.id, userType: user.userType });

    if (user.userType !== 'patient') {
      console.log('❌ 患者以外のアクセス拒否');
      return c.json({ error: 'Patients only' }, 403);
    }

    // ✅ リクエストボディの解析
    let body;
    try {
      const rawBody = await c.req.text();
      console.log('Raw body length:', rawBody.length);
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return c.json({
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Parse failed'
      }, 400);
    }

    // ✅ appointmentIdは使用しない
    const { imageData, symptoms } = body;
    console.log('Request data:', {
      hasImageData: !!imageData,
      imageDataLength: imageData?.length,
      symptoms: symptoms || 'なし'
    });

    // ✅ 画像データの検証
    if (!imageData) {
      console.log('❌ 画像データなし');
      return c.json({ error: '画像データが必要です' }, 400);
    }

    if (!imageData.startsWith('data:image/')) {
      console.log('❌ 無効な画像データ形式');
      return c.json({ error: '有効な画像データ形式ではありません' }, 400);
    }

    if (imageData.length > 10 * 1024 * 1024) {
      console.log('❌ 画像データが大きすぎます');
      return c.json({ error: '画像データが大きすぎます（10MB以下にしてください）' }, 400);
    }

    console.log('✅ 画像データ検証完了');

    // ✅ Gemini APIキーの取得
    const geminiApiKey = c.env?.GEMINI_API_KEY;
    console.log('🔑 APIキー確認:', geminiApiKey ? 'あり' : 'なし');

    if (!geminiApiKey) {
      console.warn('⚠️ GEMINI_API_KEY が設定されていません。モック分析を使用します。');

      // モック分析結果
      const mockAnalysis = {
        overall_assessment: '舌の色調は淡紅色で、薄白苔が見られます。全体的に正常範囲内と考えられます。',
        tongue_color: '淡紅色（正常範囲）',
        tongue_coating: '薄白苔、均等分布',
        tongue_shape: '正常な大きさ、辺縁滑らか',
        moisture_level: '適度な潤い',
        constitutional_type: '気血調和型',
        recommended_treatment: '現在の健康状態維持、ストレス管理',
        dietary_recommendations: 'バランスの取れた食事、冷たい飲食物の摂取を控える',
        lifestyle_advice: '規則正しい生活、適度な運動、十分な睡眠',
        urgency_level: 'low' as const,
        confidence_score: 0.75,
        analyzed_at: new Date().toISOString()
      };

      console.log('✅ モック舌診分析完了');
      return c.json({
        success: true,
        analysis: mockAnalysis,
        message: '舌診分析が完了しました（モックデータ使用）',
        timestamp: new Date().toISOString(),
        aiProvider: 'mock'
      });
    }

    // ✅ 実際のGemini APIを使用
    console.log('🤖 Gemini API を使用して舌診分析を開始...');

    try {
      const tongueService = new TongueDiagnosisService(geminiApiKey);
      const analysisResult = await tongueService.analyzeTongue(imageData, symptoms);

      console.log('✅ Gemini API 舌診分析完了:', {
        confidence: analysisResult.confidence_score,
        urgency: analysisResult.urgency_level,
        constitution: analysisResult.constitutional_type
      });

      return c.json({
        success: true,
        analysis: analysisResult,
        message: '舌診分析が完了しました',
        timestamp: new Date().toISOString(),
        aiProvider: 'gemini-1.5-flash'
      });

    } catch (aiError) {
      console.error('❌ Gemini API エラー:', aiError);

      // フォールバック分析
      const fallbackAnalysis = {
        overall_assessment: '画像の解析中にエラーが発生しました。手動での詳細確認を推奨します。',
        tongue_color: '画像品質により評価困難',
        tongue_coating: '詳細評価要直接観察',
        tongue_shape: '形状評価要追加検査',
        moisture_level: '潤燥状態評価要直接観察',
        constitutional_type: '体質判定要総合診察',
        recommended_treatment: '個別治療計画策定推奨',
        dietary_recommendations: '体質に応じた食事指導実施推奨',
        lifestyle_advice: '生活環境を考慮した改善指導実施推奨',
        urgency_level: 'medium' as const,
        confidence_score: 0.3,
        analyzed_at: new Date().toISOString()
      };

      console.log('⚠️ フォールバック舌診分析を返却');
      return c.json({
        success: true,
        analysis: fallbackAnalysis,
        message: 'AI分析に失敗しましたが、フォールバック分析を提供します',
        timestamp: new Date().toISOString(),
        warning: 'AI分析エラーのため信頼性が低下しています',
        aiProvider: 'fallback'
      });
    }

  } catch (error) {
    console.error('❌ 舌診処理エラー:', error);
    return c.json({
      error: '舌診分析に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 舌診結果取得エンドポイントも直接マウント
app.get('/api/patient/tongue-analysis/:appointmentId', authMiddleware(), async (c) => {
  console.log('🔍 舌診結果取得エンドポイント呼び出し（直接マウント）');

  try {
    const user = c.get('user');
    const appointmentId = parseInt(c.req.param('appointmentId'));

    if (user.userType !== 'patient' && user.userType !== 'worker') {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    let whereCondition;
    if (user.userType === 'patient') {
      whereCondition = and(
        eq(appointments.id, appointmentId),
        eq(appointments.patientId, user.id)
      );
    } else {
      whereCondition = eq(appointments.id, appointmentId);
    }

    const appointment = await db
      .select()
      .from(appointments)
      .where(whereCondition)
      .get();

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    const questionnaire = await db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.appointmentId, appointmentId))
      .get();

    if (!questionnaire) {
      return c.json({
        tongueAnalysis: null,
        message: '舌診結果が見つかりません'
      });
    }

    const answers = JSON.parse((questionnaire.questionsAnswers as string) || '{}');
    const tongueAnalysis = answers.tongue_analysis;

    if (!tongueAnalysis) {
      return c.json({
        tongueAnalysis: null,
        message: '舌診結果が見つかりません'
      });
    }

    return c.json({
      tongueAnalysis: {
        imageUrl: tongueAnalysis.imageUrl,
        analysisResult: tongueAnalysis.analysisResult,
        uploadedAt: tongueAnalysis.uploadedAt
      }
    });

  } catch (error) {
    console.error('Error fetching tongue analysis:', error);
    return c.json({ error: 'Failed to fetch tongue analysis' }, 500);
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
app.route('/api/video-sessions', videoSessionsApp);
app.route('/api/websocket-signaling', webSocketSignalingApp);
app.route('/api/ws', wsSimpleApp);
app.route('/api/turn', turnApi);

// React Router統合（フロントエンド）- APIパス以外のすべて
app.all('*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.notFound();
  }

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

// グローバルエラーハンドラー
app.onError((err, c) => {
  console.error('Global error handler:', err);

  if (err instanceof Error) {
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause
    });
  }

  return c.json({
    error: 'サーバーエラーが発生しました',
    message: err instanceof Error ? err.message : 'Unknown error',
    timestamp: new Date().toISOString()
  }, 500);
});

// 404ハンドラー
app.notFound((c) => {
  console.log('404 Not Found:', c.req.path);
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    timestamp: new Date().toISOString()
  }, 404);
});

export default app;
