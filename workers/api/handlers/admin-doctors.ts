import { Hono } from 'hono'
import type { Env } from '../../app'
import { authMiddleware } from '../../auth/middleware'
import { DrizzleRepositoryFactory } from '../../repositories'
import { initializeDatabase } from '../../app'
import { jstDateToUtc } from '../../utils/timezone'
import type { JWTPayload } from '../../auth/jwt'

type Variables = {
  user: JWTPayload
}

const adminDoctors = new Hono<{ Bindings: Env; Variables: Variables }>()

// 医師一覧取得
adminDoctors.get('/', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  if (user.userType !== 'worker' || user.role !== 'admin') {
    return c.json({ error: 'Admin only' }, 403)
  }

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const workerRepo = factory.createWorkerRepository()

  // 医師のみを取得（管理者・オペレーター以外）
  const doctors = await workerRepo.findByRole('doctor')

  return c.json({
    doctors: doctors.map(doctor => ({
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      role: doctor.role,
      phoneNumber: doctor.phoneNumber,
      medicalLicenseNumber: doctor.medicalLicenseNumber,
      profileImageUrl: doctor.profileImageUrl,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    }))
  })
})

// 医師のスケジュール取得
adminDoctors.get('/:id/schedule', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  if (user.userType !== 'worker' || user.role !== 'admin') {
    return c.json({ error: 'Admin only' }, 403)
  }

  const doctorId = parseInt(c.req.param('id'))
  const dateParam = c.req.query('date') // YYYY-MM形式

  if (!dateParam) {
    return c.json({ error: '日付パラメータが必要です' }, 400)
  }

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const scheduleRepo = factory.createWorkerScheduleRepository()

  // 指定月の開始日と終了日を計算
  const [year, month] = dateParam.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // 月末

  const schedules = await scheduleRepo.findByWorkerId(doctorId, startDate, endDate)

  return c.json({
    schedules: schedules.map(schedule => ({
      id: schedule.id,
      scheduleDate: schedule.scheduleDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status,
      maxAppointments: schedule.maxAppointments
    }))
  })
})

// 医師のスケジュール更新
adminDoctors.put('/:id/schedule', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  if (user.userType !== 'worker' || user.role !== 'admin') {
    return c.json({ error: 'Admin only' }, 403)
  }

  const doctorId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { schedules } = body

  // バリデーション
  if (!schedules || !Array.isArray(schedules)) {
    return c.json({ error: 'スケジュールデータが必要です' }, 400)
  }

  for (const schedule of schedules) {
    if (!schedule.date || !schedule.startTime || !schedule.endTime) {
      return c.json({ error: '必須フィールドが不足しています' }, 400)
    }
  }

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const scheduleRepo = factory.createWorkerScheduleRepository()
  const workerRepo = factory.createWorkerRepository()

  // 医師の存在確認
  const doctor = await workerRepo.findById(doctorId)
  if (!doctor || doctor.role !== 'doctor') {
    return c.json({ error: '医師が見つかりません' }, 404)
  }

  // 既存のスケジュールを削除してから新規作成
  const dates = schedules.map(s => jstDateToUtc(s.date))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

  await scheduleRepo.deleteByWorkerIdAndDateRange(doctorId, minDate, maxDate)

  // 新しいスケジュールを作成
  const newSchedules = await scheduleRepo.bulkCreate(
    schedules.map(schedule => ({
      workerId: doctorId,
      scheduleDate: jstDateToUtc(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status || 'available',
      maxAppointments: schedule.maxAppointments || 10
    }))
  )

  return c.json({
    success: true,
    schedules: newSchedules
  })
})

// 医師のアクティブ状態更新
adminDoctors.put('/:id/status', authMiddleware(), async (c) => {
  const user = c.get('user') as JWTPayload
  if (user.userType !== 'worker' || user.role !== 'admin') {
    return c.json({ error: 'Admin only' }, 403)
  }

  const doctorId = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { isActive } = body

  if (typeof isActive !== 'boolean') {
    return c.json({ error: 'isActiveは真偽値である必要があります' }, 400)
  }

  const db = initializeDatabase(c.env)
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  const factory = new DrizzleRepositoryFactory(db)
  const workerRepo = factory.createWorkerRepository()

  // 医師の存在確認
  const doctor = await workerRepo.findById(doctorId)
  if (!doctor || doctor.role !== 'doctor') {
    return c.json({ error: '医師が見つかりません' }, 404)
  }

  // ステータス更新
  const updated = await workerRepo.update(doctorId, { isActive })
  if (!updated) {
    return c.json({ error: 'ステータスの更新に失敗しました' }, 500)
  }

  return c.json({
    success: true,
    doctor: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      isActive: updated.isActive
    }
  })
})

export default adminDoctors
