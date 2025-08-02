import { Hono } from 'hono';
import type { Env } from '../types/env';

const wsSimpleApp = new Hono<{ Bindings: Env }>();

// WebSocket処理ハンドラー - Durable Objectsを使用
wsSimpleApp.get('/simple/:sessionId', async (c) => {
  // CORS対応
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  const sessionId = c.req.param('sessionId');
  const userId = c.req.query('userId') || `user-${Date.now()}`;

  // WebSocketアップグレードチェック
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }

  // Durable Objectのインスタンスを取得
  const id = c.env.SIGNALING_ROOM.idFromName(sessionId);
  const stub = c.env.SIGNALING_ROOM.get(id);

  // URLにユーザー情報を追加してDurable Objectに転送
  const url = new URL(c.req.url);
  url.searchParams.set('userId', userId);
  url.searchParams.set('userType', 'patient'); // デフォルトはpatient
  
  const newRequest = new Request(url.toString(), c.req.raw);
  
  // リクエストをDurable Objectに転送
  return stub.fetch(newRequest);
});

export { wsSimpleApp };