import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { MockRepositoryFactory } from '../repositories/mock/factory';
import { VideoSessionService } from '../services/video-session.service';

// Mock環境
const mockEnv: Env = {
  DB: {} as any,
  CF_CALLS_APP_ID: 'test-app-id',
  CF_CALLS_APP_SECRET: 'test-secret',
  JWT_SECRET: 'test-jwt-secret',
  JWT_ACCESS_TOKEN_EXPIRY: '3600',
  JWT_REFRESH_TOKEN_EXPIRY: '604800',
  TURN_SERVICE_ID: 'test-turn-id',
  TURN_SERVICE_TOKEN: 'test-turn-token',
  SIGNALING_ROOM: {} as any,
  ASSETS: {} as any
};

// Mock user
const mockPatient = {
  id: '1',
  userType: 'patient' as const,
  email: 'patient@test.com'
};

const mockDoctor = {
  id: '2',
  userType: 'worker' as const,
  email: 'doctor@test.com'
};

describe('Video Sessions API', () => {
  let repositoryFactory: MockRepositoryFactory;
  let videoSessionService: VideoSessionService;

  beforeEach(() => {
    repositoryFactory = new MockRepositoryFactory();
    videoSessionService = new VideoSessionService(repositoryFactory);
    vi.clearAllMocks();
  });

  describe('POST /video-sessions/realtime/create', () => {
    test('新規セッション作成が成功する', async () => {
      // 予約データのセットアップ
      const appointmentId = 1;
      const appointmentRepo = repositoryFactory.createAppointmentRepository();
      await appointmentRepo.create({
        id: 1,
        patientId: 1,
        workerId: 2,
        status: 'scheduled',
        scheduledAt: new Date(),
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 新規セッション作成
      const result = await videoSessionService.createSession(appointmentId.toString(), mockPatient);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.appointmentId).toBe(1);
      expect(result.session.status).toBe('active');
      expect(result.isNewSession).toBe(true);
    });

    test.skip('既存セッションがある場合、join処理を実行する', async () => {
      const appointmentId = 2;

      // 予約データのセットアップ
      const appointmentRepo = repositoryFactory.createAppointmentRepository();
      await appointmentRepo.create({
        id: 2,
        patientId: 1,
        workerId: 2,
        status: 'scheduled',
        scheduledAt: new Date(),
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 既存セッションを作成
      const videoSessionRepo = repositoryFactory.createVideoSessionRepository();
      const existingSession = await videoSessionRepo.create({
        id: 'existing-session-id',
        appointmentId: 2,
        realtimeSessionId: 'existing-realtime-id',
        status: 'active',
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        recordingUrl: null,
        participants: {},
        endReason: null,
        sessionMetrics: {}
      });

      // 同じappointmentで再度セッション作成を試行
      const result = await videoSessionService.createSession(appointmentId.toString(), mockDoctor);

      expect(result.success).toBe(true);
      expect(result.session.id).toBe(existingSession.id);
      expect(result.isNewSession).toBe(false);
      expect(result.joinedExistingSession).toBe(true);
    });

    test('存在しない予約IDの場合エラーを返す', async () => {
      const nonExistentAppointmentId = 'non-existent-id';

      await expect(
        videoSessionService.createSession(nonExistentAppointmentId, mockPatient)
      ).rejects.toThrow('Appointment not found');
    });

    test.skip('権限のない予約に対してエラーを返す', async () => {
      const appointmentId = 3;
      const unauthorizedUser = {
        id: '99',
        userType: 'patient' as const,
        email: 'other@test.com'
      };

      // 予約データのセットアップ（別の患者の予約）
      const appointmentRepo = repositoryFactory.createAppointmentRepository();
      await appointmentRepo.create({
        id: 3,
        patientId: 1, // 別の患者ID
        workerId: 2,
        status: 'scheduled',
        scheduledAt: new Date(),
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await expect(
        videoSessionService.createSession(appointmentId.toString(), unauthorizedUser)
      ).rejects.toThrow('Unauthorized');
    });

    test('無効なappointmentIDフォーマットの場合エラーを返す', async () => {
      const invalidAppointmentId = '';

      await expect(
        videoSessionService.createSession(invalidAppointmentId, mockPatient)
      ).rejects.toThrow('Invalid appointment ID');
    });
  });

  describe('POST /video-sessions/realtime/join', () => {
    test('既存セッションに正常に参加できる', async () => {
      const appointmentId = 4;
      const sessionId = 'session-id-1';

      // 予約とセッションデータのセットアップ
      const appointmentRepo = repositoryFactory.createAppointmentRepository();
      await appointmentRepo.create({
        id: 4,
        patientId: 1,
        workerId: 2,
        status: 'scheduled',
        scheduledAt: new Date(),
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const videoSessionRepo = repositoryFactory.createVideoSessionRepository();
      await videoSessionRepo.create({
        id: sessionId,
        appointmentId: 4,
        realtimeSessionId: 'realtime-session-id',
        status: 'active',
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
        recordingUrl: null,
        participants: null,
        endReason: null,
        sessionMetrics: null
      });

      const result = await videoSessionService.joinSession(sessionId, mockDoctor);

      expect(result.success).toBe(true);
      expect(result.session.id).toBe(sessionId);
      expect(result.callsSession).toBeDefined();
    });

    test('存在しないセッションIDの場合エラーを返す', async () => {
      const nonExistentSessionId = 'non-existent-session-id';

      await expect(
        videoSessionService.joinSession(nonExistentSessionId, mockPatient)
      ).rejects.toThrow('Session not found');
    });

    test('非アクティブなセッションに参加を試みた場合エラーを返す', async () => {
      const appointmentId = 5;
      const sessionId = 'inactive-session-id';

      // 非アクティブなセッションを作成
      const videoSessionRepo = repositoryFactory.createVideoSessionRepository();
      await videoSessionRepo.create({
        id: sessionId,
        appointmentId: 5,
        realtimeSessionId: 'realtime-session-id',
        status: 'ended',
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: new Date(),
        recordingUrl: null,
        participants: null,
        endReason: 'completed',
        sessionMetrics: null
      });

      await expect(
        videoSessionService.joinSession(sessionId, mockPatient)
      ).rejects.toThrow('Session is not active');
    });
  });

  describe('SessionManager integration', () => {
    test.skip('SessionManagerの重複参加エラーが適切にハンドリングされる', async () => {
      const appointmentId = 6;

      // 予約データのセットアップ
      const appointmentRepo = repositoryFactory.createAppointmentRepository();
      await appointmentRepo.create({
        id: 6,
        patientId: 1,
        workerId: 2,
        status: 'scheduled',
        scheduledAt: new Date(),
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 最初のセッション作成
      const firstResult = await videoSessionService.createSession(appointmentId.toString(), mockPatient);
      expect(firstResult.success).toBe(true);
      expect(firstResult.isNewSession).toBe(true);

      // 同じappointmentで二回目のセッション作成（重複参加）
      const secondResult = await videoSessionService.createSession(appointmentId, mockDoctor);

      // エラーではなく、既存セッションに参加として処理される
      expect(secondResult.success).toBe(true);
      expect(secondResult.isNewSession).toBe(false);
      expect(secondResult.joinedExistingSession).toBe(true);
      expect(secondResult.session.id).toBe(firstResult.session.id);
    });
  });
});
