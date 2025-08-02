import { Hono } from 'hono';
import { DrizzleRepositoryFactory } from '../../repositories';
import { authMiddleware } from '../../auth/middleware';

const operatorAppointmentHandlers = new Hono();

// GET /api/worker/operator/appointments - 予約一覧取得
operatorAppointmentHandlers.get('/', authMiddleware(), async (c: any) => {
  console.log('=== DEBUG: Starting appointment handler ===');

  try {
    const user = c.get('user');
    console.log('User from context:', user);

    if (!user) {
      console.log('No user found in context');
      return c.json({ error: 'No user found' }, 401);
    }

    // オペレータまたは管理者のみアクセス可能
    if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
      console.log('Permission denied for user:', user);
      return c.json({ error: 'Permission denied' }, 403);
    }

    console.log('Permission check passed');

    // 一時的にシンプルなレスポンスを返す
    return c.json({
      appointments: [],
      pagination: {
        currentPage: 1,
        totalCount: 0,
        hasNextPage: false,
      }
    });

  } catch (error) {
    console.error('Error in appointment handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT /:id - 予約更新（/api/worker/appointmentsから呼ばれる）
operatorAppointmentHandlers.put('/:id', authMiddleware(), async (c: any) => {
  const user = c.get('user');
  const appointmentId = parseInt(c.req.param('id'), 10);
  const repoFactory = new DrizzleRepositoryFactory(c.env.DB);
  const appointmentRepo = repoFactory.createAppointmentRepository();

  // オペレータまたは管理者のみアクセス可能
  if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
    return c.json({ error: 'Permission denied' }, 403);
  }

  try {
    const body = await c.req.json();
    const { status, assignedWorkerId, scheduledAt, chiefComplaint, durationMinutes } = body;

    // 既存の予約を取得
    const existingAppointment = await appointmentRepo.findById(appointmentId);
    if (!existingAppointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 更新データを準備
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {updateData.status = status;}
    if (assignedWorkerId !== undefined) {updateData.assignedWorkerId = assignedWorkerId;}
    if (scheduledAt !== undefined) {updateData.scheduledAt = new Date(scheduledAt);}
    if (chiefComplaint !== undefined) {updateData.chiefComplaint = chiefComplaint;}
    if (durationMinutes !== undefined) {updateData.durationMinutes = durationMinutes;}

    // 予約を更新
    const updatedAppointment = await appointmentRepo.update(appointmentId, updateData);

    return c.json({
      success: true,
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    return c.json({ error: 'Failed to update appointment' }, 500);
  }
});

// DELETE /:id - 予約削除（キャンセル）（/api/worker/appointmentsから呼ばれる）
operatorAppointmentHandlers.delete('/:id', authMiddleware(), async (c: any) => {
  const user = c.get('user');
  const appointmentId = parseInt(c.req.param('id'), 10);
  const repoFactory = new DrizzleRepositoryFactory(c.env.DB);
  const appointmentRepo = repoFactory.createAppointmentRepository();

  // オペレータまたは管理者のみアクセス可能
  if (user.userType !== 'worker' || (user.role !== 'operator' && user.role !== 'admin')) {
    return c.json({ error: 'Permission denied' }, 403);
  }

  try {
    // 既存の予約を取得
    const existingAppointment = await appointmentRepo.findById(appointmentId);
    if (!existingAppointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    // 既にキャンセル済みの場合はエラー
    if (existingAppointment.status === 'cancelled') {
      return c.json({ error: 'Appointment is already cancelled' }, 400);
    }

    // 予約をキャンセル状態に更新
    await appointmentRepo.update(appointmentId, {
      status: 'cancelled',
      updatedAt: new Date(),
    });

    return c.json({
      success: true,
      message: 'Appointment cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return c.json({ error: 'Failed to cancel appointment' }, 500);
  }
});

export default operatorAppointmentHandlers;
