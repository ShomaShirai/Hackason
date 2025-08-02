import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, getUser } from '../auth/middleware';
import type { Env } from '../types/env';
import { drizzle } from 'drizzle-orm/d1';
import { DrizzleRepositoryFactory } from '../repositories/drizzle/factory';
import { VideoSessionService } from '../services/video-session.service';
import { CloudflareCallsClient } from '../realtime/calls-client';

const videoSessionsApp = new Hono<{ Bindings: Env }>();

// ビデオセッション作成スキーマ（緊急用：UUIDバリデーション緩和）
const createVideoSessionSchema = z.object({
  appointmentId: z.string() // .uuid() を一時的に除去
});

// 新しいCloudflare Calls API統合エンドポイント（repositoryパターン使用）
videoSessionsApp.post('/realtime/create', authMiddleware(), async (c) => {
  const body = await c.req.json();
  const { appointmentId } = body;

  // 入力検証
  const validation = createVideoSessionSchema.safeParse({ appointmentId });
  if (!validation.success) {
    return c.json({ error: 'Invalid appointment ID' }, 400);
  }

  const user = getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Repository Factory 初期化
    const db = drizzle(c.env.DB);
    const repositoryFactory = new DrizzleRepositoryFactory(db);

    // Cloudflare Calls クライアント初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID!,
      c.env.CF_CALLS_APP_SECRET!
    );

    // Video Session Service 初期化
    const videoSessionService = new VideoSessionService(repositoryFactory, callsClient);

    // セッション作成（重複参加問題を内部で解決）
    const result = await videoSessionService.createSession(appointmentId, {
      id: user.id.toString(),
      userType: user.userType,
      email: user.email
    });

    return c.json({
      success: result.success,
      session: {
        id: result.session.id,
        realtimeSessionId: result.session.realtimeSessionId,
        status: result.session.status,
        appointmentId: result.session.appointmentId
      },
      callsSession: result.callsSession,
      isNewSession: result.isNewSession,
      joinedExistingSession: result.joinedExistingSession,
      message: result.isNewSession ? 'Video session created successfully' : 'Joined existing session'
    });

  } catch (error) {
    console.error('Failed to create realtime session:', error);

    // エラータイプに応じた適切なHTTPステータス
    if (error instanceof Error) {
      if (error.message === 'Appointment not found') {
        return c.json({ error: 'Appointment not found' }, 404);
      }
      if (error.message === 'Unauthorized') {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (error.message === 'Invalid appointment ID') {
        return c.json({ error: 'Invalid appointment ID' }, 400);
      }
    }

    return c.json({
      error: error instanceof Error ? error.message : 'Failed to create session'
    }, 500);
  }
});

// セッション参加エンドポイント（repositoryパターン使用）
videoSessionsApp.post('/realtime/join', authMiddleware(), async (c) => {
  const body = await c.req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return c.json({ error: 'Session ID is required' }, 400);
  }

  const user = getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Repository Factory 初期化
    const db = drizzle(c.env.DB);
    const repositoryFactory = new DrizzleRepositoryFactory(db);

    // Cloudflare Calls クライアント初期化
    const callsClient = new CloudflareCallsClient(
      c.env.CF_CALLS_APP_ID!,
      c.env.CF_CALLS_APP_SECRET!
    );

    // Video Session Service 初期化
    const videoSessionService = new VideoSessionService(repositoryFactory, callsClient);

    // セッション参加
    const result = await videoSessionService.joinSession(sessionId, {
      id: user.id.toString(),
      userType: user.userType,
      email: user.email
    });

    return c.json({
      success: result.success,
      session: {
        id: result.session.id,
        realtimeSessionId: result.session.realtimeSessionId,
        status: result.session.status,
        appointmentId: result.session.appointmentId
      },
      callsSession: result.callsSession,
      message: 'Successfully joined session'
    });

  } catch (error) {
    console.error('Failed to join session:', error);

    // エラータイプに応じた適切なHTTPステータス
    if (error instanceof Error) {
      if (error.message === 'Session not found') {
        return c.json({ error: 'Session not found' }, 404);
      }
      if (error.message === 'Session is not active') {
        return c.json({ error: 'Session is not active' }, 409);
      }
      if (error.message === 'Unauthorized') {
        return c.json({ error: 'Unauthorized' }, 403);
      }
    }

    return c.json({
      error: error instanceof Error ? error.message : 'Failed to join session'
    }, 500);
  }
});

// 既存のlegacyエンドポイント（互換性維持）
videoSessionsApp.post('/create', authMiddleware(), async (c) => {
  // 新しいエンドポイントにリダイレクト
  return c.redirect('/api/video-sessions/realtime/create', 307);
});

// セッション終了エンドポイント
videoSessionsApp.post('/end', authMiddleware(), async (c) => {
  const body = await c.req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return c.json({ error: 'Session ID is required' }, 400);
  }

  const user = getUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Repository Factory 初期化
    const db = drizzle(c.env.DB);
    const repositoryFactory = new DrizzleRepositoryFactory(db);
    const videoSessionRepo = repositoryFactory.createVideoSessionRepository();

    // セッション終了
    const updatedSession = await videoSessionRepo.updateSessionStatus(sessionId, 'ended');

    if (!updatedSession) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Session ended successfully',
      session: {
        id: updatedSession.id,
        status: updatedSession.status
      }
    });

  } catch (error) {
    console.error('Failed to end session:', error);
    return c.json({ error: 'Failed to end session' }, 500);
  }
});

export { videoSessionsApp };
