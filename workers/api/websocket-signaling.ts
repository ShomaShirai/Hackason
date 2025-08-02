import { Hono } from 'hono';
import type { Env } from '../types/env';
import { authMiddleware, getUser } from '../auth/middleware';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { videoSessions } from '../db/schema';

// Durable Object binding用の拡張型
interface EnvWithDurableObjects extends Env {
  SIGNALING_ROOM: DurableObjectNamespace;
}

const wsApp = new Hono<{ Bindings: EnvWithDurableObjects }>();

// WebSocketシグナリング接続エンドポイント
wsApp.get('/:sessionId', async (c) => {  // パスを修正: /signaling/:sessionId → /:sessionId
  const sessionId = c.req.param('sessionId');

  // デモ用ユーザー情報（認証をバイパス）
  const userId = c.req.query('userId') || 'demo-user-' + Math.random().toString(36).substr(2, 9);
  const userType = (c.req.query('userType') as 'patient' | 'worker') || 'patient';
  const role = c.req.query('role') as 'doctor' | 'operator' | 'admin' | undefined;

  const user = {
    id: parseInt(userId.replace(/\D/g, '')) || 1,
    email: `${userId}@demo.com`,
    userType,
    role
  };

  try {
    // セッションの存在確認
    const d1 = c.env.DB;
    const db = drizzle(d1);
    const sessions = await db
      .select()
      .from(videoSessions)
      .where(eq(videoSessions.id, sessionId))
      .execute();

    const session = sessions[0];
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // セッションのステータスチェック
    if (session.status !== 'active' && session.status !== 'waiting') {
      return c.json({ error: 'Session is not active' }, 400);
    }

    // Durable Object IDを生成（セッションIDベース）
    const durableObjectId = c.env.SIGNALING_ROOM.idFromName(sessionId);
    const durableObject = c.env.SIGNALING_ROOM.get(durableObjectId);

    // WebSocket接続用のURLパラメータを追加
    const url = new URL(c.req.url);
    url.searchParams.set('userId', user.id.toString());
    url.searchParams.set('userType', user.userType);
    if (user.role) {
      url.searchParams.set('role', user.role);
    }

    // Durable ObjectへWebSocketリクエストを転送
    return durableObject.fetch(url.toString(), {
      headers: c.req.raw.headers
    });

  } catch (error) {
    console.error('WebSocket signaling error:', error);
    return c.json({
      error: 'Failed to establish WebSocket connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// シグナリングセッション情報取得エンドポイント
wsApp.get('/:sessionId/info', authMiddleware(), async (c) => {  // パスを修正: /signaling/:sessionId/info → /:sessionId/info
  const sessionId = c.req.param('sessionId');
  const user = getUser(c);

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // セッション情報を取得
    const d1 = c.env.DB;
    const db = drizzle(d1);
    const sessions = await db
      .select()
      .from(videoSessions)
      .where(eq(videoSessions.id, sessionId))
      .execute();

    const session = sessions[0];
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // WebSocket接続用の情報を返す
    return c.json({
      sessionId: session.id,
      status: session.status,
      realtimeSessionId: session.realtimeSessionId,
      signalingUrl: `/api/websocket-signaling/${sessionId}`,  // フロントエンド期待パスに合わせる
      protocol: 'wss',
      createdAt: session.createdAt,
      startedAt: session.startedAt
    });

  } catch (error) {
    console.error('Session info error:', error);
    return c.json({
      error: 'Failed to get session info'
    }, 500);
  }
});

export { wsApp as webSocketSignalingApp };
