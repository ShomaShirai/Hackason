import { Hono } from 'hono';
import { eq, and, gte, lte, lt, or } from 'drizzle-orm';
import { workerSchedules } from '../../db/schema';
import { jstDateToUtc, utcToJstDateString } from '../../utils/timezone';
import type { Env } from '../../app';
import type { JWTPayload } from '../../auth/jwt';
import { authMiddleware } from '../../auth/middleware';
import { initializeDatabase } from '../../app';

type Context = {
  Bindings: Env;
  Variables: {
    user: JWTPayload;
  };
};

const doctorScheduleHandlers = new Hono<Context>();

// GET /api/worker/doctor/schedule - 医師のスケジュール一覧取得
doctorScheduleHandlers.get('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // クエリパラメータから日付を取得
    const date = c.req.query('date');

    // worker.idを取得（既に数値）
    const workerId = user.id;
    if (!workerId || typeof workerId !== 'number') {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    // スケジュール取得クエリ
    let query;
    if (date) {
      // 特定の日付のスケジュール（JSTで指定された日付をUTCに変換）
      const targetDate = jstDateToUtc(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      query = db.select()
        .from(workerSchedules)
        .where(
          and(
            eq(workerSchedules.workerId, workerId),
            gte(workerSchedules.scheduleDate, targetDate),
            lt(workerSchedules.scheduleDate, nextDate)
          )
        )
        .orderBy(workerSchedules.startTime);
    } else {
      // 今日以降のスケジュール（JST基準）
      const todayJst = new Date();
      const todayUtc = jstDateToUtc(utcToJstDateString(todayJst));

      query = db.select()
        .from(workerSchedules)
        .where(
          and(
            eq(workerSchedules.workerId, workerId),
            gte(workerSchedules.scheduleDate, todayUtc)
          )
        )
        .orderBy(workerSchedules.scheduleDate, workerSchedules.startTime)
        .limit(100);
    }

    const schedules = await query;

    // 日付フォーマットを調整してレスポンス（UTCからJSTに変換）
    const formattedSchedules = schedules.map(schedule => ({
      ...schedule,
      date: schedule.scheduleDate instanceof Date
        ? utcToJstDateString(schedule.scheduleDate)
        : utcToJstDateString(new Date(schedule.scheduleDate)),
      isAvailable: schedule.status === 'available'
    }));

    return c.json(formattedSchedules);
  } catch (error) {
    console.error('Error fetching doctor schedules:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/worker/doctor/schedule - 新規スケジュール作成
doctorScheduleHandlers.post('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const db = initializeDatabase(c.env);

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { date, startTime, endTime, maxAppointments } = body;

    // バリデーション
    if (!date || !startTime || !endTime) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // 日付と時刻の形式チェック
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!dateRegex.test(date)) {
      return c.json({ error: 'Invalid date format' }, 400);
    }

    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return c.json({ error: 'Invalid time format' }, 400);
    }

    // 時間の妥当性チェック
    if (startTime >= endTime) {
      return c.json({ error: 'End time must be after start time' }, 400);
    }

    // worker.idを取得（既に数値）
    const workerId = user.id;
    if (!workerId || typeof workerId !== 'number') {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    // 重複チェック
    // JST日付をUTCに変換（JSTの00:00:00をUTCに変換）
    const scheduleDate = jstDateToUtc(date);
    const nextDate = new Date(scheduleDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const existing = await db.select()
      .from(workerSchedules)
      .where(
        and(
          eq(workerSchedules.workerId, workerId),
          gte(workerSchedules.scheduleDate, scheduleDate),
          lte(workerSchedules.scheduleDate, nextDate),
          // 時間が重複していないかチェック
          or(
            and(
              lte(workerSchedules.startTime, startTime),
              gte(workerSchedules.endTime, startTime)
            ),
            and(
              lte(workerSchedules.startTime, endTime),
              gte(workerSchedules.endTime, endTime)
            )
          )
        )
      );

    if (existing.length > 0) {
      return c.json({ error: '同日に稼働予定があります' }, 409);
    }

    // 新規スケジュール作成
    const newSchedule = {
      workerId,
      scheduleDate,
      startTime,
      endTime,
      status: 'available' as const,
      maxAppointments: maxAppointments || 10,
    };

    const result = await db.insert(workerSchedules).values(newSchedule).returning();

    // レスポンス形式を調整
    const response = {
      ...result[0],
      date: utcToJstDateString(scheduleDate),
      isAvailable: true
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Error creating doctor schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT /api/worker/doctor/schedule/:id - スケジュール更新
doctorScheduleHandlers.put('/:id', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // パラメータからスケジュールIDを取得
    const scheduleId = c.req.param('id');
    const scheduleIdNum = parseInt(scheduleId, 10);

    if (isNaN(scheduleIdNum)) {
      return c.json({ error: 'Invalid schedule ID' }, 400);
    }

    // リクエストボディを取得
    const body = await c.req.json();
    const { date, startTime, endTime, maxAppointments } = body;

    // 必須フィールドの検証
    if (!date || !startTime || !endTime) {
      return c.json({ error: 'Missing required fields: date, startTime, endTime' }, 400);
    }

    // 時間の妥当性チェック
    if (startTime >= endTime) {
      return c.json({ error: 'End time must be after start time' }, 400);
    }

    // worker.idを取得（既に数値）
    const workerId = user.id;
    if (!workerId || typeof workerId !== 'number') {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    const db = initializeDatabase(c.env);
    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 既存スケジュールの確認
    const existingSchedule = await db
      .select()
      .from(workerSchedules)
      .where(eq(workerSchedules.id, scheduleIdNum))
      .get();


    if (!existingSchedule) {
      return c.json({ error: 'Schedule not found' }, 404);
    }


    // 所有者チェック
    if (existingSchedule.workerId !== workerId) {
      return c.json({ error: 'You can only update your own schedules' }, 403);
    }


        // 日付の重複チェック（既存レコード以外）
    const conflictingSchedules = await db
      .select()
      .from(workerSchedules)
      .where(
        and(
          eq(workerSchedules.workerId, workerId),
          eq(workerSchedules.scheduleDate, jstDateToUtc(date))
        )
      )
      .all();

    // 自分自身は除外して重複チェック
    const hasConflict = conflictingSchedules.some(schedule => schedule.id !== scheduleIdNum);

    if (hasConflict) {
      return c.json({
        error: '同日に稼働予定があります'
      }, 409);
    }

    // スケジュール更新
    const updatedSchedule = await db
      .update(workerSchedules)
      .set({
        scheduleDate: jstDateToUtc(date),
        startTime,
        endTime,
        maxAppointments: maxAppointments || 10,
        updatedAt: new Date()
      })
      .where(eq(workerSchedules.id, scheduleIdNum))
      .returning()
      .get();



    return c.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating doctor schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/worker/doctor/schedule/:id - スケジュール削除
doctorScheduleHandlers.delete('/:id', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const db = initializeDatabase(c.env);
    const scheduleId = c.req.param('id');

    if (!db) {
      return c.json({ error: 'Database not available' }, 500);
    }

    // 医師のみアクセス可能
    if (user.userType !== 'worker' || user.role !== 'doctor') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // worker.idを取得（既に数値）
    const workerId = user.id;
    const scheduleIdNum = parseInt(scheduleId, 10);
    if (!workerId || typeof workerId !== 'number' || isNaN(scheduleIdNum)) {
      return c.json({ error: 'Invalid ID' }, 400);
    }

    // まずスケジュールの存在確認
    const existingSchedule = await db
      .select()
      .from(workerSchedules)
      .where(eq(workerSchedules.id, scheduleIdNum))
      .get();

    if (!existingSchedule) {
      return c.json({ error: 'Schedule not found' }, 404);
    }

    // 所有者チェック
    if (existingSchedule.workerId !== workerId) {
      return c.json({ error: 'You can only delete your own schedules' }, 403);
    }

    // 予約がある場合は削除不可（statusが'busy'の場合）
    if (existingSchedule.status === 'busy') {
      return c.json({ error: 'Cannot delete busy schedule' }, 400);
    }

    await db.delete(workerSchedules)
      .where(eq(workerSchedules.id, scheduleIdNum));

    return c.newResponse(null, 204);
  } catch (error) {
    console.error('Error deleting doctor schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default doctorScheduleHandlers;
