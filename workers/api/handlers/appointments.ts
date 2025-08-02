import { Hono } from 'hono'
import type { Env } from '../../app'
import { authMiddleware } from '../../auth/middleware'
import { DrizzleRepositoryFactory } from '../../repositories'
import { initializeDatabase } from '../../app'
import { jstToUtc } from '../../utils/timezone'
import type { JWTPayload } from '../../auth/jwt'

type Variables = {
  user: JWTPayload
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// 利用可能なスロット取得
app.get('/available-slots', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    const date = c.req.query('date')
    const specialty = c.req.query('specialty')

    if (!date) {
      return c.json({ error: '日付パラメータが必要です' }, 400)
    }

    const db = initializeDatabase(c.env)
    if (!db) {
      return c.json({ error: 'Database not available' }, 500)
    }

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()

    const targetDate = new Date(date)
    const slots = await appointmentRepo.findAvailableSlots(targetDate)

    // 専門科でフィルタリング
    const filteredSlots = specialty
      ? slots.filter(slot => slot.specialty === specialty)
      : slots

    return c.json({ slots: filteredSlots })
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return c.json({ error: 'Failed to fetch available slots' }, 500)
  }
})

// 予約作成
app.post('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    const body = await c.req.json()
    const {
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      appointmentType,
      chiefComplaint,
    } = body

    // 必須フィールドチェック
    if (!doctorId || !appointmentDate || !startTime || !endTime) {
      return c.json({ error: '必須フィールドが不足しています' }, 400)
    }

    const db = initializeDatabase(c.env)
    if (!db) {
      return c.json({ error: 'Database not available' }, 500)
    }

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()

    // 重複チェック
    // JST時刻をUTCに変換
    const scheduledAt = jstToUtc(appointmentDate, startTime)
    const endAt = jstToUtc(appointmentDate, endTime)

    const conflictingAppointments = await appointmentRepo.findConflicting(
      doctorId,
      scheduledAt,
      endAt
    )

    if (conflictingAppointments.length > 0) {
      return c.json({ error: 'その時間帯にはすでに予約があります' }, 409)
    }

    // 予約作成
    const durationMinutes = Math.floor((endAt.getTime() - scheduledAt.getTime()) / 1000 / 60)
    const appointment = await appointmentRepo.create({
      patientId: user.id,
      assignedWorkerId: doctorId,
      scheduledAt,
      durationMinutes,
      status: 'scheduled',
      appointmentType: appointmentType || 'initial',
      chiefComplaint: chiefComplaint || '',
    })

    return c.json(
      {
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.assignedWorkerId,
          scheduledAt: appointment.scheduledAt,
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          appointmentType: appointment.appointmentType,
          chiefComplaint: appointment.chiefComplaint,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
      },
      201
    )
  } catch (error) {
    console.error('Error creating appointment:', error)
    return c.json({ error: 'Failed to create appointment' }, 500)
  }
})

// 患者の予約一覧取得
app.get('/', authMiddleware(), async (c) => {
  try {
    console.log('[DEBUG] Starting appointment list fetch')
    const user = c.get('user') as JWTPayload as any // 型エラーを回避するため一時的にany型を使用
    console.log('[DEBUG] User:', JSON.stringify(user))

    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const status = c.req.query('status')
    const offset = (page - 1) * limit
    console.log('[DEBUG] Query params:', { page, limit, status, offset })

    const db = initializeDatabase(c.env)
    if (!db) {
      console.log('[DEBUG] Database not available')
      return c.json({ error: 'Database not available' }, 500)
    }
    console.log('[DEBUG] Database initialized successfully')

    const factory = new DrizzleRepositoryFactory(db)
    const appointmentRepo = factory.createAppointmentRepository()
    const questionnaireRepo = factory.createQuestionnaireRepository()
    console.log('[DEBUG] Repository created successfully')

    console.log('[DEBUG] Calling findByPatientId with user.id:', user.id)
    const appointments = await appointmentRepo.findByPatientId(user.id, {
      limit,
      offset,
      orderBy: 'scheduledAt',
      orderDirection: 'desc',
    })
    console.log('[DEBUG] Appointments from DB:', JSON.stringify(appointments))

    // appointmentsがnullまたはundefinedでないことを確認
    if (!appointments) {
      console.log('[DEBUG] Appointments is null or undefined')
      return c.json({ error: 'No appointments data' }, 500)
    }

    // ステータスでフィルタリング
    const filteredAppointments = status
      ? appointments.filter((apt: any) => apt.status === status)
      : appointments
    console.log('[DEBUG] Filtered appointments:', JSON.stringify(filteredAppointments))

    console.log('[DEBUG] Mapping appointments...')
    const mappedAppointments = await Promise.all(filteredAppointments.map(async (apt: any) => {
      console.log('[DEBUG] Processing appointment:', JSON.stringify(apt))
      
      // 問診票の完了状態を取得
      const questionnaire = await questionnaireRepo.findByAppointmentId(apt.id)
      
      return {
        id: apt.id,
        scheduledAt: apt.scheduledAt,
        status: apt.status,
        chiefComplaint: apt.chiefComplaint || '',
        appointmentType: apt.appointmentType || 'initial',
        durationMinutes: apt.durationMinutes || 30,
        startedAt: apt.startedAt,
        endedAt: apt.endedAt,
        doctor: apt.assignedWorkerId ? {
          id: apt.assignedWorkerId,
          name: apt.doctorName || '未定',
          role: apt.doctorRole || 'doctor',
        } : null,
        questionnaireCompletedAt: questionnaire?.completedAt || null,
      }
    }))
    console.log('[DEBUG] Mapped appointments successfully')

    return c.json({
      appointments: mappedAppointments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredAppointments.length / limit),
        totalCount: filteredAppointments.length,
        hasNextPage: page * limit < filteredAppointments.length,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('[ERROR] Detailed error in appointments fetch:', error)
    console.error('[ERROR] Error name:', (error as any)?.name)
    console.error('[ERROR] Error message:', (error as any)?.message)
    console.error('[ERROR] Error stack:', (error as any)?.stack)
    return c.json({ error: 'Failed to fetch appointments' }, 500)
  }
})

export default app
