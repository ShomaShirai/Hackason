import type { RepositoryFactory } from '../repositories/interfaces';
import type { VideoSession, Appointment } from '../db/types';
import type { CloudflareCallsClient } from '../realtime/calls-client';

export interface User {
  id: string;
  userType: 'patient' | 'worker';
  email: string;
}

export interface VideoSessionResult {
  success: boolean;
  session: VideoSession;
  callsSession?: {
    token: string;
    sessionId: string;
  };
  isNewSession: boolean;
  joinedExistingSession?: boolean;
}

export interface JoinSessionResult {
  success: boolean;
  session: VideoSession;
  callsSession: {
    token: string;
    sessionId: string;
  };
}

export class VideoSessionService {
  private repositoryFactory: RepositoryFactory;
  private callsClient?: CloudflareCallsClient;

  constructor(repositoryFactory: RepositoryFactory, callsClient?: CloudflareCallsClient) {
    this.repositoryFactory = repositoryFactory;
    this.callsClient = callsClient;
  }

  async createSession(appointmentId: string, user: User): Promise<VideoSessionResult> {
    // 入力検証
    if (!appointmentId || appointmentId.trim() === '') {
      throw new Error('Invalid appointment ID');
    }

    const appointmentRepo = this.repositoryFactory.createAppointmentRepository();
    const videoSessionRepo = this.repositoryFactory.createVideoSessionRepository();

    // 1. 予約情報を取得・検証
    const appointment = await appointmentRepo.findById(parseInt(appointmentId));
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // 2. 権限チェック
    await this.checkPermission(appointment, user);

    // 3. 既存セッションを確認（UNIQUE制約対応）
    const existingSession = await videoSessionRepo.findByAppointmentId(parseInt(appointmentId));
    if (existingSession) {
      if (existingSession.status === 'active') {
        // アクティブセッションに参加
        console.log('Existing active session found, joining instead of creating:', existingSession.id);
        const joinResult = await this.joinExistingSession(existingSession, user);

        return {
          success: true,
          session: existingSession,
          callsSession: joinResult.callsSession,
          isNewSession: false,
          joinedExistingSession: true
        };
      } else if (existingSession.status === 'ended' || existingSession.status === 'failed') {
        // 終了済みセッションは削除して新規作成
        console.log('Ended session found, deleting and creating new:', existingSession.id);
        await videoSessionRepo.delete(existingSession.id);
      } else {
        // waiting/scheduledステータスのセッションは新規作成を許可（更新）
        console.log('Non-active session found, will update status:', existingSession.id, existingSession.status);
      }
    }

    // 4. 新規セッション作成
    const sessionId = crypto.randomUUID();
    const realtimeSessionId = crypto.randomUUID();

    const newSession: Omit<VideoSession, 'id'> = {
      appointmentId: parseInt(appointmentId),
      realtimeSessionId,
      status: 'active',
      createdAt: new Date(),
      startedAt: new Date(),
      endedAt: null,
      recordingUrl: null,
      participants: null,
      endReason: null,
      sessionMetrics: null
    };

    const createdSession = await videoSessionRepo.create({
      id: sessionId,
      ...newSession
    });

    // 5. Cloudflare Calls トークン生成
    const callsSession = this.callsClient ? await this.generateCallsToken(sessionId, user.id) : undefined;

    // 6. 予約ステータス更新
    await appointmentRepo.update(appointmentId, { status: 'in_progress' });

    return {
      success: true,
      session: createdSession,
      callsSession,
      isNewSession: true
    };
  }

  async joinSession(sessionId: string, user: User): Promise<JoinSessionResult> {
    const videoSessionRepo = this.repositoryFactory.createVideoSessionRepository();

    // セッション存在確認
    const session = await videoSessionRepo.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // セッション状態確認
    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    // 権限チェック
    const appointmentRepo = this.repositoryFactory.createAppointmentRepository();
    const appointment = await appointmentRepo.findById(session.appointmentId.toString());
    if (appointment) {
      await this.checkPermission(appointment, user);
    }

    // Calls トークン生成
    const callsSession = await this.generateCallsToken(sessionId, user.id);

    return {
      success: true,
      session,
      callsSession
    };
  }

  private async checkPermission(appointment: Appointment, user: User): Promise<void> {
    if (user.userType === 'patient' && appointment.patientId.toString() !== user.id) {
      throw new Error('Unauthorized');
    }
    // workerの場合は基本的にアクセス可能（実際のプロジェクトではより詳細な権限チェック）
  }

  private async joinExistingSession(session: VideoSession, user: User): Promise<{ callsSession: any }> {
    // 既存セッション参加のロジック
    const callsSession = this.callsClient ? await this.generateCallsToken(session.id, user.id) : {
      token: 'mock-token',
      sessionId: session.id
    };

    return { callsSession };
  }

  private async generateCallsToken(sessionId: string, userId: string): Promise<{ token: string; sessionId: string }> {
    if (!this.callsClient) {
      // Mock実装
      return {
        token: `mock-token-${userId}-${sessionId}`,
        sessionId
      };
    }

    // 実際のCloudflare Calls API呼び出し
    const session = await this.callsClient.createSession({ sessionId });
    return { token: session.token || 'generated-token', sessionId };
  }
}
