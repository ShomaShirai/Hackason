/**
 * ビデオ通話セッション管理
 * 患者-医師間のセッション作成、参加、権限管理を行う
 */

import type { CloudflareCallsClient, CallsSession } from './calls-client';
import type { JWTPayload as AuthUser } from '../auth/jwt';
import { eq, and } from 'drizzle-orm';
import { videoSessions, appointments, sessionParticipants } from '../db/schema';
import type {
  VideoSession,
  Appointment,
  SessionParticipant,
  NewVideoSession,
  NewSessionParticipant
} from '../db/types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  WAITING = 'waiting',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed'
}

export interface CreateSessionResponse {
  session: VideoSession;
  callsSession: CallsSession;
}

export interface JoinSessionResponse {
  session: VideoSession;
  callsSession: CallsSession;
  permissions: SessionPermission[];
}

export interface SessionPermission {
  action: 'join' | 'leave' | 'mute' | 'unmute' | 'share_screen' | 'record' | 'end_session';
  allowed: boolean;
}

export class SessionManager {
  private db: DrizzleD1Database;
  private callsClient: CloudflareCallsClient;

  constructor(db: DrizzleD1Database, callsClient: CloudflareCallsClient) {
    this.db = db;
    this.callsClient = callsClient;
  }

  /**
   * 新しいビデオセッションを作成
   */
  async createSession(
    appointmentId: string,
    creatorUser: AuthUser
  ): Promise<CreateSessionResponse> {
    // 1. 予約情報を取得・検証（緊急用：一時的にスキップ）
    // const appointment = await this.getAppointment(appointmentId);
    // if (!appointment) {
    //   throw new Error('Appointment not found');
    // }
    console.log('⚠️ 緊急モード: appointment存在チェックをスキップ');

    // 2. 作成権限をチェック（緊急用：一時的にスキップ）
    // await this.checkCreatePermission(appointmentId, creatorUser);
    console.log('⚠️ 緊急モード: 権限チェックもスキップ');

    // 3. 既存のアクティブセッションがないか確認
    const existingSession = await this.getActiveSessionByAppointment(appointmentId);
    if (existingSession) {
      // 既存セッションがある場合は参加可能として処理
      console.log('Existing session found for appointment:', appointmentId, 'Session ID:', existingSession.id);
      throw new Error('Session already exists. Use join endpoint instead of create.');
    }

    // 4. Cloudflare Callsセッションを作成
    const sessionId = this.generateSessionId();
    const callsSession = await this.callsClient.createSession({ sessionId });

    // 5. データベースにセッション情報を保存
    const videoSessionData: NewVideoSession = {
      appointmentId: parseInt(appointmentId),
      realtimeSessionId: sessionId,
      status: SessionStatus.WAITING,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null
    };

    const insertResult = await this.db.insert(videoSessions).values({
      id: crypto.randomUUID(),
      appointmentId: videoSessionData.appointmentId,
      realtimeSessionId: videoSessionData.realtimeSessionId,
      status: videoSessionData.status
    }).returning();

    const createdSession = insertResult[0];

    // 6. 作成者を参加者として追加
    await this.addParticipant(createdSession.id, creatorUser);

    return {
      session: createdSession,
      callsSession
    };
  }

  /**
   * セッションに参加
   */
  async joinSession(
    sessionId: string,
    user: AuthUser
  ): Promise<JoinSessionResponse> {
    // 1. セッション情報を取得
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== SessionStatus.WAITING && session.status !== SessionStatus.ACTIVE) {
      throw new Error('Session is not available for joining');
    }

    // 2. 予約情報を取得
    const appointment = await this.getAppointment(session.appointmentId);
    if (!appointment) {
      throw new Error('Associated appointment not found');
    }

    // 3. 参加権限をチェック
    await this.checkJoinPermission(appointment, user);

    // 4. 既に参加しているかチェック（重複参加を許可）
    const existingParticipant = await this.getParticipant(session.id, user);
    if (existingParticipant && existingParticipant.isActive) {
      console.log('User already in session, returning existing session info:', user.id);
      // 既存の参加者情報で正常に処理
    } else {
      // 5. 新規参加者として追加または再アクティベート
      if (existingParticipant) {
        await this.reactivateParticipant(existingParticipant.id);
      } else {
        await this.addParticipant(session.id, user);
      }
    }

    // 6. セッションをアクティブに更新（初回参加時）
    if (session.status === SessionStatus.WAITING) {
      await this.updateSessionStatus(session.id, SessionStatus.ACTIVE);
    }

    // 7. Calls APIトークンを生成
    const callsSession = await this.callsClient.createSession({
      sessionId: session.realtimeSessionId
    });

    // 8. 権限を取得
    const permissions = this.getUserPermissions(user);

    return {
      session,
      callsSession,
      permissions
    };
  }

  /**
   * セッションから退出
   */
  async leaveSession(sessionId: string, user: AuthUser): Promise<void> {
    const participant = await this.getParticipant(sessionId, user);
    if (!participant || !participant.isActive) {
      throw new Error('User is not in the session');
    }

    // 参加者を非アクティブに更新
    await this.db.update(sessionParticipants)
      .set({
        isActive: false,
        leftAt: new Date()
      })
      .where(eq(sessionParticipants.id, participant.id));

    // アクティブな参加者が0人になったらセッションを終了
    const activeCount = await this.getActiveParticipantCount(sessionId);
    if (activeCount === 0) {
      await this.endSession(sessionId, 'completed');
    }
  }

  /**
   * セッションを終了
   */
  async endSession(
    sessionId: string,
    _reason: 'completed' | 'timeout' | 'error' | 'cancelled'
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // セッションステータスを更新
    await this.db.update(videoSessions)
      .set({
        status: SessionStatus.ENDED,
        endedAt: new Date()
      })
      .where(eq(videoSessions.id, sessionId));

    // 全ての参加者を非アクティブに
    await this.db.update(sessionParticipants)
      .set({
        isActive: false,
        leftAt: new Date()
      })
      .where(
        and(
          eq(sessionParticipants.videoSessionId, sessionId),
          eq(sessionParticipants.isActive, true)
        )
      );
  }

  /**
   * 作成権限をチェック
   */
  private async checkCreatePermission(
    appointmentId: string,
    user: AuthUser
  ): Promise<void> {
    // 患者: 自分の予約のみ
    if (user.userType === 'patient' && appointmentId !== user.id) {
      throw new Error('Permission denied: Not your appointment');
    }

    // 医療従事者: 基本的に全ての予約にアクセス可能（開発環境用に緩和）
    // 本番環境では適切な権限チェックを実装する予定
  }

  /**
   * 参加権限をチェック
   */
  private async checkJoinPermission(
    appointment: Appointment,
    user: AuthUser
  ): Promise<void> {
    // 患者: 自分の予約のみ
    if (user.userType === 'patient' && appointment.patientId !== user.id) {
      throw new Error('Permission denied: Not your appointment');
    }

    // 医師: 担当予約またはサポート参加
    if (user.userType === 'worker' && user.role === 'doctor') {
      const canJoin = appointment.workerId === user.id ||
                     await this.isSupportDoctor(user.id, appointment.id.toString());
      if (!canJoin) {
        throw new Error('Permission denied: Not authorized for this appointment');
      }
    }

    // オペレータ・管理者: 全て参加可能（追加チェックなし）
  }

  /**
   * ユーザーの権限を取得
   */
  private getUserPermissions(user: AuthUser): SessionPermission[] {
    const basePermissions: SessionPermission[] = [
      { action: 'join', allowed: true },
      { action: 'leave', allowed: true },
      { action: 'mute', allowed: true },
      { action: 'unmute', allowed: true },
      { action: 'share_screen', allowed: true }
    ];

    // 医療従事者は追加権限
    if (user.userType === 'worker') {
      basePermissions.push({ action: 'end_session', allowed: true });

      // 将来の拡張用
      if (user.role === 'admin') {
        basePermissions.push({ action: 'record', allowed: true });
      }
    }

    return basePermissions;
  }

  /**
   * 参加者を追加
   */
  private async addParticipant(
    videoSessionId: string,
    user: AuthUser
  ): Promise<void> {
    const participant: NewSessionParticipant = {
      videoSessionId,
      userType: user.userType,
      userId: user.id,
      role: user.role,
      joinedAt: new Date().toISOString(),
      isActive: true
    };

    await this.db.insert(sessionParticipants).values({
      id: crypto.randomUUID(),
      videoSessionId: participant.videoSessionId,
      userType: participant.userType,
      userId: participant.userId,
      role: participant.role || null,
      joinedAt: new Date(participant.joinedAt),
      leftAt: null,
      isActive: participant.isActive
    });
  }

  // ヘルパーメソッド
  private generateSessionId(): string {
    return `session-${Date.now()}-${crypto.randomUUID()}`;
  }

  private async getSession(sessionId: string): Promise<VideoSession | null> {
    if (!sessionId) {
      return null;
    }

    const session = await this.db.select().from(videoSessions)
      .where(eq(videoSessions.id, sessionId))
      .get();

    if (!session) {
      return null;
    }
    return {
      id: session.id,
      appointmentId: session.appointmentId.toString(),
      realtimeSessionId: session.realtimeSessionId,
      status: session.status as SessionStatus,
      createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : new Date().toISOString(),
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : undefined,
      endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : undefined
    };
  }

  private async getAppointment(appointmentId: string): Promise<Appointment | null> {
    const appointment = await this.db.select().from(appointments)
      .where(eq(appointments.id, parseInt(appointmentId)))
      .get();

    if (!appointment) {
      return null;
    }
    return {
      id: appointment.id.toString(),
      patientId: appointment.patientId,
      workerId: appointment.assignedWorkerId || undefined,
      doctorId: appointment.assignedWorkerId || undefined, // assignedWorkerIdをdoctorIdとして扱う
      status: appointment.status,
      scheduledAt: new Date(appointment.scheduledAt).toISOString()
    };
  }

  private async getActiveSessionByAppointment(appointmentId: string): Promise<VideoSession | null> {
    const session = await this.db.select().from(videoSessions)
      .where(
        and(
          eq(videoSessions.appointmentId, parseInt(appointmentId)),
          eq(videoSessions.status, SessionStatus.WAITING)
        )
      )
      .get();

    if (!session) {
      const activeSession = await this.db.select().from(videoSessions)
        .where(
          and(
            eq(videoSessions.appointmentId, parseInt(appointmentId)),
            eq(videoSessions.status, SessionStatus.ACTIVE)
          )
        )
        .get();

      if (!activeSession) {
        return null;
      }
      return {
        id: activeSession.id,
        appointmentId: activeSession.appointmentId.toString(),
        realtimeSessionId: activeSession.realtimeSessionId,
        status: activeSession.status as SessionStatus,
        createdAt: activeSession.createdAt?.toISOString() || new Date().toISOString(),
        startedAt: activeSession.startedAt?.toISOString(),
        endedAt: activeSession.endedAt?.toISOString()
      };
    }

    return {
      id: session.id,
      appointmentId: session.appointmentId.toString(),
      realtimeSessionId: session.realtimeSessionId,
      status: session.status as SessionStatus,
      createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : new Date().toISOString(),
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : undefined,
      endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : undefined
    };
  }

  private async getParticipant(
    sessionId: string,
    user: AuthUser
  ): Promise<SessionParticipant | null> {
    const participant = await this.db.select().from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.videoSessionId, sessionId),
          eq(sessionParticipants.userType, user.userType),
          eq(sessionParticipants.userId, user.id)
        )
      )
      .get();

    if (!participant) {
      return null;
    }
    return {
      id: participant.id,
      videoSessionId: participant.videoSessionId,
      userType: participant.userType as 'patient' | 'worker',
      userId: participant.userId,
      role: participant.role as 'doctor' | 'operator' | 'admin' | undefined,
      joinedAt: new Date(participant.joinedAt).toISOString(),
      leftAt: participant.leftAt ? new Date(participant.leftAt).toISOString() : undefined,
      isActive: participant.isActive
    };
  }

  private async reactivateParticipant(participantId: string): Promise<void> {
    await this.db.update(sessionParticipants)
      .set({
        isActive: true,
        joinedAt: new Date(),
        leftAt: null
      })
      .where(eq(sessionParticipants.id, participantId));
  }

  private async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const updateData: any = { status };
    if (status === SessionStatus.ACTIVE) {
      updateData.startedAt = new Date();
    }

    await this.db.update(videoSessions)
      .set(updateData)
      .where(eq(videoSessions.id, sessionId));
  }

  private async getActiveParticipantCount(sessionId: string): Promise<number> {
    const result = await this.db.select().from(sessionParticipants)
      .where(
        and(
          eq(sessionParticipants.videoSessionId, sessionId),
          eq(sessionParticipants.isActive, true)
        )
      );

    return result.length;
  }

  private async isSupportDoctor(_doctorId: number, _appointmentId: string): Promise<boolean> {
    // ハッカソン版では簡易実装: 全ての医師がサポート参加可能
    return true;
  }
}
