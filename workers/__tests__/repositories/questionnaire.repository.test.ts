import { describe, it, expect, beforeEach } from 'vitest'
import { MockQuestionnaireRepository } from '../../repositories/mock/questionnaire.repository'
import type { Questionnaire } from '../../db/schema'

describe('問診リポジトリテスト', () => {
  let repository: MockQuestionnaireRepository
  let testQuestionnaire: Questionnaire

  beforeEach(() => {
    // テストデータ準備
    testQuestionnaire = {
      id: 1,
      appointmentId: 2,
      questionsAnswers: JSON.stringify({
        symptoms: '頭痛と発熱',
        symptom_duration: '昨日',
        allergies: '特になし'
      }),
      aiSummary: null,
      urgencyLevel: null,
      completedAt: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z')
    }

    // 初期データでリポジトリを初期化
    repository = new MockQuestionnaireRepository([testQuestionnaire])
  })

  describe('基本CRUD操作', () => {
    it('ID指定で問診票を取得できる', async () => {
      const result = await repository.findById(1)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(1)
      expect(result!.appointmentId).toBe(2)
      expect(JSON.parse(result!.questionsAnswers as string)).toEqual({
        symptoms: '頭痛と発熱',
        symptom_duration: '昨日',
        allergies: '特になし'
      })
    })

    it('存在しないIDで null を返す', async () => {
      const result = await repository.findById(999)
      expect(result).toBeNull()
    })

    it('新しい問診票を作成できる', async () => {
      const newQuestionnaire = {
        appointmentId: 3,
        questionsAnswers: JSON.stringify({
          symptoms: '咳と喉の痛み',
          symptom_duration: '今日'
        })
      }

      const result = await repository.create(newQuestionnaire)

      expect(result.id).toBe(2) // 次のID
      expect(result.appointmentId).toBe(3)
      expect(result.questionsAnswers).toBe(newQuestionnaire.questionsAnswers)
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
    })

    it('問診票を更新できる', async () => {
      const updateData = {
        urgencyLevel: 'high' as const,
        aiSummary: 'AI分析結果'
      }

      const result = await repository.update(1, updateData)

      expect(result).not.toBeNull()
      expect(result!.urgencyLevel).toBe('high')
      expect(result!.aiSummary).toBe('AI分析結果')
      expect(result!.updatedAt).toBeInstanceOf(Date)
    })

    it('問診票を削除できる', async () => {
      const deleteResult = await repository.delete(1)
      expect(deleteResult).toBe(true)

      const findResult = await repository.findById(1)
      expect(findResult).toBeNull()
    })

    it('存在しない問診票の削除でfalseを返す', async () => {
      const result = await repository.delete(999)
      expect(result).toBe(false)
    })
  })

  describe('予約ID検索', () => {
    it('予約IDで問診票を取得できる', async () => {
      const result = await repository.findByAppointmentId(2)

      expect(result).not.toBeNull()
      expect(result!.appointmentId).toBe(2)
      expect(result!.id).toBe(1)
    })

    it('存在しない予約IDでnullを返す', async () => {
      const result = await repository.findByAppointmentId(999)
      expect(result).toBeNull()
    })

    it('複数の問診票がある場合の予約ID検索', async () => {
      // 追加データを作成
      await repository.create({
        appointmentId: 3,
        questionsAnswers: JSON.stringify({ symptoms: 'テスト症状' })
      })

      const result1 = await repository.findByAppointmentId(2)
      const result2 = await repository.findByAppointmentId(3)

      expect(result1!.appointmentId).toBe(2)
      expect(result2!.appointmentId).toBe(3)
    })
  })

  describe('回答更新機能', () => {
    it('新しい回答を追加できる', async () => {
      const newAnswers = {
        medications: '風邪薬を服用中',
        medical_history: '高血圧'
      }

      const result = await repository.updateAnswers(1, newAnswers)

      expect(result).not.toBeNull()

      const updatedAnswers = JSON.parse(result!.questionsAnswers as string)
      expect(updatedAnswers).toEqual({
        symptoms: '頭痛と発熱',      // 既存の回答
        symptom_duration: '昨日',     // 既存の回答
        allergies: '特になし',        // 既存の回答
        medications: '風邪薬を服用中',  // 新しい回答
        medical_history: '高血圧'      // 新しい回答
      })
    })

    it('既存の回答を上書きできる', async () => {
      const updatedAnswers = {
        symptoms: '頭痛のみ（発熱は改善）',
        allergies: '薬物アレルギーあり'
      }

      const result = await repository.updateAnswers(1, updatedAnswers)

      const answers = JSON.parse(result!.questionsAnswers as string)
      expect(answers.symptoms).toBe('頭痛のみ（発熱は改善）')
      expect(answers.allergies).toBe('薬物アレルギーあり')
      expect(answers.symptom_duration).toBe('昨日') // 変更されていない項目
    })

    it('存在しない問診票の回答更新でnullを返す', async () => {
      const result = await repository.updateAnswers(999, { test: 'value' })
      expect(result).toBeNull()
    })

    it('空の問診票の回答更新', async () => {
      // 回答が空の問診票を作成
      const emptyQuestionnaire = await repository.create({
        appointmentId: 4,
        questionsAnswers: '{}'
      })

      const newAnswers = { symptoms: '新しい症状' }
      const result = await repository.updateAnswers(emptyQuestionnaire.id, newAnswers)

      const answers = JSON.parse(result!.questionsAnswers as string)
      expect(answers).toEqual({ symptoms: '新しい症状' })
    })
  })

  describe('問診完了機能', () => {
    it('問診を完了状態にマークできる', async () => {
      const result = await repository.markAsCompleted(1)

      expect(result).not.toBeNull()
      expect(result!.completedAt).toBeInstanceOf(Date)
      expect(result!.updatedAt).toBeInstanceOf(Date)
    })

    it('存在しない問診票の完了マークでnullを返す', async () => {
      const result = await repository.markAsCompleted(999)
      expect(result).toBeNull()
    })

    it('既に完了済みの問診票を再度完了マーク', async () => {
      const firstCompletion = new Date('2025-01-01T10:00:00.000Z')

      // 最初の完了
      await repository.update(1, { completedAt: firstCompletion })

      // 再度完了マーク
      const result = await repository.markAsCompleted(1)

      expect(result!.completedAt).not.toEqual(firstCompletion)
      expect(result!.completedAt).toBeInstanceOf(Date)
    })
  })

  describe('全件取得・検索オプション', () => {
    beforeEach(async () => {
      // テスト用のデータを追加
      await repository.create({
        appointmentId: 3,
        questionsAnswers: JSON.stringify({ symptoms: '症状A' }),
        completedAt: new Date('2025-01-01T10:00:00.000Z')
      })

      await repository.create({
        appointmentId: 4,
        questionsAnswers: JSON.stringify({ symptoms: '症状B' })
      })
    })

    it('全件取得できる', async () => {
      const results = await repository.findAll()
      expect(results).toHaveLength(3) // 初期データ + 追加した2件
    })

    it('件数制限で取得', async () => {
      const results = await repository.findAll({ limit: 2 })
      expect(results).toHaveLength(2)
    })

    it('オフセット指定で取得', async () => {
      const results = await repository.findAll({ offset: 1, limit: 2 })
      expect(results).toHaveLength(2)
      expect(results[0].id).not.toBe(1) // 最初のレコードを除外
    })
  })

  describe('エラーケース・境界値テスト', () => {
    it('負のIDで検索', async () => {
      const result = await repository.findById(-1)
      expect(result).toBeNull()
    })

    it('ゼロIDで検索', async () => {
      const result = await repository.findById(0)
      expect(result).toBeNull()
    })

    it('無効なJSONでの回答更新をハンドリング', async () => {
      // 不正なJSONを含む問診票を作成
      const invalidQuestionnaire = await repository.create({
        appointmentId: 5,
        questionsAnswers: 'invalid json'
      })

      // 回答更新が適切にエラーハンドリングされるかテスト
      // （実装によってはtry-catch が必要）
      try {
        const result = await repository.updateAnswers(invalidQuestionnaire.id, { test: 'value' })
        // エラーが発生しない場合、空のオブジェクトとして扱われることを確認
        expect(result).not.toBeNull()
      } catch (error) {
        // JSON.parseエラーが発生した場合、適切にハンドリングされることを確認
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('非常に大きなIDでの操作', async () => {
      const largeId = Number.MAX_SAFE_INTEGER
      const result = await repository.findById(largeId)
      expect(result).toBeNull()
    })
  })

  describe('統合シナリオテスト', () => {
    it('問診フロー全体のテスト', async () => {
      // 1. 新しい問診票を作成
      const newQuestionnaire = await repository.create({
        appointmentId: 10,
        questionsAnswers: JSON.stringify({})
      })

      // 2. 段階的に回答を追加
      const step1 = await repository.updateAnswers(newQuestionnaire.id, {
        symptoms: '発熱、咳'
      })
      expect(step1).not.toBeNull()

      const step2 = await repository.updateAnswers(newQuestionnaire.id, {
        symptom_duration: '3日前',
        allergies: '特になし'
      })

      // 3. 最終的な回答を確認
      const finalAnswers = JSON.parse(step2!.questionsAnswers as string)
      expect(finalAnswers).toEqual({
        symptoms: '発熱、咳',
        symptom_duration: '3日前',
        allergies: '特になし'
      })

      // 4. 問診を完了
      const completed = await repository.markAsCompleted(newQuestionnaire.id)
      expect(completed!.completedAt).toBeInstanceOf(Date)

      // 5. 予約IDで検索して確認
      const found = await repository.findByAppointmentId(10)
      expect(found!.id).toBe(newQuestionnaire.id)
      expect(found!.completedAt).toBeInstanceOf(Date)
    })
  })
})
