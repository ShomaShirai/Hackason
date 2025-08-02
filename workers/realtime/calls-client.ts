/**
 * Cloudflare Calls APIクライアント
 * ビデオ通話セッションとトラックの管理を行う
 */

export interface CallsSession {
  sessionId: string;
  token: string;
  expiresAt: string;
}

export interface CallsTrack {
  trackId: string;
  trackName: string;
  location: 'local' | 'remote';
  mid?: string;
}

export interface CreateSessionRequest {
  sessionId: string;
  sessionDescription?: string;
}

export interface CreateTrackRequest {
  trackName: string;
  location: 'local' | 'remote';
  sessionDescription?: string;
}

export interface CloseTrackRequest {
  force?: boolean;
}

export class CloudflareCallsClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl = 'https://rtc.live.cloudflare.com';

  constructor(appId: string, appSecret: string) {
    if (!appId || !appSecret) {
      throw new Error('Cloudflare Calls configuration missing. CF_CALLS_APP_ID and CF_CALLS_APP_SECRET must be set');
    }
    
    this.appId = appId;
    this.appSecret = appSecret;
  }

  /**
   * 新しいセッションを作成
   */
  async createSession(request: CreateSessionRequest): Promise<CallsSession> {
    // 一時的にモックを返す（Cloudflare Calls APIの設定が完了するまで）
    console.warn('CloudflareCallsClient.createSession - returning mock token', request);
    
    // モックトークンを返す
    return {
      sessionId: request.sessionId,
      token: btoa(JSON.stringify({
        sessionId: request.sessionId,
        exp: Date.now() + 3600000, // 1時間後
        iss: 'cloudflare-calls-mock'
      })),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    
    /* 実際のAPI呼び出し（一時的にコメントアウト）
    const url = `${this.baseUrl}/apps/${this.appId}/sessions/new`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${response.status} ${error}`);
    }

    return response.json();
    */
  }

  /**
   * セッションにトラックを追加
   */
  async createTrack(
    sessionId: string,
    request: CreateTrackRequest
  ): Promise<CallsTrack> {
    const url = `${this.baseUrl}/apps/${this.appId}/sessions/${sessionId}/tracks/new`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create track: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * トラックを閉じる
   */
  async closeTrack(
    sessionId: string,
    trackName: string,
    request?: CloseTrackRequest
  ): Promise<void> {
    const url = `${this.baseUrl}/apps/${this.appId}/sessions/${sessionId}/tracks/${trackName}/close`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request || {})
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to close track: ${response.status} ${error}`);
    }
  }

  /**
   * セッションを再ネゴシエーション
   */
  async renegotiateSession(
    sessionId: string,
    sessionDescription: string
  ): Promise<void> {
    const url = `${this.baseUrl}/apps/${this.appId}/sessions/${sessionId}/renegotiate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionDescription })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to renegotiate session: ${response.status} ${error}`);
    }
  }

  /**
   * セッションのオファー/アンサーを交換
   */
  async exchangeSessionDescription(
    sessionId: string,
    sessionDescription: string,
    type: 'offer' | 'answer'
  ): Promise<{ sessionDescription: string }> {
    const endpoint = type === 'offer' ? 'offer' : 'answer';
    const url = `${this.baseUrl}/apps/${this.appId}/sessions/${sessionId}/${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.appSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionDescription })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange ${type}: ${response.status} ${error}`);
    }

    return response.json();
  }
}

/**
 * エラーハンドリング用のヘルパー関数
 */
export function isCallsError(error: unknown): error is Error {
  return error instanceof Error && error.message.includes('Failed to');
}

/**
 * リトライ機能付きクライアントラッパー
 */
export class CloudflareCallsClientWithRetry extends CloudflareCallsClient {
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    appId: string,
    appSecret: string,
    maxRetries = 3,
    retryDelay = 1000
  ) {
    super(appId, appSecret);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 認証エラーやクライアントエラー（4xx）はリトライしない
        if (lastError.message.includes('401') || lastError.message.includes('403') || lastError.message.includes('400')) {
          throw lastError;
        }

        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw new Error(`${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  override async createSession(request: CreateSessionRequest): Promise<CallsSession> {
    return this.withRetry(
      () => super.createSession(request),
      'Create session'
    );
  }

  override async createTrack(sessionId: string, request: CreateTrackRequest): Promise<CallsTrack> {
    return this.withRetry(
      () => super.createTrack(sessionId, request),
      'Create track'
    );
  }
}