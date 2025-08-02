# 開発Overview

## 概要

本書は、オンライン診療システムの開発に必要な作業項目を、患者向け（User）と医療従事者向け（Worker）に分けて整理したものです。React（フロントエンド）、Hono（バックエンド）、FastAPI（バックエンド代替）の順で記載します。

## 1. React フロントエンド - 患者向け（User）

### 1.1 画面一覧

| 画面ID | 画面名             | URL                                    | 用途                           | 優先度 |
| ------ | ------------------ | -------------------------------------- | ------------------------------ | ------ |
| TOP    | ランディングページ | `/`                                    | サービストップ・役割選択       | 高     |
| S-01   | ログイン画面       | `/login`                               | 患者認証                       | 高     |
| S-02   | ホーム画面         | `/user/`                               | メインメニュー・ナビゲーション | 高     |
| S-03   | 予約作成画面       | `/user/appointments/new`               | 新規予約の作成                 | 高     |
| S-04   | 予約一覧画面       | `/user/appointments`                   | 予約の確認・管理               | 高     |
| S-05   | 事前問診画面       | `/user/appointments/:id/questionnaire` | 事前問診フォーム（AI拡張可能） | 高     |
| S-06   | ビデオ診察画面     | `/user/consultation/:id`               | 患者側のビデオ通話             | 高     |
| S-07   | チャット画面       | `/user/messages`                       | テキストコミュニケーション     | 中     |
| S-08   | 処方箋確認画面     | `/user/prescriptions/:id`              | 処方内容の確認                 | 低     |
| S-09   | 設定画面           | `/user/settings`                       | ユーザー設定                   | 低     |

**ビデオ診察画面の実装:**

```jsx
// /user/consultation/:id では VideoCallComponent を埋め込み
<ConsultationLayout role="patient">
  <VideoCallComponent meetingId={meetingId} attendeeId={attendeeId} role="patient" />
  <ChatSidebar />
</ConsultationLayout>
```

### 1.2 各画面の詳細仕様

#### TOP: ランディングページ

**URL:** `/`

**表示要素:**

- サービス名「ハッカソンオンラインクリニック」（大きく中央に配置）
- サービス説明文（簡潔な紹介）
- 患者向けボタン「患者はこちらへ」→ `/login`
- 医療従事者向けボタン「医師/オペレータはこちらへ」→ `/worker/login`
- ハッカソン情報（開催期間、主催者等）
- 利用規約・プライバシーポリシーリンク

**デザイン:**

- シンプルで清潔感のあるデザイン
- 医療サービスらしい信頼感のある配色
- レスポンシブ対応（スマホ/タブレット/PC）

**実装例:**

```jsx
// components/LandingPage.jsx
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center max-w-4xl mx-auto px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">{t('app.clinicName')}</h1>
        <p className="text-xl text-gray-600 mb-12">{t('app.tagline')}</p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            患者はこちらへ
          </button>

          <button
            onClick={() => navigate('/worker/login')}
            className="px-8 py-4 bg-green-600 text-white rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors"
          >
            医師/オペレータはこちらへ
          </button>
        </div>

        <div className="mt-16 text-sm text-gray-500">
          <p>{t('app.organizer')}</p>
          {t('app.teamName') && (
            <p className="mt-2">
              {t('app.developedBy')}: {t('app.teamName')}
            </p>
          )}
          <div className="mt-4 space-x-4">
            <a href="/terms" className="underline">
              {t('common.terms')}
            </a>
            <a href="/privacy" className="underline">
              {t('common.privacy')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**ハッカソン参加者向けカスタマイズ方法:**

```javascript
// src/locales/ja.json
{
  "app": {
    "clinicName": "ハッカソンオンラインクリニック",  // ← ここにチーム名を入れる
    "tagline": "AIを活用した次世代オンライン診療システム",
    "organizer": "主催: ファストドクター株式会社",
    "teamName": "チームA",  // ← ここにチーム名を設定（省略可）
    "developedBy": "開発チーム"
  },
  "common": {
    "terms": "利用規約",
    "privacy": "プライバシーポリシー"
  },
  "landing": {
    "patientButton": "患者はこちらへ",
    "workerButton": "医師/オペレータはこちらへ"
  }
}
```

**i18n初期設定:**

```javascript
// src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from '../locales/ja.json';

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
  },
  lng: 'ja',
  fallbackLng: 'ja',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

#### S-01: ログイン画面

**URL:** `/login`

**表示要素:**

- ロゴ・アプリケーション名
- メールアドレス入力フィールド
- パスワード入力フィールド
- ログインボタン
- パスワードリセットリンク
- 新規登録リンク
- 医療従事者ログインへのリンク

**API連携:**

- POST /api/user/auth/login

#### S-02: ホーム画面

**URL:** `/user/`

**表示要素:**

- ウェルカムメッセージ
- 本日の予約情報（ある場合）
- 新規予約作成ボタン
- 予約一覧ボタン
- 過去の診察履歴ボタン
- お知らせ・通知

**API連携:**

- GET /api/user/appointments/today
- GET /api/user/notifications

#### S-03: 予約作成画面

**URL:** `/user/appointments/new`

**表示要素:**

- カレンダー（日付選択）
- 時間帯選択
- 症状カテゴリ選択
- 簡単な症状説明テキストエリア
- 予約確定ボタン
- キャンセルボタン

**API連携:**

- GET /api/user/appointments/available-slots
- POST /api/user/appointments

#### S-04: 予約一覧画面

**URL:** `/user/appointments`

**表示要素:**

- 予約リスト（日時、状態）
- フィルター（今後の予約/過去の予約）
- 各予約の状態表示（予約済み/診察中/完了）
- チェックインボタン（診察時間近くで表示）
- キャンセルボタン

**API連携:**

- GET /api/user/appointments
- PUT /api/user/appointments/:id/checkin
- DELETE /api/user/appointments/:id

#### S-05: 事前問診画面

**URL:** `/user/appointments/:id/questionnaire`

**表示要素:**

- 進捗インジケーター
- 質問表示エリア
- 回答入力エリア（テキスト/選択肢/音声）
- 音声入力ボタン
- 次へ/戻るボタン
- 問診完了ボタン

**API連携:**

- GET /api/user/questionnaire/:appointmentId
- POST /api/user/questionnaire/answer
- POST /api/user/questionnaire/audio
- POST /api/user/questionnaire/complete

#### S-06: ビデオ診察画面

**URL:** `/user/consultation/:id`

**表示要素:**

- ローカルビデオ（自分）
- リモートビデオ（医師）
- ミュートボタン
- カメラON/OFFボタン
- 通話終了ボタン
- チャット開閉ボタン
- 接続状態表示

**API連携:**

- POST /api/user/meetings/join
- WebSocket: /ws/user/meeting/:meetingId
- WebSocket: /ws/user/chat/:channelId

#### S-07: チャット画面

**URL:** `/user/messages`

**表示要素:**

- メッセージ履歴
- メッセージ入力フィールド
- 送信ボタン
- タイムスタンプ
- 既読表示

**API連携:**

- GET /api/user/messages/:channelId
- POST /api/user/messages
- WebSocket: /ws/user/chat/:channelId

#### S-08: 処方箋確認画面

**URL:** `/user/prescriptions/:id`

**表示要素:**

- 処方薬リスト
- 用法・用量
- 服用期間
- 注意事項
- 薬局選択（オプション）

**API連携:**

- GET /api/user/prescriptions/:appointmentId
- POST /api/user/prescriptions/:id/send-pharmacy

#### S-09: 設定画面

**URL:** `/user/settings`

**表示要素:**

- プロフィール情報
- 通知設定
- プライバシー設定
- 言語設定
- ログアウトボタン

**API連携:**

- GET /api/user/profile
- PUT /api/user/profile
- POST /api/user/auth/logout

## 2. React フロントエンド - 医療従事者向け（Worker）

### 2.1 画面一覧

| 画面ID | 画面名                   | URL                                       | 用途                        | 優先度 |
| ------ | ------------------------ | ----------------------------------------- | --------------------------- | ------ |
| W-01   | Worker ログイン画面      | `/worker/login`                           | 医師・オペレータ認証        | 高     |
| W-02   | 医師ダッシュボード       | `/worker/doctor/dashboard`                | 医師用ホーム画面            | 高     |
| W-03   | ビデオ診察画面（医師）   | `/worker/doctor/consultation/:id`         | 医師側のビデオ通話          | 高     |
| W-04   | カルテ入力画面           | `/worker/doctor/medical-records/:id/edit` | SOAP形式カルテ入力          | 高     |
| W-05   | 処方入力画面             | `/worker/doctor/prescriptions/:id/edit`   | 処方箋作成                  | 中     |
| W-06   | オペレータダッシュボード | `/worker/operator/dashboard`              | 全体管理・概況把握          | 高     |
| W-07   | 医師差配ボード           | `/worker/operator/assignment-board`       | ドラッグ&ドロップ式患者割当 | 高     |
| W-08   | 医師管理画面             | `/worker/admin/doctors`                   | 医師スケジュール管理        | 中     |
| W-09   | 医師用チャット           | `/worker/doctor/messages`                 | 医師の通信画面              | 中     |
| W-10   | 患者一覧画面             | `/worker/doctor/patients`                 | 担当患者管理                | 中     |
| W-11   | 予約管理画面             | `/worker/operator/appointments`           | 予約の確認・キャンセル      | 中     |

**ビデオ診察画面の実装:**

```jsx
// /worker/doctor/consultation/:id では VideoCallComponent を埋め込み
<ConsultationLayout role="doctor">
  <VideoCallComponent meetingId={meetingId} attendeeId={attendeeId} role="doctor" />
  <PatientInfoPanel />
  <QuickNotesPanel />
  <ChatSidebar />
</ConsultationLayout>
```

### 2.2 各画面の詳細仕様

#### W-01: Worker ログイン画面

**URL:** `/worker/login`

**表示要素:**

- ロゴ・アプリケーション名（医療従事者用）
- 職員ID入力フィールド
- パスワード入力フィールド
- ロール選択（医師/オペレータ/管理者）
- ログインボタン
- セキュリティ通知（「このシステムは医療従事者専用です」）

**API連携:**

- POST /api/worker/auth/login

#### W-02: 医師ダッシュボード

**URL:** `/worker/doctor/dashboard`

**表示要素:**

- 本日の診察予定一覧
- 現在の待機患者数
- 診察開始ボタン
- 予約管理ボタン
- 統計情報（本日の診察数等）

**API連携:**

- GET /api/worker/doctor/appointments/today
- GET /api/worker/doctor/statistics

#### W-03: ビデオ診察画面（医師）

**URL:** `/worker/doctor/consultation/:id`

**表示要素:**

- ローカルビデオ（自分）
- リモートビデオ（患者）
- ミュートボタン
- カメラON/OFFボタン
- 通話終了ボタン
- 画面共有ボタン
- 文字起こし表示エリア（リアルタイム）
- 重要情報ハイライト
- 患者情報パネル
- クイックメモ機能

**API連携:**

- POST /api/worker/meetings/create
- POST /api/worker/meetings/join
- WebSocket: /ws/worker/meeting/:meetingId
- WebSocket: /ws/worker/transcription/:meetingId

#### W-04: カルテ入力画面

**URL:** `/worker/doctor/medical-records/:id/edit`

**表示要素:**

- 患者基本情報表示
- 主観的所見（S）入力エリア
- 客観的所見（O）入力エリア
- 評価（A）入力エリア
- 計画（P）入力エリア
- 音声入力ボタン（将来実装）
- 保存・確定ボタン

**API連携:**

- GET /api/worker/medical-records/:appointmentId
- PUT /api/worker/medical-records/:id
- POST /api/worker/medical-records

#### W-05: 処方入力画面

**URL:** `/worker/doctor/prescriptions/:id/edit`

**表示要素:**

- 診断情報表示
- 薬剤検索・選択
- 用法・用量入力
- 服用期間設定
- 禁忌・相互作用警告表示
- 処方箋確定ボタン

**API連携:**

- GET /api/worker/medications/search
- POST /api/worker/prescriptions
- PUT /api/worker/prescriptions/:id

#### W-06: オペレータダッシュボード

**URL:** `/worker/operator/dashboard`

**表示要素:**

- リアルタイム状況（待機患者数、診察中数、待機医師数）
- 医師稼働状況一覧（オンライン/オフライン、現在の診察状況）
- 患者待機リスト（待ち時間、症状カテゴリ）
- アラート表示（長時間待機、緊急案件）
- 医師差配ボタン（→ W-07へ遷移）
- 統計グラフ（時間帯別患者数、平均待ち時間）

**API連携:**

- GET /api/worker/operator/dashboard
- GET /api/worker/operator/realtime-status
- WebSocket: /ws/worker/operator/dashboard

#### W-07: 医師差配ボード

**URL:** `/worker/operator/assignment-board`

**表示要素:**

- 日付選択・ナビゲーション
- 待機患者リスト（カード形式、待ち時間・症状・優先度表示）
- 医師カラム（横列、ステータス・専門分野表示）
- タイムスロット（30分単位、ドロップ可能エリア）
- 診察中/完了済み患者カード
- ドラッグ中のビジュアルフィードバック

**操作:**

- 患者カードのドラッグ&ドロップ
- 時間枠間での患者移動
- 右クリックメニュー（詳細表示、キャンセル等）
- フィルター（診療科、優先度、同伴者有無）
- ソート（待ち時間、優先度）

**API連携:**

- GET /api/worker/operator/assignment-board
- POST /api/worker/operator/assign-doctor
- PUT /api/worker/appointments/:id/priority
- WebSocket: /ws/worker/operator/assignment-board/:date

#### W-08: 医師管理画面

**URL:** `/worker/admin/doctors`

**表示要素:**

- 医師一覧（名前、専門、状態、本日の診察数）
- スケジュール管理カレンダー
- 休暇申請一覧
- パフォーマンス統計（平均診察時間、患者満足度）

**API連携:**

- GET /api/worker/admin/doctors
- PUT /api/worker/admin/doctors/:id/schedule
- POST /api/worker/admin/doctors/:id/leave

#### W-09: 医師用チャット

**URL:** `/worker/doctor/messages`

**表示要素:**

- チャンネルリスト（患者別、チーム別）
- メッセージ履歴
- メッセージ入力
- ファイル添付機能
- 重要マーク機能

**API連携:**

- GET /api/worker/messages
- POST /api/worker/messages
- WebSocket: /ws/worker/chat/:channelId

#### W-10: 患者一覧画面

**URL:** `/worker/doctor/patients`

**表示要素:**

- 担当患者リスト
- 検索・フィルター機能
- 患者詳細情報
- 診察履歴
- 次回予約情報

**API連携:**

- GET /api/worker/doctor/patients
- GET /api/worker/doctor/patients/:id

#### W-11: 予約管理画面

**URL:** `/worker/operator/appointments`

**表示要素:**

- 全予約リスト（日付・時刻・患者名・医師名）
- フィルター（日付・状態・医師・患者）
- 予約状態表示（予約済み/診察中/完了/キャンセル）
- 予約キャンセルボタン
- 予約変更ボタン

**操作:**

- 予約のキャンセル（理由入力必須）
- 予約時間の変更
- 担当医師の変更

**API連携:**

- GET /api/worker/operator/appointments
- DELETE /api/worker/appointments/:id
- PUT /api/worker/appointments/:id

#### W-12: 患者マスタ管理画面（管理者）

**URL:** `/worker/admin/patients`

**表示要素:**

- 患者一覧テーブル
  - ID、氏名、メールアドレス、電話番号、生年月日、性別
  - 登録日時、最終ログイン日時
  - ステータス（有効/無効）
- 検索・フィルター機能
  - 氏名検索
  - メールアドレス検索
  - 登録日範囲
- アクション
  - 詳細表示ボタン
  - 編集ボタン
  - ステータス変更ボタン
  - パスワードリセットボタン
- ページネーション
- CSVエクスポート機能

**操作:**

- 患者情報の閲覧・編集
- アカウントの有効化・無効化
- パスワードリセット（リセットリンク送信）
- 検索結果のCSVエクスポート

**API連携:**

- GET /api/admin/patients
- GET /api/admin/patients/:id
- PUT /api/admin/patients/:id
- POST /api/admin/patients/:id/reset-password
- GET /api/admin/patients/export

#### W-13: 医師マスタ管理画面（管理者）

**URL:** `/worker/admin/doctors`

**表示要素:**

- 医師一覧テーブル
  - ID、氏名、メールアドレス、電話番号
  - 医療免許番号、専門科、資格
  - ロール（医師/オペレータ/管理者）
  - ステータス（有効/無効）
- 検索・フィルター機能
  - 氏名検索
  - 専門科フィルター
  - 資格フィルター
  - ロールフィルター
- アクション
  - 新規登録ボタン
  - 詳細表示ボタン
  - 編集ボタン
  - ステータス変更ボタン
  - 専門科・資格編集ボタン
- 専門科・資格管理
  - 複数選択可能なチェックボックス
  - 資格証明書アップロード機能
- ページネーション

**操作:**

- 医療従事者の新規登録
- 基本情報の編集
- 専門科・資格の追加・削除
- ロール変更（権限管理）
- アカウントの有効化・無効化

**API連携:**

- GET /api/admin/workers
- GET /api/admin/workers/:id
- POST /api/admin/workers
- PUT /api/admin/workers/:id
- DELETE /api/admin/workers/:id
- PUT /api/admin/workers/:id/specialties
- PUT /api/admin/workers/:id/qualifications

## 3. 共通コンポーネント

| コンポーネントID | コンポーネント名   | 用途                       |
| ---------------- | ------------------ | -------------------------- |
| C-01             | ヘッダー           | ナビゲーション・ロゴ表示   |
| C-02             | ローディング       | 読み込み中表示             |
| C-03             | エラーメッセージ   | エラー表示                 |
| C-04             | モーダル           | ダイアログ表示             |
| C-05             | 通知バッジ         | 未読通知数表示             |
| C-06             | VideoCallComponent | Amazon Chime SDKビデオ通話 |
| C-07             | ドラッグ可能カード | 患者情報カード（DnD対応）  |
| C-08             | タイムスロット     | 時間枠コンポーネント       |

## 4. ルーティング構成

```typescript
// React Router v6 設定例
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // 公開ルート
      { index: true, element: <LandingPage /> },
      { path: "login", element: <PatientLoginPage /> },
      { path: "worker/login", element: <WorkerLoginPage /> },

      // 患者向けルート（認証必須）
      {
        path: "user",
        element: <RequireAuth role="patient" />,
        children: [
          { index: true, element: <PatientHomePage /> },
          { path: "appointments", element: <AppointmentListPage /> },
          { path: "appointments/new", element: <NewAppointmentPage /> },
          { path: "appointments/:id/questionnaire", element: <QuestionnairePage /> },
          { path: "consultation/:id", element: <PatientConsultationPage /> },
          { path: "prescriptions/:id", element: <PrescriptionViewPage /> },
          { path: "messages", element: <PatientMessagesPage /> },
          { path: "settings", element: <PatientSettingsPage /> },
        ],
      },

      // 医療従事者向けルート（認証必須）
      {
        path: "worker",
        element: <RequireAuth role={["doctor", "operator", "admin"]} />,
        children: [
          // 医師向け
          {
            path: "doctor",
            element: <RequireRole role="doctor" />,
            children: [
              { path: "dashboard", element: <DoctorDashboardPage /> },
              { path: "consultation/:id", element: <DoctorConsultationPage /> },
              { path: "medical-records/:id/edit", element: <MedicalRecordEditPage /> },
              { path: "prescriptions/:id/edit", element: <PrescriptionEditPage /> },
              { path: "messages", element: <DoctorMessagesPage /> },
              { path: "patients", element: <PatientListPage /> },
            ],
          },
          // オペレータ向け
          {
            path: "operator",
            element: <RequireRole role="operator" />,
            children: [
              { path: "dashboard", element: <OperatorDashboardPage /> },
              { path: "assignment-board", element: <AssignmentBoardPage /> },
              { path: "appointments", element: <AppointmentManagementPage /> },
            ],
          },
          // 管理者向け
          {
            path: "admin",
            element: <RequireRole role="admin" />,
            children: [
              { path: "doctors", element: <DoctorManagementPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
```

## 5. Hono バックエンド - 患者向けAPI（User）

### 5.1 エンドポイント一覧

#### 認証系

```typescript
POST / api / user / auth / login; // ログイン
POST / api / user / auth / logout; // ログアウト
POST / api / user / auth / refresh; // トークンリフレッシュ
POST / api / user / auth / register; // 新規登録
POST / api / user / auth / reset - password; // パスワードリセット
```

#### 予約管理系

```typescript
GET    /api/user/appointments                    // 予約一覧取得
POST   /api/user/appointments                    // 予約作成
GET    /api/user/appointments/:id                // 予約詳細取得
PUT    /api/user/appointments/:id                // 予約更新
DELETE /api/user/appointments/:id                // 予約キャンセル
PUT    /api/user/appointments/:id/checkin        // チェックイン
GET    /api/user/appointments/available-slots    // 利用可能時間帯取得
GET    /api/user/appointments/today              // 本日の予約取得
```

#### 問診系

```typescript
GET    /api/user/questionnaire/:appointmentId    // 問診質問取得
POST   /api/user/questionnaire/answer            // 回答送信
POST   /api/user/questionnaire/audio             // 音声回答送信
POST   /api/user/questionnaire/complete          // 問診完了
```

#### ビデオ通話系

```typescript
POST   /api/user/meetings/join                   // ミーティング参加
GET    /api/user/meetings/:id/status             // ミーティング状態取得
```

#### メッセージ系

```typescript
GET    /api/user/messages/:channelId             // メッセージ履歴取得
POST   /api/user/messages                        // メッセージ送信
PUT    /api/user/messages/:id/read               // 既読にする
```

#### 処方系

```typescript
GET    /api/user/prescriptions/:appointmentId    // 処方箋取得
POST   /api/user/prescriptions/:id/send-pharmacy // 薬局送信
```

#### ユーザー系

```typescript
GET    /api/user/profile                         // プロフィール取得
PUT    /api/user/profile                         // プロフィール更新
GET    /api/user/notifications                   // 通知取得
PUT    /api/user/notifications/:id/read          // 通知既読
```

#### WebSocket

```typescript
WS     /ws/user/meeting/:meetingId               // ビデオ通話シグナリング
WS     /ws/user/chat/:channelId                  // チャット
```

## 6. Hono バックエンド - 医療従事者向けAPI（Worker）

### 6.1 エンドポイント一覧

#### 認証系

```typescript
POST / api / worker / auth / login; // Worker ログイン
POST / api / worker / auth / logout; // ログアウト
POST / api / worker / auth / refresh; // トークンリフレッシュ
```

#### 医師向け - 診察系

```typescript
GET    /api/worker/doctor/appointments/today     // 本日の診察予定
GET    /api/worker/doctor/appointments           // 診察予定一覧
GET    /api/worker/doctor/statistics             // 統計情報取得
POST   /api/worker/meetings/create               // ミーティング作成
POST   /api/worker/meetings/join                 // ミーティング参加
POST   /api/worker/meetings/:id/end              // ミーティング終了
```

#### 医師向け - カルテ系

```typescript
GET    /api/worker/medical-records/:appointmentId // カルテ取得
POST   /api/worker/medical-records                // カルテ作成
PUT    /api/worker/medical-records/:id            // カルテ更新
```

#### 医師向け - 処方系

```typescript
GET    /api/worker/medications/search             // 薬剤検索
POST   /api/worker/prescriptions                  // 処方箋作成
PUT    /api/worker/prescriptions/:id              // 処方箋更新
```

#### 医師向け - 患者管理系

```typescript
GET    /api/worker/doctor/patients               // 担当患者一覧
GET    /api/worker/doctor/patients/:id           // 患者詳細取得
GET    /api/worker/doctor/patients/:id/history   // 患者診察履歴
```

#### オペレータ向け

```typescript
GET    /api/worker/operator/dashboard            // ダッシュボード情報取得
GET    /api/worker/operator/realtime-status      // リアルタイム状況取得
GET    /api/worker/operator/assignment-board     // 差配ボード情報取得
POST   /api/worker/operator/assign-doctor        // 医師手動差配
PUT    /api/worker/appointments/:id/priority     // 優先順位変更
GET    /api/worker/operator/waiting-patients     // 待機患者リスト取得
POST   /api/worker/operator/emergency-flag       // 緊急フラグ設定
GET    /api/worker/operator/appointments         // 全予約一覧取得
DELETE /api/worker/appointments/:id              // 予約キャンセル（Worker側）
PUT    /api/worker/appointments/:id              // 予約変更（Worker側）
```

#### 管理者向け

```typescript
GET    /api/worker/admin/doctors                 // 医師一覧取得
GET    /api/worker/admin/doctors/:id             // 医師詳細取得
PUT    /api/worker/admin/doctors/:id/schedule    // スケジュール更新
POST   /api/worker/admin/doctors/:id/leave       // 休暇申請処理
GET    /api/worker/admin/doctors/:id/performance // パフォーマンス統計取得
```

#### メッセージ系

```typescript
GET    /api/worker/messages                      // メッセージ一覧
POST   /api/worker/messages                      // メッセージ送信
GET    /api/worker/messages/:channelId          // チャンネルメッセージ取得
```

#### WebSocket

```typescript
WS     /ws/worker/meeting/:meetingId             // ビデオ通話シグナリング
WS     /ws/worker/transcription/:meetingId       // リアルタイム文字起こし
WS     /ws/worker/chat/:channelId                // チャット
WS     /ws/worker/operator/dashboard             // オペレータダッシュボード更新
WS     /ws/worker/operator/assignment-board/:date // 差配ボードリアルタイム更新
```

## 7. FastAPI バックエンド（Python実装）

### 7.1 患者向けAPI（User）

```python
# 認証系
@app.post("/api/user/auth/login")
@app.post("/api/user/auth/logout")
@app.post("/api/user/auth/refresh")
@app.post("/api/user/auth/register")

# 予約管理系
@app.get("/api/user/appointments")
@app.post("/api/user/appointments")
@app.get("/api/user/appointments/{id}")
@app.put("/api/user/appointments/{id}")
@app.delete("/api/user/appointments/{id}")
@app.put("/api/user/appointments/{id}/checkin")
@app.get("/api/user/appointments/available-slots")
@app.get("/api/user/appointments/today")

# 問診系
@app.get("/api/user/questionnaire/{appointment_id}")
@app.post("/api/user/questionnaire/answer")
@app.post("/api/user/questionnaire/audio")
@app.post("/api/user/questionnaire/complete")

# WebSocket
@app.websocket("/ws/user/meeting/{meeting_id}")
@app.websocket("/ws/user/chat/{channel_id}")
```

### 7.2 医療従事者向けAPI（Worker）

```python
# 認証系
@app.post("/api/worker/auth/login")
@app.post("/api/worker/auth/logout")
@app.post("/api/worker/auth/refresh")

# 医師向け
@app.get("/api/worker/doctor/appointments/today")
@app.get("/api/worker/doctor/appointments")
@app.get("/api/worker/doctor/statistics")
@app.get("/api/worker/doctor/patients")
@app.get("/api/worker/doctor/patients/{id}")

# カルテ系
@app.get("/api/worker/medical-records/{appointment_id}")
@app.post("/api/worker/medical-records")
@app.put("/api/worker/medical-records/{id}")

# 処方系
@app.get("/api/worker/medications/search")
@app.post("/api/worker/prescriptions")
@app.put("/api/worker/prescriptions/{id}")

# オペレータ向け
@app.get("/api/worker/operator/dashboard")
@app.get("/api/worker/operator/assignment-board")
@app.post("/api/worker/operator/assign-doctor")
@app.get("/api/worker/operator/appointments")
@app.delete("/api/worker/appointments/{id}")
@app.put("/api/worker/appointments/{id}")

# WebSocket
@app.websocket("/ws/worker/meeting/{meeting_id}")
@app.websocket("/ws/worker/transcription/{meeting_id}")
@app.websocket("/ws/worker/operator/dashboard")
```

## 8. 開発優先順位

### Phase 1: ベースライン必須実装（ハッカソン前）

1. 認証システム（User/Worker両対応）
2. 患者向け：ログイン画面・ホーム画面・予約一覧画面
3. Worker向け：ログイン画面・医師ダッシュボード・オペレータダッシュボード
4. ビデオ診察画面（User/Worker両対応）・WebRTC実装
5. 音声ストリーム取得機能（基本的な音声データ取得）
6. カルテ入力画面（医師による手動入力）
7. 医師差配ボード（手動差配）

### Phase 2: ベースライン推奨実装（ハッカソン前）

1. 基本的な予約作成機能
2. 事前問診フォーム（静的な質問形式）
3. 処方箋入力画面（手動入力）
4. チャット機能（基本的なテキスト送受信）
5. 医師管理画面（スケジュール手動管理）

### Phase 3: ハッカソン参加者による拡張想定

1. AI問診（動的質問生成、音声入力対応）
2. リアルタイム文字起こし・自動カルテ生成
3. 診察サマリー自動生成
4. 医療エンティティ抽出・ハイライト
5. AIによる医師自動マッチング
6. 高度な統計・分析機能

## 9. 技術的考慮事項

### アーキテクチャパターン

#### PatientContextパターンの採用

- 診察データへの統一されたアクセス方式
- フロントエンド（React Context）とバックエンド（Service Layer）で共通インターフェース
- 患者情報収集（既往歴、アレルギー、現在症状等）
- AIサマリー、医療エンティティ抽出、文字起こし連携

### UIライブラリ戦略

#### shadcn/uiを第1選択肢として採用

- コピー&ペースト方式でライブラリ依存を最小化
- Tailwind CSS + Radix UI基盤でアクセシビリティ標準対応
- TypeScript完全対応で型安全性確保
- Amazon Chime SDKはビデオ通話専用として分離

### データベース

- **ORM**: Drizzle ORM
  - 軽量で高速、エッジランタイム対応
  - TypeScript完全対応で型安全性確保
  - SQLiteとCloudflare D1の両方に対応
- **開発環境**: SQLite（better-sqlite3）
- **本番環境**: Cloudflare D1（SQLite互換）

### セキュリティ

- JWT認証の実装（User/Worker別トークン）
- HTTPS必須
- CORS設定（User/Worker別オリジン）
- 医療データの暗号化
- ロールベースアクセス制御（RBAC）

### 認証・ユーザー管理

- **患者（User）**: `patient` テーブルでログイン情報を管理
  - メールアドレス/パスワードによる認証
  - 患者専用の認証トークン発行
- **医療従事者（Worker）**: `worker` テーブルでログイン情報を管理
  - 職員ID/パスワードによる認証
  - ロール（doctor/operator/admin）別の権限管理
  - Worker専用の認証トークン発行

### パフォーマンス

- WebSocket接続の管理
- 音声ストリームの効率的な処理
- フロントエンドの遅延ローディング
- APIレスポンスのキャッシュ戦略

### スケーラビリティ

- ステートレスな設計
- 水平スケーリング対応
- キャッシュの活用
- マイクロサービス化の考慮

## まとめ

本開発Overviewは、患者向け（User）と医療従事者向け（Worker）を明確に分離し、それぞれに最適化されたUI/UXとAPIを提供します。URLパスの統一的な命名規則により、開発者は直感的にシステム構造を理解できます。React画面とAPIエンドポイントは1対1で対応しており、開発者は明確な仕様に基づいて実装を進めることができます。
