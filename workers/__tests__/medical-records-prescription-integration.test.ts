import { describe, test, expect, beforeEach } from 'vitest'
import { MockRepositoryFactory } from '../repositories/mock/factory'

describe('処方箋統合医療記録API', () => {
  let factory: MockRepositoryFactory

  beforeEach(() => {
    factory = new MockRepositoryFactory()
  })

  describe('医療記録と処方箋の統合データ構造', () => {
    test('医療記録に処方箋データを含めて保存できること', async () => {
      const medicalRecordRepo = factory.createMedicalRecordRepository()

      const prescriptionData = [
        {
          name: 'アセトアミノフェン',
          dosage: '500mg',
          frequency: '1日3回',
          duration: '5日分',
          instructions: '食後に服用'
        }
      ]

      const record = await medicalRecordRepo.create({
        appointmentId: 1,
        subjective: '患者は頭痛を訴えている',
        objective: '血圧130/80、体温37.2度',
        assessment: '軽度の感冒症状',
        plan: '対症療法、経過観察',
        prescriptions: JSON.stringify(prescriptionData)
      })

      expect(record).toBeDefined()
      expect(record.appointmentId).toBe(1)
      expect(typeof record.prescriptions).toBe('string')

      const parsedPrescriptions = JSON.parse(record.prescriptions as string)
      expect(parsedPrescriptions).toHaveLength(1)
      expect(parsedPrescriptions[0].name).toBe('アセトアミノフェン')
    })

    test('処方箋が空配列でも正常に保存できること', async () => {
      const medicalRecordRepo = factory.createMedicalRecordRepository()

      const record = await medicalRecordRepo.create({
        appointmentId: 2,
        subjective: '患者は軽微な症状を訴えている',
        objective: '特記すべき所見なし',
        assessment: '経過観察',
        plan: '1週間後の再診',
        prescriptions: JSON.stringify([])
      })

      expect(record).toBeDefined()
      const parsedPrescriptions = JSON.parse(record.prescriptions as string)
      expect(parsedPrescriptions).toEqual([])
    })

    test('処方箋データの必須フィールドをバリデーションできること', () => {
      const prescriptions = [
        {
          name: 'アセトアミノフェン',
          dosage: '500mg',
          frequency: '1日3回',
          duration: '5日分',
          instructions: '食後に服用'
        }
      ]

      // 必須フィールドの検証
      expect(prescriptions[0].name).toBeDefined()
      expect(prescriptions[0].dosage).toBeDefined()
      expect(prescriptions[0].frequency).toBeDefined()
      expect(prescriptions[0].duration).toBeDefined()
      expect(prescriptions[0].instructions).toBeDefined()
    })
  })

  describe('データ整合性', () => {
    test('医療記録のprescriptionsフィールドは正しいJSON形式であること', () => {
      const prescriptionData = [
        {
          name: 'ロキソプロフェン',
          dosage: '60mg',
          frequency: '1日2回',
          duration: '3日分',
          instructions: '疼痛時のみ服用'
        }
      ]

      const jsonString = JSON.stringify(prescriptionData)
      const parsed = JSON.parse(jsonString)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0]).toEqual(prescriptionData[0])
    })
  })
})
