/**
 * セッション管理
 * JWTトークンのブラックリスト管理とセッション無効化を行う
 *
 * Note: 本来はRedisなどの外部ストレージを使用すべきですが、
 * Cloudflare Workers環境では、Durable Objectsまたは
 * KVストレージを使用することを推奨します。
 *
 * 今回はハッカソン向けの簡易実装として、
 * メモリベースの管理を行います。
 */

interface SessionData {
  userId: string;
  email: string;
  role: 'patient' | 'doctor' | 'operator' | 'admin';
  loginTime: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

interface BlacklistedToken {
  tokenId: string;
  userId: string;
  blacklistedAt: number;
  expiresAt: number;
  reason: 'logout' | 'revoked' | 'security';
}

/**
 * インメモリセッションストア（本番環境では外部ストレージ推奨）
 */
class SessionStore {
  private sessions = new Map<string, SessionData>();
  private blacklistedTokens = new Map<string, BlacklistedToken>();
  // private readonly cleanupInterval = 60 * 60 * 1000; // 1時間ごとにクリーンアップ（Workersでは使用しない）

  constructor() {
    // Cloudflare Workersではグローバルスコープでsetintervalは使えないため削除
    // 本番では scheduled event で実装する必要があります
  }

  /**
   * セッションを作成
   */
  createSession(
    userId: string,
    email: string,
    role: SessionData['role'],
    ipAddress?: string,
    userAgent?: string
  ): string {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const sessionData: SessionData = {
      userId,
      email,
      role,
      loginTime: now,
      lastActivity: now,
      ipAddress,
      userAgent,
    };

    this.sessions.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * セッションを取得
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      // 最終アクティビティ時間を更新
      session.lastActivity = Date.now();
      this.sessions.set(sessionId, session);
    }
    return session || null;
  }

  /**
   * セッションを削除
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * ユーザーのすべてのセッションを削除
   */
  deleteUserSessions(userId: string): number {
    let deletedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * トークンをブラックリストに追加
   */
  blacklistToken(
    tokenId: string,
    userId: string,
    expiresAt: number,
    reason: BlacklistedToken['reason'] = 'logout'
  ): void {
    const blacklistedToken: BlacklistedToken = {
      tokenId,
      userId,
      blacklistedAt: Date.now(),
      expiresAt,
      reason,
    };

    this.blacklistedTokens.set(tokenId, blacklistedToken);
  }

  /**
   * トークンがブラックリストに登録されているかチェック
   */
  isTokenBlacklisted(tokenId: string): boolean {
    const blacklistedToken = this.blacklistedTokens.get(tokenId);
    if (!blacklistedToken) {
      return false;
    }

    // 有効期限が切れている場合は削除
    if (Date.now() > blacklistedToken.expiresAt) {
      this.blacklistedTokens.delete(tokenId);
      return false;
    }

    return true;
  }

  /**
   * ユーザーのすべてのトークンをブラックリストに追加
   */
  blacklistUserTokens(userId: string): void {
    // 実際の実装では、発行済みトークンを追跡する仕組みが必要
    // 今回は簡易実装のため、セッション削除のみ行う
    this.deleteUserSessions(userId);
  }

  /**
   * 期限切れのセッションとブラックリストをクリーンアップ
   */
  cleanup(): void {
    const now = Date.now();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24時間

    // 期限切れセッションの削除
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > sessionTimeout) {
        this.sessions.delete(sessionId);
      }
    }

    // 期限切れブラックリストトークンの削除
    for (const [tokenId, blacklistedToken] of this.blacklistedTokens.entries()) {
      if (now > blacklistedToken.expiresAt) {
        this.blacklistedTokens.delete(tokenId);
      }
    }
  }

  /**
   * アクティブセッション数を取得
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * ユーザーのアクティブセッション数を取得
   */
  getUserActiveSessionCount(userId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        count++;
      }
    }
    return count;
  }

  /**
   * ユーザーのセッション一覧を取得
   */
  getUserSessions(userId: string): SessionData[] {
    const userSessions: SessionData[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push({ ...session });
      }
    }
    return userSessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let sessionId = '';
    for (let i = 0; i < 32; i++) {
      sessionId += chars[Math.floor(Math.random() * chars.length)];
    }
    return sessionId + Date.now().toString(36);
  }
}

// シングルトンインスタンス（遅延初期化）
let sessionStore: SessionStore | null = null;

function getSessionStore(): SessionStore {
  if (!sessionStore) {
    sessionStore = new SessionStore();
  }
  return sessionStore;
}

/**
 * セッション管理のパブリックAPI
 */
export const SessionManager = {
  /**
   * 新しいセッションを作成
   */
  createSession(
    userId: string,
    email: string,
    role: SessionData['role'],
    ipAddress?: string,
    userAgent?: string
  ): string {
    return getSessionStore().createSession(userId, email, role, ipAddress, userAgent);
  },

  /**
   * セッションを取得
   */
  getSession(sessionId: string): SessionData | null {
    return getSessionStore().getSession(sessionId);
  },

  /**
   * セッションを削除（ログアウト）
   */
  deleteSession(sessionId: string): boolean {
    return getSessionStore().deleteSession(sessionId);
  },

  /**
   * ユーザーのすべてのセッションを削除
   */
  deleteUserSessions(userId: string): number {
    return getSessionStore().deleteUserSessions(userId);
  },

  /**
   * トークンをブラックリストに追加
   */
  blacklistToken(
    tokenId: string,
    userId: string,
    expiresAt: number,
    reason?: BlacklistedToken['reason']
  ): void {
    return getSessionStore().blacklistToken(tokenId, userId, expiresAt, reason);
  },

  /**
   * トークンがブラックリストに登録されているかチェック
   */
  isTokenBlacklisted(tokenId: string): boolean {
    return getSessionStore().isTokenBlacklisted(tokenId);
  },

  /**
   * ユーザーのすべてのトークンを無効化
   */
  revokeUserTokens(userId: string): void {
    return getSessionStore().blacklistUserTokens(userId);
  },

  /**
   * セキュリティ上の理由でユーザーのトークンを無効化
   */
  securityRevokeUserTokens(userId: string): void {
    return getSessionStore().blacklistUserTokens(userId);
  },

  /**
   * アクティブセッション統計を取得
   */
  getStats(): {
    totalActiveSessions: number;
    blacklistedTokens: number;
  } {
    return {
      totalActiveSessions: getSessionStore().getActiveSessionCount(),
      blacklistedTokens: getSessionStore()['blacklistedTokens'].size,
    };
  },

  /**
   * ユーザーのセッション情報を取得
   */
  getUserSessionInfo(userId: string): {
    activeSessionCount: number;
    sessions: SessionData[];
  } {
    return {
      activeSessionCount: getSessionStore().getUserActiveSessionCount(userId),
      sessions: getSessionStore().getUserSessions(userId),
    };
  },

  /**
   * 手動クリーンアップ実行
   */
  cleanup(): void {
    return getSessionStore().cleanup();
  },
};

export type { SessionData, BlacklistedToken };
