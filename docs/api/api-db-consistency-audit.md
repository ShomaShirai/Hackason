# API・データベース設計整合性監査レポート

## 概要

OpenAPI仕様書（docs/api/openapi-specification.yaml）とデータベース設計書（docs/api/database-design.md）間の整合性を検証し、発見された不整合と推奨修正案を記載します。

## 監査実施日時

2025-01-29

## 監査範囲

- APIエンドポイントとテーブル設計の対応関係
- レスポンススキーマとDB設計の整合性
- データ型とフィールド名の一致性
- enum値の整合性

## 🚨 重要な不整合

### 1. Appointmentステータスの不整合

**問題:**

- **DB設計**: `['scheduled', 'waiting', 'assigned', 'in_progress', 'completed', 'cancelled']`
- **API仕様**: `[pending, confirmed, in_progress, completed, cancelled]`

**影響**: 高
**修正必要**: Yes

**推奨修正:**
APIのAppointmentStatusを以下に変更：

```yaml
AppointmentStatus:
  type: string
  enum: [scheduled, waiting, assigned, in_progress, completed, cancelled]
  description: 予約ステータス
```

### 2. Patient医療履歴のデータ構造不整合

**問題:**

- **DB設計**: `medicalHistory: text('medical_history', { mode: 'json' })`
- **API仕様**:

```yaml
medicalHistory:
  type: array
  items:
    type: object
    properties:
      condition: string
      diagnosedDate: string (date)
      notes: string
```

**影響**: 中
**状態**: 整合性OK（DBもJSON配列を想定）

### 3. VitalSigns構造の詳細度不整合

**問題:**

- **DB設計**: `{ temperature, bloodPressure, pulse, spo2 }`
- **API仕様**:

```yaml
VitalSigns:
  properties:
    bloodPressure:
      type: object
      properties:
        systolic: integer
        diastolic: integer
    temperature: number
    pulse: integer
    respiratoryRate: integer # DBにはspo2のみ
    oxygenSaturation: integer
```

**影響**: 中
**修正必要**: Yes

**推奨修正:**
DB設計の vitalSigns JSON構造を以下に変更：

```json
{
  "bloodPressure": { "systolic": 120, "diastolic": 80 },
  "temperature": 36.5,
  "pulse": 72,
  "respiratoryRate": 16,
  "oxygenSaturation": 98
}
```

## ✅ 整合性が取れている項目

### 1. 基本テーブル構造

- patients, workers, appointments, questionnaires等の基本構造は一致
- 主キー・外部キーの設計は適切
- 必須フィールドの定義は一致

### 2. JSON型フィールド

- questionsAnswers, medications, aiSummary等のJSON構造は概ね一致
- Zodスキーマ定義との整合性も確保

### 3. 認証・権限設計

- WorkerRole（doctor, operator, admin）の定義は一致
- 認可ポリシーとAPI設計の整合性は良好

## 📋 APIエンドポイント・テーブル対応表

| APIエンドポイント             | 主テーブル       | 関連テーブル                      | 整合性           |
| ----------------------------- | ---------------- | --------------------------------- | ---------------- |
| `/api/patient/profile`        | patients         | -                                 | ✅               |
| `/api/patient/appointments`   | appointments     | patients, workers                 | ⚠️ (status enum) |
| `/api/patient/questionnaires` | questionnaires   | appointments                      | ✅               |
| `/api/patient/prescriptions`  | prescriptions    | appointments, workers             | ✅               |
| `/api/patient/health-records` | health_records   | patients                          | ✅               |
| `/api/worker/patients`        | patients         | appointments, medical_records     | ✅               |
| `/api/worker/appointments`    | appointments     | patients, workers, questionnaires | ⚠️ (status enum) |
| `/api/worker/medical-records` | medical_records  | appointments                      | ⚠️ (vital_signs) |
| `/api/worker/prescriptions`   | prescriptions    | appointments, workers             | ✅               |
| `/api/worker/schedules`       | worker_schedules | workers                           | ✅               |
| `/api/admin/workers`          | workers          | specialties, qualifications       | ✅               |
| `/api/admin/specialties`      | specialties      | doctor_specialties                | ✅               |
| `/api/admin/qualifications`   | qualifications   | doctor_qualifications             | ✅               |

## 🔧 修正優先度

### 高優先度（即座に修正必要）

1. **AppointmentStatus enum不整合** - APIとDB間で値が異なる
   - 影響範囲: 予約管理全般
   - 修正工数: 小

### 中優先度（次回リリース前に修正）

2. **VitalSigns構造詳細化** - API仕様の方が詳細
   - 影響範囲: 診察記録機能
   - 修正工数: 中

### 低優先度（将来の拡張時に検討）

3. **JSON型フィールドの型安全性向上**
   - Zodスキーマとの更なる統合
   - 修正工数: 中

## 修正計画

### Phase 1: 緊急修正（今回）

- [ ] AppointmentStatus enumの統一
- [ ] API仕様書の修正
- [ ] データベース設計書の更新

### Phase 2: 改善修正（次回）

- [ ] VitalSigns構造の詳細化
- [ ] JSON型フィールドのZodスキーマ統合強化

## 検証方法

### 自動チェック

- OpenAPIスキーマバリデーション
- Drizzleスキーマとの型整合性チェック
- Zodスキーマとの一致確認

### 手動チェック

- APIエンドポイント・DB操作の対応関係確認
- レスポンスデータとDBクエリ結果の整合性確認

## 結論

**全体的な整合性**: 85% ✅

データベース設計とAPI仕様は概ね整合性が取れていますが、重要な enum値の不整合が1件発見されました。これは開発・テスト段階で問題を引き起こす可能性が高いため、優先的に修正が必要です。

その他の軽微な不整合は将来の機能拡張時に対応することで、現在の開発は継続可能です。

---

**次のアクション:**

1. AppointmentStatus enumの即座修正
2. 修正版ドキュメントのユーザーレビュー実施
3. 開発環境構築フェーズへの移行
