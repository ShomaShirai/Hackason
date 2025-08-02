import { Hono } from 'hono';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const turnApi = new Hono<{ Bindings: Env }>();

/**
 * Cloudflare Orange (TURN) サービスの認証情報を生成
 * https://github.com/cloudflare/orange
 */
turnApi.get('/turn-credentials', async (c: Context<{ Bindings: Env }>) => {
  const turnServiceId = c.env.TURN_SERVICE_ID;
  const turnServiceToken = c.env.TURN_SERVICE_TOKEN;
  
  // デバッグ情報（値の一部をマスク）
  console.log('TURN service config:', {
    hasServiceId: !!turnServiceId,
    serviceIdLength: turnServiceId?.length || 0,
    serviceIdPrefix: turnServiceId?.substring(0, 8) + '...',
    hasToken: !!turnServiceToken,
    tokenLength: turnServiceToken?.length || 0,
    tokenPrefix: turnServiceToken?.substring(0, 8) + '...'
  });
  
  if (!turnServiceId || !turnServiceToken) {
    return c.json({ 
      error: 'TURN service not configured',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    }, 503);
  }

  try {
    // Cloudflare Orange API を使用してTURN認証情報を生成
    const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${turnServiceId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${turnServiceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ttl: 86400 // 24時間有効
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TURN API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`TURN API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      iceServers: {
        username: string;
        credential: string;
        urls: string[];
      }[]
    };

    // STUNサーバーも含めて返す
    return c.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        ...data.iceServers
      ]
    });
  } catch (error) {
    console.error('Failed to get TURN credentials:', error);
    // エラー時はSTUNサーバーのみ返す
    return c.json({
      error: 'Failed to get TURN credentials',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    }, 500);
  }
});

export default turnApi;