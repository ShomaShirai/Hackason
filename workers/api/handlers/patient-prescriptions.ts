import { Hono } from 'hono'
import { authMiddleware } from '../../auth/middleware'
import { eq, and } from 'drizzle-orm'
import { medicalRecords, appointments, workers } from '../../db/schema'
import { drizzle } from 'drizzle-orm/d1'


type JWTPayload = {
  userType: 'patient' | 'worker'
  id: number
  email: string
  role?: string
}

type Variables = { user: JWTPayload }
type Env = {
  DB?: D1Database
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// 特定診察の処方箋取得
app.get('/medical-records/:appointmentId/prescriptions', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    const appointmentId = parseInt(c.req.param('appointmentId'))
    if (isNaN(appointmentId)) {
      return c.json({ error: '無効な診察IDです' }, 400)
    }

    let db
    if (c.env?.DB) {
      db = drizzle(c.env.DB)
    } else {
      return c.json({ error: 'Database not available' }, 500)
    }

    // 診察記録と予約情報を結合して取得
    const results = await db
      .select({
        medicalRecord: medicalRecords,
        appointment: appointments,
      })
      .from(medicalRecords)
      .innerJoin(appointments, eq(medicalRecords.appointmentId, appointments.id))
      .where(
        and(
          eq(medicalRecords.appointmentId, appointmentId),
          eq(appointments.patientId, user.id)
        )
      )
      .all()

    if (results.length === 0) {
      return c.json({ error: '診察記録が見つかりません' }, 404)
    }

    const record = results[0].medicalRecord

    // prescriptionsフィールドをパースして処方箋を取得
    let prescriptions = []
    try {
      const prescriptionsData = record.prescriptions
      if (typeof prescriptionsData === 'string') {
        prescriptions = JSON.parse(prescriptionsData)
      } else if (Array.isArray(prescriptionsData)) {
        prescriptions = prescriptionsData
      }
    } catch (error) {
      console.error('処方箋データのパースに失敗:', error)
      prescriptions = []
    }

    return c.json({
      success: true,
      prescriptions: prescriptions,
      appointmentId: appointmentId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  } catch (error) {
    console.error('処方箋取得エラー:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// 患者の全処方箋一覧取得
app.get('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as JWTPayload
    if (user.userType !== 'patient') {
      return c.json({ error: 'Patients only' }, 403)
    }

    let db
    if (c.env?.DB) {
      db = drizzle(c.env.DB)
    } else {
      return c.json({ error: 'Database not available' }, 500)
    }

    // 患者の完了した診察から処方箋情報を取得
    const results = await db
      .select({
        medicalRecord: medicalRecords,
        appointment: appointments,
        doctor: workers,
      })
      .from(medicalRecords)
      .innerJoin(appointments, eq(medicalRecords.appointmentId, appointments.id))
      .leftJoin(workers, eq(appointments.assignedWorkerId, workers.id))
      .where(
        eq(appointments.patientId, user.id)
      )
      .orderBy(appointments.scheduledAt)
      .all()

    // 処方箋データを変換
    const prescriptionsList = results
      .map((result: any) => {
        const { medicalRecord, appointment, doctor } = result

        // prescriptionsフィールドをパース
        let medications = []
        try {
          const prescriptionsData = medicalRecord.prescriptions
          if (typeof prescriptionsData === 'string') {
            medications = JSON.parse(prescriptionsData)
          } else if (Array.isArray(prescriptionsData)) {
            medications = prescriptionsData
          }
        } catch (error) {
          console.error('処方箋データのパースに失敗:', error)
          medications = []
        }

        // 処方箋が存在しない場合はスキップ
        if (!medications || medications.length === 0) {
          return null
        }

        return {
          appointmentId: appointment.id,
          scheduledAt: appointment.scheduledAt,
          appointmentStatus: appointment.status,
          appointmentType: appointment.appointmentType,
          doctorId: doctor?.id || null,
          doctorName: doctor?.name || '担当医師未設定',
          medications: medications,
          medicationCount: medications.length,
          prescribedAt: medicalRecord.createdAt,
          updatedAt: medicalRecord.updatedAt,
        }
      })
      .filter((item: any) => item !== null) // 処方箋がないものを除外

    return c.json({
      success: true,
      prescriptions: prescriptionsList,
      totalCount: prescriptionsList.length,
    })
  } catch (error) {
    console.error('処方箋一覧取得エラー:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
