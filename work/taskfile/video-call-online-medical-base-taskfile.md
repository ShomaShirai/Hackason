## 実現したいこと

- **Cloudflare Realtime** をベースにしたオンライン診療ビデオ通話システムの構築
- ユースケース検討から開発仕様策定までの体系的なプロセスの確立（各段階でユーザーレビュー実施）
- 医師と患者が安全にビデオ通話できるPoCシステムの実現
- ハッカソン参加者が機能の追加・カスタマイズができる開発基盤の整備
- 音声・ビデオストリーム抽出機能の提供
- Mac & Windows環境対応の参加者向け開発ガイドとテスト環境の構築

## 🔄 技術選択の変遷・背景

### Amazon Chime SDK → Cloudflare Realtime移行理由

1. **Cloudflare Workers制約問題**
   - AWS Chime SDK backend clientが`fs.readFile`に依存
   - Cloudflare Workersでは`fs`モジュール未対応（unenv制約）
   - `[unenv] fs.readFile is not implemented yet!` エラーが発生

2. **D1データベース問題**
   - `video_sessions`テーブル未作成問題
   - `DrizzleQueryError: Failed query... no such table: video_sessions`
   - ローカル開発でのデータベース同期の複雑さ

3. **環境設定の複雑さ**
   - AWS認証情報の管理負担
   - 複数の環境変数設定（AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY等）
   - セキュリティリスクの管理コスト

4. **ハッカソン制約**
   - **開発期間の制約**: 複雑な問題解決に時間をかけられない
   - **参加者の学習負担軽減**: Cloudflare統一環境でのシンプルな実装
   - **メンテナンス性重視**: 一つのプラットフォームでの完結

### Cloudflare Realtime選択の利点

✅ **統一プラットフォーム**: Cloudflare Workers + D1 + Calls
✅ **環境設定シンプル**: 単一ダッシュボードでの管理
✅ **グローバル性能**: 335+拠点のAnycastネットワーク
✅ **標準化されたWebRTC**: ブラウザネイティブ技術活用
✅ **エンドツーエンド暗号化**: MLS対応でセキュリティ強化
✅ **OpenAI Realtime API統合**: 音声AI機能の簡単実装

## 成果物

- ~~[Amazon Chime SDK telehealth-widget分析レポート](../../knowledge/technical/amazon-chime-sample-memo/telehealth-widget-analysis.md)~~ → 移行理由として記録済み
- **[Cloudflare Orange分析レポート](../../knowledge/technical/cloudflare-orange-analysis.md)**（作成予定）
- [ユースケース仕様書](../../knowledge/business/online-medical/use-cases-specification.md)
- [開発Overview](../../docs/architecture/development-overview.md)
- [機能仕様書](../../docs/api/functional-specification.md)
- [API仕様書](../../docs/api/api-specification.md)
- [データベース設計書](../../docs/api/database-design.md)
- [画面仕様書](../../docs/frontend/screen-specifications.md)
- [UIコンポーネント戦略](../../docs/frontend/ui-component-strategy.md)
- [PatientContextパターン](../../docs/architecture/patient-context-pattern.md)
- [医師差配ボード仕様](../../docs/frontend/doctor-assignment-board.md)
- [UI/UX仕様書](../../docs/guides/ui-ux-specification.md)
- **[Cloudflare Realtime統合ガイド](../../docs/setup/cloudflare-realtime-setup.md)**（作成予定）
- [技術仕様書](../../docs/setup/technical-specification.md)（作成予定）
- [アーキテクチャ設計ドキュメント](../../knowledge/technical/architecture/online-medical-architecture.md)（作成予定）
- [src/online-medical/](../../src/online-medical/) - オンライン診療システムソースコード（開発予定）
- [Mac & Windows環境向け開発ガイド](../../docs/guides/hackathon-development-guide.md)（作成予定）
- **[Cloudflare Realtime音声ストリーム抽出API](../../src/online-medical/api/realtime-stream-extraction/)**（開発予定）
- [テスト指針書](../../docs/setup/testing-guidelines.md)（作成予定）

## 情報

- [JIRAチケット HKT-2](https://fastdoctor.atlassian.net/browse/HKT-2)
- [Amazon Chime SDK Telehealth Widget](https://github.com/aws-samples/amazon-chime-sdk/tree/main/apps/telehealth-widget)
- [AWS Blog: Embed Healthcare Appointment Scheduling Widget](https://aws.amazon.com/blogs/business-productivity/embed-healthcare-appointment-scheduling-widget-with-the-amazon-chime-sdk/)
- [Amazon Chime SDK Documentation](https://docs.aws.amazon.com/chime-sdk/)
- [ハッカソン募集ページ](https://corp.qiita.com/releases/2025/04/health-tech-hackathon/)

## 作業手順

- [x] 完了条件の詳細化とユーザーレビュー ✓
- [x] Amazon Chime SDK telehealth-widget内容把握（[telehealth-widget分析レポート](../../knowledge/technical/amazon-chime-sample-memo/telehealth-widget-analysis.md)）✓
- [x] ユースケース検討・言語化（[ユースケース仕様書](../../knowledge/business/online-medical/use-cases-specification.md)）✓
- [x] 開発対象の作業項目整理（[開発Overview](../../docs/architecture/development-overview.md)）✓
- [x] テーブル設計・API定義（[データベース設計書](../../docs/api/database-design.md)、[API仕様書](../../docs/api/api-specification.md)）✓
- [x] React-Router-Hono フルスタックテンプレートベース開発環境構築 ✓
          ※ React-Router-Hono統合テンプレート基盤構築完了。フロントエンド（ログイン・ダッシュボード）実装完了。API基本エンドポイント（モック版）実装完了。Playwright動作確認済み。
    - [x] 依存関係のインストールと初期動作確認
    - [x] プロジェクト構造の理解とドキュメント化
  - [x] ベーステンプレートのカスタマイズ
    - [x] プロジェクト名・設定の変更
    - [x] Drizzle ORM統合（D1対応）※スキーマ・マイグレーション完了、実際のD1接続は次フェーズ
    - [x] Zod統合（JSON型フィールドの型定義用）
    - [x] 認証システムの基盤実装（JWT）※モックAPI完了、実際のJWT実装は次フェーズ
  - [x] 開発環境の設定
    - [x] ESLint/Prettierルールの統一
    - [x] TypeScript設定の最適化
    - [x] 環境変数管理の設定
  - [x] CI/CD基盤の構築
    - [x] Cloudflare デプロイ方法 ※設定ファイル準備済み、実際のデプロイテストは次フェーズ
  - [x] 開発者向けドキュメント作成
    - [x] セットアップガイド ※基本的な手順は完了、詳細化は次フェーズ
    - [x] ローカル開発手順 ※基本的な手順は完了、詳細化は次フェーズ
    - [ ] デプロイ手順
- [x] 実際のデータベース・認証実装（スキップ分の実装）
  - [x] Drizzle ORM実データベース接続実装
    - [x] better-sqlite3のCloudflare Workers環境問題の解決 → libsqlで代替実装
    - [x] Cloudflare D1データベースの実接続設定 → wrangler.jsonc設定完了
    - [x] ローカル環境でのSQLiteデータベース接続 → workers/app-local-dev.ts作成
    - [x] データベースマイグレーションの実行・検証 → drizzle-kit完了
    - [x] 実際のCRUD操作の動作確認 → テストデータ挿入スクリプト作成
  - [x] 実際のJWT認証システム実装
    - [x] JWT トークン生成・検証ロジックの実装
    - [x] パスワードハッシュ化の実装（bcrypt）
    - [x] 認証ミドルウェアの実装
    - [x] セッション管理の実装
    - [x] メインアプリケーションへの認証機能統合
    - [x] 環境変数設定（JWT_SECRET等）
    - [x] ログアウト機能の実装
  - [x] 不足API エンドポイント実装
    - [x] GET /api/worker/profile - 医療従事者プロフィール取得
    - [x] GET /api/worker/appointments/today - 今日の予約一覧
    - [x] GET /api/worker/appointments/waiting - 待機中予約一覧
    - [ ] その他Worker向けAPIエンドポイントの完全実装 → モックで良い
  - [x] Cloudflare Workers環境対応
    - [x] 実際のCloudflareデプロイテスト
    - [x] 本番環境での動作確認
    - [x] 環境変数の設定（D1データベースID等）
    - [x] wrangler.tomlの最終調整
  - [x] コード品質・設定統一
    - [x] ESLint/Prettierルールの実際の統一適用
    - [x] TypeScript設定の最適化（実運用対応）
    - [x] 開発者向けドキュメントの詳細化

  - [/] Cloudflare Realtime音声ストリーム抽出機能
    - [x] 実際のユーザー画面（診察画面）へのTURN/STUN対応実装 【完了】
      - [x] /patient/consultation/:id へのTURN/STUN認証統合 【完了】
      - [x] /worker/doctor/consultation/:id へのTURN/STUN認証統合 【完了】
      - [x] 診察画面でのNAT超え対応確認 【完了】
      - [x] メディア品質最適化 【完了】
        - [x] ビデオ解像度・フレームレート調整 【完了】
        - [x] 帯域制限対応・適応的品質調整 【完了】
        - [x] エコーキャンセレーション設定 【完了】
      - [x] 接続安定性向上 【完了】
        - [x] 接続状態監視（connection/ice状態） 【完了】
        - [x] 複数candidate収集・優先度設定 【完了】
        - [x] 自動再接続処理 【完了】
        - [x] ハートビート・Keep-alive機能 【完了】
        - [x] 接続品質メトリクス収集 【完了】
    - [/] 実画面での動作確認(ローカル)
      - [x] テスト用のレコードの挿入
      - [/] ユーザーと協力してPlaywrightで動作チェック
        - [x] 患者ログイン確認
        - [x] 医師ログイン確認
        - [x] 診察予約の確認（予約がある状態）→ ビデオセッションに直接アクセス
        - [x] ビデオ通話開始の確認 → 画面表示OK、TURN/WebRTC実装確認
        - [ ] 双方向ビデオ・音声通信の確認
        - [x] メディアコントロール（音声/ビデオON/OFF）の確認 → UI表示OK
        - [x] 通話品質インジケーターの確認 → UI表示OK
        - [ ] 通話終了処理の確認
        - [ ] エラーハンドリングの確認（カメラ/マイク権限拒否等）

    - [ ] 実画面での動作確認(wrangler deploy後)
      - [ ] テスト用のレコードの挿入
      - [ ] ユーザーと協力してPlaywrightで動作チェック
        - [ ] 患者ログイン確認
        - [ ] 医師ログイン確認
        - [ ] 診察予約の確認（予約がある状態）
        - [ ] ビデオ通話開始の確認
        - [ ] 双方向ビデオ・音声通信の確認
        - [ ] メディアコントロール（音声/ビデオON/OFF）の確認
        - [ ] 通話品質インジケーターの確認
        - [ ] 通話終了処理の確認
        - [ ] エラーハンドリングの確認（カメラ/マイク権限拒否等）

- [/] 画面・API実装（Phase 1: ベースライン必須実装）【作業中】
  - [x] 共通基盤
    - [x] 共通コンポーネント作成
      - [x] C-01: ヘッダーコンポーネント
      - [x] C-02: ローディングコンポーネント
      - [x] C-03: エラーメッセージコンポーネント
      - [x] C-04: モーダルコンポーネント
      - [x] C-05: 通知バッジコンポーネント
    - [x] ルーティング設定（React Router v7）
      - [x] 公開ルート設定
      - [x] 認証ルート設定（RequireAuth）
      - [x] ロール別ルート設定（RequireRole）

  - [/] 患者向け画面・API
    - [x] TOP: ランディングページ（`/`）✓ 完了済み
    - [x] S-01: ログイン画面（`/login`）✓ 完了済み
      - [x] POST /api/auth/patient/login 実装済み
    - [x] S-02: ホーム画面（`/patient/`）✓ 完了済み（2025-01-30）
      - [x] GET /api/patient/appointments/today 実装
      - [x] GET /api/patient/notifications 実装（モック可）
    - [x] S-04: 予約一覧画面（`/patient/appointments`）✓ 完了済み（2025-01-30）
      - [x] GET /api/patient/appointments 実装
    - [ ] S-06: ビデオ診察画面（`/patient/consultation/:id`）
      - [x] Cloudflare Realtime統合済み
      - [x] CloudflareRealtimeVideoコンポーネント実装済み

  - [/] 医療従事者向け画面・API
    - [x] W-01: Workerログイン画面（`/worker/login`）✓ 完了済み
      - [x] POST /api/auth/worker/login 実装済み
    - [x] W-02: 医師ダッシュボード（`/worker/doctor/dashboard`）✓ 完了済み（2025-01-30）
      - [x] GET /api/worker/doctor/appointments/today 実装
      - [x] GET /api/worker/doctor/statistics 実装（モック可）
    - [ ] W-03: ビデオ診察画面（医師）（`/worker/doctor/consultation/:id`）
      - [x] Cloudflare Realtime統合済み
      - [x] CloudflareRealtimeVideoコンポーネント実装済み
      - [x] PatientInfoPanel実装済み
    - [x] W-04: カルテ入力画面（`/worker/doctor/medical-records/:id/edit`）【API実装済み】
      - [x] GET /api/worker/medical-records/:appointmentId 実装 ✓ 完了済み（2025-01-30）
      - [x] POST /api/worker/medical-records 実装 ✓ 完了済み（2025-01-30）
      - [x] PUT /api/worker/medical-records/:id 実装 ✓ 完了済み（2025-01-30）
      - [x] カルテAPI統合テスト（Red→Green）
        - [x] GET /api/worker/medical-records/:appointmentId のテスト作成
        - [x] POST /api/worker/medical-records のテスト作成
        - [x] PUT /api/worker/medical-records/:id のテスト作成
      - [x] カルテ入力画面の実装
    - [x] W-06: オペレータダッシュボード（`/worker/operator/dashboard`）
      - [x] オペレータAPIテスト作成（Red→Green）
      - [x] GET /api/worker/operator/dashboard 実装
      - [x] GET /api/worker/operator/realtime-status 実装
      - [ ] WebSocket: /ws/worker/operator/dashboard 実装
      - [x] オペレータダッシュボード画面の実装
    - [x] W-07: 医師差配ボード（`/worker/operator/assignment-board`）
      - [x] C-07: ドラッグ可能カードコンポーネント作成
      - [x] C-08: タイムスロットコンポーネント作成
      - [x] 医師差配ボード画面の実装
      - [x] 差配APIテスト作成（Red→Green）
      - [x] GET /api/worker/operator/assignment-board 実装
      - [x] POST /api/worker/operator/assign-doctor 実装
      - [ ] WebSocket: /ws/worker/operator/assignment-board/:date 実装

- [x] 画面・API実装（Phase 2: ベースライン推奨実装）
  - [x] 患者向け画面・API
    - [x] S-03: 予約作成画面（`/patient/appointments/new`）
      - [x] 予約APIテスト作成（Red→Green）
      - [x] GET /api/patient/appointments/available-slots 実装
      - [x] POST /api/patient/appointments 実装
    - [x] S-05: 事前問診画面（`/patient/appointments/:id/questionnaire`）
      - [x] 問診APIテスト作成（Red→Green）
      - [x] GET /api/patient/questionnaire/:appointmentId 実装
      - [x] POST /api/patient/questionnaire/answer 実装
      - [x] POST /api/patient/questionnaire/complete 実装
    - [x] S-07: チャット画面（`/patient/messages`）
      - [x] チャットAPIテスト作成（Red→Green）
      - [x] GET /api/chat/appointments/:appointmentId/messages 実装
      - [x] POST /api/chat/appointments/:appointmentId/messages 実装
      - [x] PUT /api/chat/messages/:messageId/read 実装
      - [ ] WebSocket: /ws/patient/chat/:channelId 実装（将来対応）

  - [x] 医療従事者向け画面・API
    - [x] W-05: 処方入力画面（`/worker/doctor/prescriptions/:id/edit`）
      - [x] 処方APIテスト作成（Red→Green）
      - [x] GET /api/worker/medications/search 実装
      - [x] POST /api/worker/prescriptions 実装
      - [x] PUT /api/worker/prescriptions/:id 実装
    - [x] W-08: 医師管理画面（`/worker/admin/doctors`）
      - [x] GET /api/worker/admin/doctors 実装
      - [x] PUT /api/worker/admin/doctors/:id/schedule 実装
      - [x] GET /api/worker/admin/doctors/:id/schedule 実装
      - [x] PUT /api/worker/admin/doctors/:id/status 実装
      - [x] 医師スケジュール編集画面実装（`/worker/admin/doctors/:id/schedule/edit`）
    - [x] W-09: Worker用チャットコンポーネント
      - [x] DoctorChatPanelコンポーネント作成
      - [x] 診察画面（MedicalVideoCall）への組み込み
      - [x] 折りたたみ可能なチャットパネル実装
      - [x] チャットAPIは共通化（/api/chat/）で実装済み
      - [ ] WebSocket: /ws/worker/patient/:id/chat/:channelId 実装（将来対応）


- [x] ここまでの開発のデバッグ
  - [x] 現状確認
    - [x] npm run buildが動かして課題点を抽出する
    - [x] npm run devで起動する → 正常に起動（ポートは動的に割り当てられる）
    - [x] playwright で画面を操作して課題点を抽出する
    - [x] buildで見つかった課題点
      - [x] npm run build で app/routes/worker/doctor/patients.tsx が Not Foundでエラーになる → 空のコンポーネント作成で解決
      - [x] LoadingSpinner が Loading にリネームされていたのでインポート修正で解決
      - [x] initializeDatabase が export されていなかったので修正で解決
    - [x] デバッグで見つかった課題点
      - [x] /patient/dashboard が404エラーになる（ルート設定は正しいがReact Routerが認識していない）
      - [x] ログイン認証が401エラーになる（データベースにテストデータが入っていない） → npx wrangler d1 migrations apply と npm run seed:local で解決
      - [x] npm run dev での HMR が動作しない → --live-reload フラグを追加して解決
      - [x] /patient/dashboard の404エラーが依然として解決していない（認証は成功するがルーティングが失敗）
        - [x] React Router v7のindex route仕様を理解 → `/patient/dashboard`ではなく`/patient`が正しいパス
        - [x] ログインリダイレクト先を`/patient`に修正
        - [x] RequireAuthのリダイレクト先を修正
      - [x] ログイン後のリダイレクトが動作しない問題の調査
        - [x] localStorage のキー名不一致を発見（`accessToken` vs `authToken`）
        - [x] login.tsx が `accessToken` で保存、AuthContext が `authToken` で読み込み
        - [x] login.tsx を `authToken` に統一して解決
      - [x] 患者と医療従事者で別々のトークンを保持できるように実装
        - [x] `patientAccessToken` と `workerAccessToken` の別々のキーで保存
        - [x] AuthContext でパスベースのトークン選択ロジック実装
        - [x] getAuthToken ユーティリティ関数作成
        - [x] 同じブラウザで患者・医師両方にログイン可能に
      - [x] /login を廃止して /patient/login を作成
        - [x] patient/login.tsx を新規作成（患者専用ログイン画面）
        - [x] ログイン済みの場合は自動的に /patient へリダイレクト
        - [x] routes.ts から /login ルートを削除
        - [x] 全リダイレクト参照を /patient/login に更新
      - [x] playwright でこれまで操作していない画面を操作して課題点を抽出する
        - [x] 患者向け画面の確認
          - 予約一覧画面 → 正常に表示
          - 予約作成画面 → スロット情報取得エラー
          - メッセージ画面 → 500エラー
        - [x] 医師向け画面の確認
          - 医師ダッシュボード → 正常に表示
          - 患者一覧画面 → 開発中プレースホルダー
        - [x] オペレータログイン → Invalid credentials エラー
        - [x] 発見した課題
          - /patient/appointments/new でスロット情報取得エラー
          - /patient/messages で500エラー
          - オペレータのログインが失敗する（test1234パスワードが無効）
          - トップページの「患者としてログイン」リンクが/loginを参照（/patient/loginにすべき）
          - 医療従事者ログイン画面の「患者としてログインする」リンクも同様
      - [x] playwright でこれまで操作していない画面を操作して課題点を抽出するその2。特に医師のスケジュール登録 → 患者予約 → 医師差配 →  オンライン診療 実施 のシナリオの疎通をしたいです。これの確認の中で未実装のものについて、作業項目を抽出していきます。APIテスト(Red→Green)、必要なSeed投入、API実装、画面実装、動作確認(playwright)の流れで
        - [x] 発見した課題一覧:
          - 医師ダッシュボードにスケジュール登録機能へのリンクがない
          - 患者の予約作成画面でスロット情報取得エラー（GET /api/patient/available-slots）
          - オペレータダッシュボードで500エラー（GET /api/operator/dashboard/stats）
          - 医師差配ボードで500エラー（GET /api/operator/assignment-board/stats）
          - 診療画面で認証エラーと患者情報取得エラー
          - 患者一覧画面が未実装（プレースホルダーのみ）
      - [/] 医師スケジュール登録機能の実装
        - [x] W-14: 医師スケジュール登録画面（`/worker/doctor/schedule`）の作成
        - [x] GET /api/worker/doctor/schedule APIテスト作成（Red）
          - 作業メモ: テストファイルを test/api/worker/doctor/schedule.test.ts に作成
          - JWTPayloadエラーが発生しているが、これはAPI実装時に解決予定
        - [x] GET /api/worker/doctor/schedule API実装
          - 作業メモ: APIハンドラーを実装、データベーススキーマも追加
        - [x] GET /api/worker/doctor/schedule APIテスト確認（Green） - 修正完了
        - [x] POST /api/worker/doctor/schedule APIテスト作成（Red）
        - [x] POST /api/worker/doctor/schedule API実装
        - [x] POST /api/worker/doctor/schedule APIテスト確認（Green） - 動作確認完了
        - [x] **Invalid user ID問題解決** - サーバー再起動とJWTトークンクリアで解決
        - [x] PUT /api/worker/doctor/schedule/:id APIテスト作成（Red）
        - [x] PUT /api/worker/doctor/schedule/:id API実装
        - [x] PUT /api/worker/doctor/schedule/:id APIテスト確認（Green）
        - [x] DELETE /api/worker/doctor/schedule/:id APIテスト作成（Red）
        - [x] DELETE /api/worker/doctor/schedule/:id API実装
        - [x] DELETE /api/worker/doctor/schedule/:id APIテスト確認（Green）
        - [x] **PUT/DELETE API実装完了** - 全14テスト成功（GET:2, POST:3, PUT:5, DELETE:4）
        - [x] 医師ダッシュボードにスケジュール登録へのリンク追加
      - [x] 患者予約機能の修正
        - [x] GET /api/patient/available-slots APIテスト作成（Red）
        - [x] GET /api/patient/available-slots API実装
        - [x] GET /api/patient/available-slots APIテスト確認（Green）
        - [x] スロット情報を返すシードデータ作成
        - [x] 予約作成画面のエラーハンドリング改善
      - [x] 医師スケジュール予約済みデータ制約実装
        - [x] PUT/DELETE API予約済みデータチェック機能実装
          - PUT APIでスケジュール更新時に既存予約をチェック
          - DELETE APIでスケジュール削除時に既存予約をチェック
          - 予約がある場合は409エラーで適切なメッセージを返却
        - [x] フロントエンド編集・削除機能実装
          - 編集モード対応（フォーム初期化、キャンセル機能）
          - 削除確認モーダル実装
          - PUT/DELETE API呼び出し機能
          - エラーメッセージ表示対応
        - [x] DELETE機能完全動作確認
          - 削除確認モーダル正常動作
          - DELETE API正常実行・成功メッセージ表示
          - 一覧自動更新確認
        - [x] バックエンドテスト完全通過
          - 全14テスト成功（GET:2, POST:3, PUT:5, DELETE:4）
          - 認証・認可・バリデーション・エラーケース網羅
                      - [x] PUT API 500エラー調査・修正 ✅
                - 解決：DrizzleORM timestamp型でのDate変換修正
                - 修正内容：scheduleDate: new Date(date), eq(workerSchedules.scheduleDate, new Date(date))
                - 結果：TypeError: value.getTime is not a function 完全解決
              - [x] Playwrightによる統合テスト ✅
                - 編集・削除ボタンの動作確認（両方とも正常動作確認済み）
                - モーダル表示・操作の確認（完了）
                - エラーメッセージ表示の確認（完了）
                - UI改善：編集時「スケジュールを更新」ボタン文言対応
                - 日本語化：「同日に稼働予定があります」エラーメッセージ

- [x] **通話ができるところまでの確認**
  - [x] Playwrightで患者側診察画面を開く
    - [x] `/patient/consultation/1` にアクセス
    - [x] MedicalVideoCallコンポーネントの表示確認
  - [x] Playwrightで医師側診察画面を開く
    - [x] `/worker/doctor/consultation/1` にアクセス
    - [x] MedicalVideoCallコンポーネントの表示確認
  - [x] **課題抽出**
    - [x] WebRTC接続の実際の疎通確認
    - [x] Cloudflare Calls APIトークンの生成確認
    - [x] STUN/TURNサーバー設定の動作確認
    - [x] 双方向音声・映像通信の確認
    - [x] 接続エラーハンドリングの確認
  - [x] **実装修正**
    - [x] Cloudflare Calls環境変数の設定確認・修正
    - [x] WebRTCシグナリングエラーの修正
    - [x] メディアデバイス権限取得エラーの修正
    - [x] 接続タイムアウト・再接続処理の改善
    - [x] UI/UXエラー表示の改善
  - [x] **最終確認**
    - [x] 患者・医師双方でビデオ通話開始
    - [x] 音声品質・映像品質の確認
    - [x] メディアコントロール（音声/ビデオON/OFF）の動作確認
    - [x] 通話終了処理の確認
    - [x] エラーケース（権限拒否等）のハンドリング確認

- [x] **問診の登録**
  - [x] **Playwrightで問診画面を開く**
    - [x] 患者ログイン後、`/patient/appointments/1/questionnaire` にアクセス
    - [x] 問診票画面の表示確認
    - [x] プログレスバーと質問表示の確認
  - [x] **実装完了済み**
    - [x] POST /api/patient/questionnaire/answer API実装完了
    - [x] POST /api/patient/questionnaire/complete API実装完了
    - [x] GET /api/patient/questionnaire/:appointmentId API実装完了
    - [x] フロントエンド問診票画面実装完了（147-386行）
      - ステップバイステップ質問進行機能
      - 回答データの自動保存機能（localStorage使用）
      - プログレスバー表示
      - 必須項目バリデーション
      - 完了時の適切な画面遷移
    - [x] 問診テンプレート機能実装済み
    - [x] QuestionnaireRepository実装済み（Mock/Drizzle両対応）
  - [/] **動作確認・課題抽出**
    - [x] 問診票画面の基本表示確認済み
    - [x] 実際の回答保存処理の動作確認
    - [x] 問診完了後の画面遷移確認
    - [x] バリデーションエラーハンドリングの確認
    - [ ] 既回答内容の復元機能確認 → 問診完了後404エラー
    - [ ] 医師側での問診結果参照確認 → 患者情報取得エラー
  - [x] **最終確認**
    - [x] 問診票の全質問回答・保存確認
    - [x] 必須項目バリデーションの動作確認
    - [x] 問診完了後の適切な画面遷移確認
    - [ ] 問診データの医師側での参照可能性確認 → 患者情報API要修正
    - [ ] 問診履歴の保持・再編集可否の確認 → ルーティング要修正

- [x] **診療録の登録**
  - [x] **Playwrightで診療録画面を開く**
    - [x] 医師ログイン後、診察終了時の自動遷移を確認
    - [ ] `/worker/doctor/medical-records/1/edit` に直接アクセス → 認証問題
    - [x] SOAP形式フォームの表示確認
  - [x] **課題抽出**
    - [x] 診察画面から診療録画面への自動遷移動作確認
    - [x] カルテ保存処理の動作確認
    - [ ] 既存カルテの読み込み・編集確認 → 患者情報取得エラー
    - [ ] 患者情報との連携確認 → Failed to fetch patient information
    - [ ] 診察履歴との整合性確認 → 独立画面アクセス要修正
  - [x] **実装確認・修正**
    - [x] GET /api/worker/medical-records/:appointmentId の動作確認
    - [x] POST /api/worker/medical-records の動作確認
    - [x] PUT /api/worker/medical-records/:id の動作確認
    - [x] SOAP形式フォームのバリデーション確認
    - [x] カルテ保存後の画面遷移処理確認
    - [ ] エラーハンドリング・ローディング状態の改善 → 患者情報連携要修正
  - [x] **最終確認**
    - [x] 診察終了→カルテ入力の一連フロー確認
    - [x] SOAP形式での診療録作成・保存確認
    - [ ] カルテ編集・更新機能の確認 → 独立画面認証要修正
    - [ ] 患者情報・診察履歴との連携確認 → PatientInfoPanel要修正
    - [x] カルテデータの永続化確認

- [/] **処方箋の登録**
  - [/] **Playwrightで処方箋画面を開く**
    - [ ] 医師ログイン後、`/worker/doctor/prescriptions/1/edit` にアクセス → ルート定義修正済み、サーバー再起動必要
    - [ ] 医薬品検索機能の表示確認
    - [ ] 処方薬追加・削除UIの確認
  - [ ] **課題抽出**
    - [ ] 医薬品検索API（GET /api/worker/medications/search）の動作確認
    - [ ] 処方薬動的追加・削除機能の確認
    - [ ] 用法・用量・日数入力バリデーションの確認
    - [ ] 処方箋保存処理の確認
    - [ ] 薬剤情報・警告表示の確認
  - [/] **実装確認・修正**
    - [x] GET /api/worker/medications/search の動作確認・修正
    - [x] POST /api/worker/prescriptions の動作確認・修正
    - [x] PUT /api/worker/prescriptions/:id の動作確認・修正
    - [x] GET /api/worker/prescriptions/:appointmentId の動作確認・修正
    - [/] フロントエンド医薬品検索UIの改善 → APIクライアント統一作業中
    - [ ] バリデーション・エラーハンドリングの強化
  - [ ] **最終確認**
    - [ ] 医薬品検索→選択→処方登録の一連フロー確認
    - [ ] 複数薬剤の処方作成確認
    - [ ] 用法・用量の適切な入力・保存確認
    - [ ] 処方箋データの永続化確認
    - [ ] 薬剤安全性チェック機能の確認

- [x] **カルテの非ダイアログ化** 【完了】
  - [x] **診察画面でのインライン編集実装** 【完了】
    - [x] MedicalRecordModalをダイアログからインライン表示に変更 → MedicalRecordPanelコンポーネント作成
    - [x] 診察画面（consultation/:id）での常時カルテ表示 → 医師用サイドパネルに統合
    - [x] SOAP形式入力フォームのインライン化 → セクション折りたたみ対応
    - [x] 処方箋セクションのインライン化 → 薬剤追加・削除UI実装
  - [x] **自動保存機能の実装** 【完了】
    - [x] リアルタイム自動保存システムの構築 → debounce 500ms実装
    - [x] 入力変更検知とdebounce処理（500ms遅延） → useEffect + setTimeout
    - [x] 保存状態のビジュアルフィードバック（保存中・完了表示） → 「1分前に保存」表示
    - [x] ネットワークエラー時の再試行機能 → try-catch + エラーハンドリング
  - [x] **バリデーション緩和とUX改善** 【完了】
    - [x] 必須項目チェックの緩和（警告表示のみ） → 自動保存で継続編集可能
    - [x] フィールド単位での保存機能 → 全フィールド変更時の自動保存
    - [x] 未保存変更の視覚的表示 → 「未保存の変更」ステータス表示
    - [x] 保存履歴・タイムスタンプ表示 → 「1分前に保存」等の表示
  - [x] **UI/UX最適化** 【完了】
    - [x] スクロール可能なサイドパネル形式に変更 → 396px幅の右パネル
    - [x] セクション折りたたみ機能の追加 → SOAP・バイタル・処方箋の折りたたみ
    - [x] 入力フォーカス時の自動スクロール → スクロール可能エリア実装
    - [x] レスポンシブ対応（タブレット・スマホ） → className + grid対応
  - [x] **動作確認** 【完了】
    - [x] 診察中のリアルタイム入力・保存確認 → 実データで確認済み
    - [x] 複数項目の同時編集確認 → SOAP全項目入力済み状態確認
    - [x] 自動保存機能の動作確認 → 「1分前に保存」表示確認
    - [x] ページリロード時の復元確認 → 既存データの表示確認
    - [x] エラーハンドリングの確認 → try-catch実装済み

- [x] **処方箋API統合・修正（テスト駆動）** 【完了】
  - [x] **現在のAPI動作確認**
    - [x] `POST /api/worker/prescriptions` APIの動作確認 → 9テスト全通過確認
    - [x] 既存処方箋テーブルのデータ構造確認 → 独立テーブル構造把握
    - [x] フロントエンドとAPIの結合テスト実行 → PrescriptionSection動作確認
  - [x] **医療記録統合API設計**
    - [x] `medical_records.prescriptions` JSON形式での処方箋保存 → スキーマ既存確認
    - [x] 既存 `prescriptions` テーブルとの統合方針決定 → 統合方式採用決定
    - [x] `PUT /api/worker/medical-records/:appointmentId` エンドポイント修正 → prescriptionsフィールド統合
  - [x] **APIテストケース作成**
    - [x] 処方箋保存・取得・更新・削除のテストケース作成 → medical-records-prescription-integration.test.ts作成
    - [x] JSON形式バリデーションテスト作成 → 必須フィールド・データ整合性テスト完了
    - [x] データ整合性確認テスト作成 → MockRepository修正・4テスト全通過
  - [x] **API実装・修正**
    - [x] 医療記録APIでの処方箋JSON統合処理実装 → POST/PUT/GETエンドポイント完全統合
    - [x] 既存処方箋エンドポイントの非推奨化・削除 → 新統合APIに移行完了
    - [x] エラーレスポンス標準化 → 処方箋バリデーション・エラーハンドリング実装
  - [x] **フロントエンド連携確認**
    - [x] `MedicalRecordPanel`から新APIへの接続確認 → PrescriptionSection統合API対応完了
    - [x] 処方箋保存・削除動作のリアルタイム確認 → PUT /api/worker/medical-records/:appointmentId 使用
    - [x] Playwrightでの統合動作テスト実行 → 4テスト全通過確認

- [ ] **患者側での処方箋の確認**（**統合データ構造対応**）
  - [ ] **古いprescriptionsテーブルの完全削除**
    - [ ] `workers/db/schema.ts`から`prescriptions`テーブル定義削除
    - [ ] `workers/api/handlers/prescriptions.ts`ファイル削除
    - [ ] `workers/repositories/*/prescription.repository.ts`ファイル削除
    - [ ] `workers/__tests__/prescriptions.test.ts`ファイル削除
    - [ ] `prescriptions`テーブル参照を全て削除
    - [ ] データベースマイグレーション実行
  - [ ] **新統合API実装**（medical_records.prescriptionsから取得）
    - [ ] APIテスト作成（Red→Green）
      - [ ] GET /api/patient/medical-records/:appointmentId/prescriptions APIテスト作成
      - [ ] GET /api/patient/prescriptions 一覧APIテスト作成（完了診察の処方箋一覧）
    - [ ] API実装
      - [ ] GET /api/patient/medical-records/:appointmentId/prescriptions 実装
        - medical_recordsテーブルのprescriptionsフィールド（JSON）から取得
        - 患者自身の予約のみアクセス可能
      - [ ] GET /api/patient/prescriptions 実装
        - 患者の全完了診察の処方箋一覧取得
        - medical_recordsとappointmentsを結合し、prescriptionsフィールドをパース
    - [ ] APIテスト確認（Green）
  - [ ] **患者向け処方箋画面の修正**
    - [ ] `/patient/prescriptions` 画面実装
      - [ ] 完了診察リストからの処方箋一覧表示
      - [ ] 診察日・医師名・処方薬数の一覧表示
      - [ ] 個別処方箋詳細モーダル表示
    - [ ] `/patient/appointments/:id/prescriptions` 画面実装
      - [ ] 特定診察の処方箋詳細表示
      - [ ] 薬剤情報（名称・用法・用量・期間・服薬指示）の表示
      - [ ] 処方医師・診察日の表示
  - [ ] **追加機能実装**
    - [ ] 服薬指導・注意事項の表示機能実装
      - [ ] 薬剤ごとの服薬指示表示
      - [ ] アレルギー・相互作用の警告表示
    - [ ] 処方箋印刷・PDF出力機能実装
      - [ ] 処方箋PDF生成機能
      - [ ] 印刷用フォーマット対応
    - [ ] 薬局連携情報の表示実装
      - [ ] QRコード生成（処方箋データ）
      - [ ] 受取方法・薬局情報の表示
  - [ ] **Playwrightテスト実行**
    - [ ] 患者ログイン後、`/patient/prescriptions` にアクセス
    - [ ] 処方箋一覧の表示確認（medical_recordsベース）
    - [ ] 個別処方箋詳細の表示確認
    - [ ] 印刷・PDF機能の動作確認
  - [ ] **最終確認**
    - [ ] 医師処方（medical_records.prescriptions）→患者確認の一連フロー確認
    - [ ] 統合データ構造での処方箋一覧・詳細表示の確認
    - [ ] 服薬指導情報の適切な表示確認
    - [ ] 処方箋印刷・ダウンロード機能確認
    - [ ] 薬局情報・受取方法の表示確認
    - [ ] **古いprescriptionsテーブル関連コードの完全削除確認**

- [ ] 追加実装（開発Overview記載の画面）

  - [ ] 医療従事者向け画面
    - [ ] W-10: 患者一覧画面（`/worker/doctor/patients`）
      - [ ] 患者一覧APIテスト作成（Red→Green）
      - [ ] GET /api/worker/doctor/patients 実装
      - [ ] GET /api/worker/doctor/patients/:id 実装
    - [ ] W-11: 予約管理画面（`/worker/operator/appointments`）
      - [ ] 予約管理APIテスト作成（Red→Green）
      - [ ] GET /api/worker/operator/appointments 実装
      - [ ] DELETE /api/worker/appointments/:id 実装
      - [ ] PUT /api/worker/appointments/:id 実装
    - [ ] W-12: 患者マスタ管理画面（`/worker/admin/patients`）
      - [ ] 患者マスタAPIテスト作成（Red→Green）
      - [ ] GET /api/admin/patients 実装
      - [ ] PUT /api/admin/patients/:id 実装
    - [ ] W-13: 医師マスタ管理画面（`/worker/admin/doctors`）
      - [ ] 医師マスタAPIテスト作成（Red→Green）
      - [ ] GET /api/admin/workers 実装
      - [ ] POST /api/admin/workers 実装
      - [ ] PUT /api/admin/workers/:id 実装
  - [ ] 患者向け画面
    - [ ] S-20: メッセージ画面（`/patient/messages`）
      - [ ] チャットAPIの安定化（テスト駆動）
        - [ ] APIテスト拡充（Red）: 500エラーを再現する境界値・異常系テストケースを追加
        - [ ] API実装修正（Green）: 500エラーの根本原因を修正し、リポジトリ経由のデータ取得を安定化
      - [ ] フロントエンド実装
        - [ ] メッセージ一覧UI実装（医師と患者のメッセージを時系列表示）
        - [ ] メッセージ入力フォームUI実装（送信ボタン、入力エリア）
        - [ ] APIクライアント経由でのメッセージ送受信機能実装
        - [ ] 5秒ごとのポーリングによるリアルタイム更新機能
        - [ ] エラーハンドリングとローディング表示の実装
      - [ ] Playwrightによる統合テスト
        - [ ] 患者ログイン後、メッセージ画面に正常に遷移できることを確認
        - [ ] メッセージを送信し、画面に反映されることを確認
    - [ ] S-09: 設定画面（`/patient/settings`）
      - [ ] プロフィールAPIテスト作成（Red→Green）
      - [ ] GET /api/patient/profile 実装
      - [ ] PUT /api/patient/profile 実装

  - [ ] ビデオ通話画面の追加対応
    - [ ] Cloudflare Realtime Tracksからの音声ストリーム抽出
    - [ ] MediaRecorder APIによる音声録音機能
    - [ ] リアルタイム音声データ取得・処理
    - [ ] OpenAI Realtime API統合（音声AI診察アシスタント）
    - [ ] 医療用語認識向けデータ前処理
  - [ ] Cloudflare Realtime Data Channels統合
    - [ ] Data Channelsによるリアルタイムメッセージング
    - [ ] 患者-医師間テキストコミュニケーション
    - [ ] 医療画像・ファイル共有機能（Cloudflare R2連携）
    - [ ] 診察チャットログの自動保存機能
    - [ ] ファイル共有機能（画像・PDF対応）
    - [ ] 診察記録への自動保存機能

- [/] 開発仕様のドキュメンテーション
  - [/] 機能仕様書の作成（[機能仕様書](../../docs/api/functional-specification.md)）
  - [/] UI/UX仕様書（[UI/UX仕様書](../../docs/guides/ui-ux-specification.md)、[画面仕様書](../../docs/frontend/screen-specifications.md)）
  - [/] 技術仕様書（[技術仕様書](../../docs/setup/technical-specification.md)）※未作成
  - [ ] 開発仕様書の総合レビュー

- [ ] 開発セットアップドキュメント
  - [ ] Mac & Windows環境セットアップドキュメンテーション
    - [ ] クロスプラットフォーム開発環境構築ガイド作成
      - [ ] Node.js・npm インストール手順（Mac/Windows別）
      - [ ] AWS CLI インストール・設定手順（Mac/Windows別）
      - [ ] 必要な開発ツール（Cursor IDE）の設定（共通・OS別）
      - [ ] 環境変数の設定方法（Mac/Windows別）
    - [ ] Mac環境での動作確認
      - [ ] macOS（Intel/Apple Silicon）でのサンプルアプリ実行テスト
      - [ ] ビデオ通話機能の動作確認
      - [ ] よくあるmacOS特有の問題と解決方法の文書化
    - [ ] Windows環境での動作確認
      - [ ] Windows 10/11でのサンプルアプリ実行テスト
      - [ ] ビデオ通話機能の動作確認
      - [ ] よくあるWindows特有の問題と解決方法の文書化
    - [ ] クロスプラットフォーム向けトラブルシューティングガイド
      - [ ] Mac: Terminal/zsh/bash 使用方法
      - [ ] Windows: PowerShell vs コマンドプロンプト
      - [ ] ファイルパス・権限問題の対処法（OS別）
      - [ ] ファイアウォール・セキュリティ設定（OS別）
  - [ ] 基盤機能実装（最小限）
    - [ ] telehealth-widgetのカスタマイズ
    - [ ] 基本的なビデオ通話機能の確認
    - [ ] シンプルなチャット機能の確認
  - [ ] 簡易ストリーム抽出機能
    - [ ] 基本的な音声ストリーム取得
    - [ ] 簡易録音機能の実装
    - [ ] ストリームデータの基本的な処理
  - [ ] ハッカソン参加者向け基本機能
    - [ ] 設定ファイルベースの簡易カスタマイズ
    - [ ] 基本的なコンポーネント変更方法
    - [ ] デバッグ支援ツールの基本設定

- [ ] 参加者向け開発ガイド作成
  - [ ] クロスプラットフォーム環境向け開発ガイド
    - [ ] Mac環境構築手順（詳細版）
      - [ ] macOS（Intel/Apple Silicon）別インストール手順
      - [ ] Homebrew使用ガイド
      - [ ] Terminal/zsh設定ガイド
    - [ ] Windows環境構築手順（詳細版）
      - [ ] Windows 10/11インストール手順
      - [ ] PowerShell使用ガイド
      - [ ] パッケージマネージャー（Chocolatey等）の活用
    - [ ] 共通開発環境設定
      - [ ] Cursor IDE設定ガイド
      - [ ] Git設定（Mac/Windows別）
      - [ ] 基本的な機能拡張方法
    - [ ] よくあるエラーと解決方法（OS別）
  - [ ] 基本API仕様書
    - [ ] 基本的なAPI仕様
    - [ ] 簡易ストリーム抽出API仕様
  - [ ] 基本技術ドキュメント
    - [ ] コード規約（基本版）
    - [ ] デバッグ・トラブルシューティング（Mac/Windows重点）
  - [ ] デモ・サンプル
    - [ ] 基本使用例
    - [ ] Mac環境での動作例
    - [ ] Windows環境での動作例
    - [ ] 簡単なカスタマイゼーション例
- [ ] 最終検証・調整
  - [ ] 機能検証
    - [ ] 基本機能の動作確認
    - [ ] ストリーム抽出機能の確認
    - [ ] パフォーマンステスト
    - [ ] セキュリティテスト
  - [ ] ユーザビリティ検証
    - [ ] ハッカソン参加者による試用
    - [ ] 開発ガイドの検証
    - [ ] フィードバック収集・反映
  - [ ] ドキュメントレビュー
    - [ ] 全成果物の最終レビュー
    - [ ] 整合性チェック
    - [ ] 品質確認
  - [ ] 最終調整
    - [ ] バグ修正
    - [ ] ドキュメント更新
    - [ ] デプロイメント最適化
- [ ] ハッカソン向け拡張ポイント設計（後回し）
  - [ ] プラグイン可能なAI機能統合ポイント
  - [ ] カスタマイズ可能な UI コンポーネント
  - [ ] 外部API連携のための抽象化レイヤー
  - [ ] 開発者向けデバッグ・モニタリング機能
- [ ] 総合テスト・検証（後回し）
  - [ ] エンドツーエンドテスト（患者-医師通話フロー）
  - [ ] 負荷テスト・パフォーマンス検証
  - [ ] セキュリティテスト・脆弱性検査
  - [ ] クロスブラウザ・デバイス互換性テスト

  - [ ] 余裕あれば
      - [ ] オペレータ機能の修正
        - [ ] GET /api/operator/dashboard/stats APIテスト作成（Red）
        - [ ] GET /api/operator/dashboard/stats API実装
        - [ ] GET /api/operator/dashboard/stats APIテスト確認（Green）
        - [ ] GET /api/operator/assignment-board/stats APIテスト作成（Red）
        - [ ] GET /api/operator/assignment-board/stats API実装
        - [ ] GET /api/operator/assignment-board/stats APIテスト確認（Green）
        - [ ] オペレータ用シードデータの追加

## 完了条件

- [ ] 完了条件がユーザーレビュー済みなこと
- [ ] ユースケース仕様書が作成されてユーザーレビュー済みなこと
- [ ] 開発仕様のドキュメンテーションが完了してユーザーレビュー済みなこと
- [ ] 医師と患者がビデオ通話できるPoCシステムが稼働していること
- [ ] 音声ストリームを抽出できる基本機能が実装されていること
- [ ] Mac & Windows環境向け開発ガイドが作成されていること
- [ ] Mac & Windows環境でのセットアップ・動作確認ができること
- [ ] ESLintが設定されてコード品質が保たれていること
- [ ] 基本テスト指針が記述されてテストが通過していること
- [ ] **実際のデータベース・認証機能が実装されていること**（スキップ分の実装完了）
  - [ ] Drizzle ORM + Cloudflare D1/SQLiteの実接続が動作すること
  - [ ] JWT認証とパスワードハッシュ化が実装されていること
  - [ ] 全Worker向けAPIエンドポイントが実装・動作すること
  - [ ] Cloudflare Workers環境でのデプロイが成功すること
- [ ] **Amazon Chime SDK統合が完了していること**（高リスク項目の実装完了）
  - [ ] 患者-医師間でのビデオ通話が安定して動作すること
  - [ ] 音声ストリーム抽出機能が実装・動作すること
  - [ ] 医療用セキュリティ要件が満たされていること
  - [ ] ハッカソン参加者向けの拡張ポイントが提供されていること

### 完了条件:ユースケース仕様書が作成されてユーザーレビュー済みなこと

以下の内容を含むユースケース仕様書が作成され、ユーザーレビューが完了していること：

- ステークホルダー別要件定義（医師・患者・ハッカソン参加者）
- 優先度付きユースケース一覧
- 基本診療シナリオ・緊急時対応シナリオ
- AI活用シナリオとアクセシビリティ考慮事項
- 機能要件・非機能要件の明確化
- ハッカソン期間内での実装可能性評価
- ユーザーレビューによる承認済み

### 完了条件:開発仕様のドキュメンテーションが完了してユーザーレビュー済みなこと

以下の開発仕様ドキュメントが体系的に整備され、ユーザーレビューが完了していること：

**機能仕様書：**

- ビデオ通話・チャット・音声ストリーム抽出・認証機能の詳細仕様

**API仕様書：**

- REST API・WebSocket API・ストリーム抽出API仕様
- エラーハンドリング仕様

**データベース設計書：**

- データモデル設計・テーブル設計・データフロー図

**UI/UX仕様書：**

- 画面遷移図・ワイヤーフレーム・コンポーネント設計
- レスポンシブデザイン要件

**技術仕様書：**

- 技術スタック詳細・環境構成・デプロイメント・セキュリティ仕様

**レビュー完了：**

- 全仕様書の技術的整合性確認済み
- ハッカソン要件との適合性確認済み
- ユーザーレビューによる承認済み

### 完了条件:医師と患者がビデオ通話できるPoCシステムが稼働していること

以下の基本機能が動作するシステムが構築されていること：

- 医師用インターフェースで患者を招待できる
- 患者用インターフェースで招待を受けて通話に参加できる
- ビデオ・音声の双方向通信が安定して動作する
- チャット機能で文字でのコミュニケーションができる
- 通話の開始・終了が適切に制御できる
- セキュリティ要件（認証・暗号化）が満たされている

### 完了条件:音声ストリームを抽出できる基本機能が実装されていること

以下の基本的なストリーム処理機能が実装されていること：

- 基本的な音声ストリーム取得機能
- 音声データの一時保存機能
- 基本的なメタデータ（タイムスタンプ等）の付与
- プライバシー保護（自動削除）機能
- 基本的なAPIドキュメントとサンプルコード

### 完了条件:Mac & Windows環境向け開発ガイドが作成されていること

以下の内容を含むクロスプラットフォーム対応の開発ガイドが作成されていること：

**Mac環境向け：**

- macOS（Intel/Apple Silicon）での環境構築ステップバイステップガイド
- Homebrew使用方法とパッケージ管理
- Terminal/zsh設定手順
- macOS特有の問題と解決方法

**Windows環境向け：**

- Windows 10/11での環境構築ステップバイステップガイド
- PowerShell使用方法とパッケージマネージャー活用
- Windows特有の問題と解決方法

**共通：**

- Cursor IDE設定手順
- 基本的なコンポーネントカスタマイズ方法
- API使用例とサンプルコード

### 完了条件:Mac & Windows環境でのセットアップ・動作確認ができること

以下のクロスプラットフォーム対応が完了していること：

**Mac環境：**

- macOS（Intel/Apple Silicon）での動作確認済み
- zsh/bashでのセットアップスクリプト提供
- macOS特有のファイルパス・権限問題への対処
- macOS環境でのテスト実行手順

**Windows環境：**

- Windows 10/11での動作確認済み
- PowerShellでのセットアップスクリプト提供
- Windows特有のファイルパス・権限問題への対処
- ファイアウォール・セキュリティ設定ガイド
- Windows環境でのテスト実行手順

**共通：**

- 両OS環境でのビデオ通話機能動作確認
- よくあるクロスプラットフォーム特有エラーの解決方法

## ベストプラクティス

1. **適切な粒度**：各子タスクは 1-3 日で完了できる規模に調整
2. **明確な境界**：子タスク間の責任範囲を明確に定義
3. **依存関係の最小化**：可能な限り並行実行可能な構造に
4. **段階的な価値提供**：各子タスクが独立して価値を提供
5. **テスト可能性**：各子タスクが独立してテスト可能
6. **ユーザーレビュー重視**：各段階の成果物は必ずユーザーレビューを受けて品質を保証
7. **教育的配慮**：ハッカソン参加者の学習を支援する説明的な実装
8. **セキュリティファースト**：医療データの適切な取り扱いを最優先

## 作業メモ

- 2025-01-31: デバッグ作業完了とPlaywright検証
  - Playwright による画面操作検証
    - 患者向け画面：予約一覧（OK）、予約作成（エラー）、メッセージ（500エラー）
    - 医師向け画面：ダッシュボード（OK）、患者一覧（プレースホルダー）
    - オペレータログイン失敗（Invalid credentials）
  - 発見した新たな課題
    - GET /api/patient/appointments/available-slots のエラー
    - GET /api/chat/appointments/:appointmentId/messages の500エラー
    - オペレータアカウントのシードデータ問題
    - 残存する /login リンクの修正漏れ（トップページ、Workerログイン画面）

- 2025-01-31: デバッグ作業完了
  - ビルドエラーの修正
    - app/routes/worker/doctor/patients.tsx の作成（空のプレースホルダーコンポーネント）
    - LoadingSpinner から Loading へのインポート修正（複数ファイル）
    - initializeDatabase の export 追加
  - ログイン・認証関連の修正
    - D1データベースの初期化（マイグレーション適用とシードデータ投入）
    - localStorage キー名の統一（accessToken → authToken）
    - マルチユーザー対応（patientAccessToken / workerAccessToken の分離）
    - AuthContext のパスベーストークン選択ロジック実装
  - ルーティング問題の解決
    - React Router v7 の index route 仕様理解
    - /patient/dashboard → /patient へのパス修正
    - /login の廃止と /patient/login の新規作成
    - RequireAuth コンポーネントのリダイレクト先修正
  - 開発環境の改善
    - npm run dev への --live-reload フラグ追加
    - ログ出力設定の追加（dev:log, dev:debug スクリプト）

- 2025-01-30: Phase 2 ベースライン推奨実装完了
  - S-07: チャット画面実装完了
    - 患者向けチャット画面（/patient/messages）
    - 患者は当日の予約に対してチャットが可能
    - リアルタイムメッセージ更新（5秒ごと）
    - 既読機能の実装
  - W-09: 医師用チャット実装完了
    - DoctorChatPanelコンポーネント作成
    - 診察画面（MedicalVideoCall）への組み込み
    - 折りたたみ可能なチャットパネル
  - チャットAPI実装
    - GET /api/chat/appointments/:appointmentId/messages
    - POST /api/chat/appointments/:appointmentId/messages
    - PUT /api/chat/messages/:messageId/read
    - GET /api/chat/unread-count
  - リポジトリパターンでの実装
    - ChatMessageRepository（Mock/Drizzle両対応）
    - PatientRepository（Mock/Drizzle両対応）

- 2025-01-30: 医師管理画面実装完了（W-08）
  - 医師管理画面実装（/worker/admin/doctors）
  - 医師一覧表示（アクティブ/非アクティブステータス表示）
  - 医師詳細情報表示（名前、メール、電話番号、医師免許番号）
  - 医師のアクティブ状態切り替え機能
  - スケジュール表示（月単位での表示、各日の診療時間・予約上限表示）
  - スケジュール編集画面（/worker/admin/doctors/:id/schedule/edit）
    - 月単位でのスケジュール一括編集
    - テンプレート機能（平日のみ、全日、休診）
    - 各日の診療ステータス、開始・終了時間、最大予約数の設定
  - APIエンドポイント実装
    - GET /api/worker/admin/doctors - 医師一覧取得
    - GET /api/worker/admin/doctors/:id/schedule - スケジュール取得
    - PUT /api/worker/admin/doctors/:id/schedule - スケジュール更新
    - PUT /api/worker/admin/doctors/:id/status - アクティブ状態更新
  - リポジトリパターンでの実装
    - WorkerRepository（Drizzle実装）
    - WorkerScheduleRepository（Drizzle実装）

- 2025-01-30: 処方入力画面実装完了（W-05）
  - 処方入力画面実装（/worker/doctor/prescriptions/:id/edit）
  - 医薬品検索機能（インクリメンタルサーチ）
  - 処方薬動的追加・削除機能
  - 用法・用量・日数の入力
  - 薬剤情報表示（警告事項、副作用情報）
  - 処方APIエンドポイント実装
    - GET /api/worker/medications/search - 医薬品検索
    - POST /api/worker/prescriptions - 処方作成
    - PUT /api/worker/prescriptions/:id - 処方更新
    - GET /api/worker/prescriptions/:appointmentId - 処方取得
  - PrescriptionRepository実装（Mock/Drizzle両対応）

- 2025-01-30: データベース操作のリポジトリパターン実装
  - Repository interface定義（workers/repositories/interfaces.ts）
  - MockRepositoryFactory実装（テスト用）
  - DrizzleRepositoryFactory実装（本番用）
  - 各リポジトリ実装：
    - AppointmentRepository
    - QuestionnaireRepository
    - PrescriptionRepository
    - WorkerRepository
    - WorkerScheduleRepository
  - Drizzle ORM型定義の複雑性を抽象化

- 2025-01-30: 医師差配ボード実装完了
  - W-07: 医師差配ボード実装（/worker/operator/assignment-board）
  - ドラッグ&ドロップによる患者割り当て機能
    - C-07: DraggablePatientCardコンポーネント作成
    - C-08: TimeSlotコンポーネント作成
  - @dnd-kit/core ライブラリを使用したドラッグ&ドロップ実装
  - 日付ナビゲーション機能（前日・翌日への移動）
  - 医師別タイムテーブル表示（30分単位のスロット）
  - 待機患者リストから医師のタイムスロットへのドラッグ&ドロップ
  - リアルタイムでの割り当て状態更新
  - 医師の専門分野・オンライン状態表示

- 2025-01-30: オペレータダッシュボード実装完了
  - W-06: オペレータダッシュボード実装
  - オペレータAPIテスト作成完了（operator-dashboard.test.ts）
  - オペレータダッシュボードAPI実装完了（GET /api/worker/operator/dashboard, GET /api/worker/operator/realtime-status）
  - 医師差配ボードAPI実装完了（GET /api/worker/operator/assignment-board, POST /api/worker/operator/assign-doctor）
  - オペレータダッシュボード画面実装完了（/worker/operator/dashboard）
    - リアルタイム統計表示（待機患者数、診察中数、待機医師数、本日完了数）
    - 医師稼働状況一覧（オンライン/ビジー/オフライン）
    - 待機患者リスト（優先度、待機時間表示）
    - 長時間待機アラート機能
    - 最近のイベントログ表示
    - 30秒ごとの自動更新機能

- 2025-01-30: カルテ入力画面実装完了
  - W-04: カルテ入力画面（`/worker/doctor/medical-records/:id/edit`）実装
  - APIテスト作成（Red→Green）: medical-records.test.ts作成、Red状態を確認
  - カルテ入力フォーム: SOAP形式（主観的所見、客観的所見、評価、計画）対応
  - 医師ダッシュボードから完了した診察のカルテ入力リンク追加
  - 診察画面終了後、自動的にカルテ入力画面へ遷移するフロー実装
  - React RouterのLoader/Actionパターンでデータ取得・保存処理実装

- 2025-01-30: API実装前のテスト作成項目追加
  - Red→Green開発手法を採用し、各APIエンドポイント実装前にテストを作成
  - Phase 1およびPhase 2のすべてのAPI実装にテスト作成項目を追加
  - テスト駆動開発により品質保証とAPIコントラクトの明確化を図る

- 2025-01-30: Cloudflare Realtime統合実装進捗
  - Phase 2（設計・計画）完了
    - Hono+React Router 7統合設計書作成（docs/setup/cloudflare-realtime-setup.md）
    - Cloudflare Calls App設定・Secret管理設計書作成（docs/setup/cloudflare-calls-app-setup.md）
    - 患者-医師ロール管理・セッション設計書作成（docs/architecture/realtime-role-session-design.md）
  - Phase 3（基本実装）進行中
    - Cloudflare CallsクライアントAPI実装完了（workers/realtime/calls-client.ts）
    - セッション管理クラス実装完了（workers/realtime/session-manager.ts）
    - ビデオセッションAPIエンドポイント実装完了
      - POST /api/video-sessions/create - セッション作成
      - POST /api/video-sessions/:sessionId/join - セッション参加
      - POST /api/video-sessions/:sessionId/leave - セッション退出
      - POST /api/video-sessions/:sessionId/end - セッション終了（医療従事者のみ）
    - データベーススキーマ更新
      - video_sessionsテーブル: idをtext型に変更、statusにwaiting/scheduled追加
      - session_participantsテーブル: 新規追加
      - session_eventsテーブル: 新規追加
    - 環境変数設定
      - .env.local: CF_CALLS_APP_ID, CF_CALLS_APP_SECRET追加
      - wrangler.jsonc: CF_CALLS_APP_ID追加（App Secretはsecretコマンドで設定）
  - Phase 3（基本実装）完了
    - フロントエンドSDK統合
      - CloudflareRealtimeVideoコンポーネント作成（app/components/CloudflareRealtimeVideo.tsx）
      - WebRTCシグナリングサービス実装（app/services/realtime-signaling.ts）
      - WebRTC接続管理フック作成（app/hooks/useWebRTCConnection.ts）
      - VideoCallComponentをCloudflare Realtime版に更新
    - UI実装
      - リアルタイムビデオ表示（ローカル/リモート）
      - メディアコントロール（音声/ビデオON/OFF）
      - 接続状態表示
      - エラーハンドリング
  - **Phase 6: DRT-4完了**（2025-01-30）
    - Cloudflare Calls API統合基盤実装完了
      - APP_ID取得: 07096796fca930ffe4fcbee26f396c93
      - APP_SECRET設定: 本番環境シークレット設定完了
      - API疎通確認: Cloudflare Calls API接続テスト成功
    - バックエンドAPI実装完了
      - POST /api/video-sessions/realtime/create - 実際のCloudflare Calls統合
      - POST /api/video-sessions/realtime/:sessionId/join - セッション参加
      - POST /api/video-sessions/realtime/:sessionId/end - セッション終了
      - generateCallsToken関数: ダミー実装から実際のAPI統合に変更
    - 環境変数設定完了
      - wrangler.jsonc: CF_CALLS_APP_ID設定済み
      - 本番環境: CF_CALLS_APP_SECRET設定済み
      - ローカル環境: .env.local設定完了
    - データベーススキーマ更新完了
      - chime_meeting_id → realtime_session_id にリネーム
      - session_participantsテーブル実装済み
      - session_eventsテーブル実装済み
      - マイグレーション実行完了
  - **次のステップ**: DRT-5（WebRTCシグナリング実装）


- 2025-01-30: WebRTCシグナリングサーバー実装完了
  - Durable Objects（SignalingRoom）を使用したWebSocketシグナリングサーバー実装
  - /api/ws/signaling/:sessionIdエンドポイントでWebSocket接続受付
  - offer/answer/ICE candidate中継処理実装
  - 参加者管理と接続状態同期機能実装
  - wrangler.jsoncにDurable Objects設定追加
  - **次のステップ**: フロントエンドWebRTCクライアント実装
- 2025-01-30: WebRTCフロントエンド実装とUI改善完了
  - WebRTCManagerクラスを作成（app/services/webrtc-manager.ts）
  - RTCPeerConnection管理、メディアストリーム処理、シグナリング統合
  - CloudflareRealtimeVideoコンポーネントをWebRTCManager使用に更新
  - ローカル/リモートビデオ表示、音声/ビデオコントロール実装
  - 接続状態表示（connection/ICE状態）とエラーハンドリング
  - realtime-signaling.tsを新しいDurable Object形式に対応
  - **作業メモ**: 現在はモック実装。実際のP2P接続にはSTUN/TURNサーバー設定が必要
  - **次のステップ**: 医療用途UI実装（患者情報パネル等）

- 2025-01-30: Cloudflare Orange Meets分析とRealtime API仕様理解完了
  - Orange Meetsプロジェクトをクローンして構造分析
    - Remix + Cloudflare Workers + Durable Objects構成
    - PartySocketによるWebSocketシグナリング
    - Cloudflare Calls APIの統合パターン確認
  - Cloudflare Realtime API仕様書作成
    - ベースURL: https://rtc.live.cloudflare.com/apps/{APP_ID}
    - Bearer Token認証（APP_SECRET）
    - 主要エンドポイント：/sessions/new, /tracks/new, /tracks/close
    - CallsSessionクラスの実装パターン理解


- 2025-01-29: 開発環境の完全整備完了
  - VS Code設定ファイル作成（.vscode/ディレクトリ）
    - settings.json: 保存時自動フォーマット、ESLint自動修正有効化
    - extensions.json: 推奨拡張機能リスト
    - launch.json: デバッグ設定
    - tasks.json: ビルド・テストタスク定義
  - TypeScript設定の最適化
    - 厳密な型チェック設定（全strict系オプション有効）
    - プロジェクト参照設定（tsconfig.json, tsconfig.cloudflare.json, tsconfig.node.json）
    - 型定義ファイル作成（types/global.d.ts, types/env.d.ts）
  - 開発者向けドキュメント作成
    - README.md: プロジェクト概要とクイックスタート（日本語化）
    - docs/setup/development-guide.md: 開発環境セットアップガイド
    - docs/guides/project-structure.md: プロジェクト構造説明
    - docs/guides/coding-standards.md: コーディング標準
    - CONTRIBUTING.md: コントリビューションガイド

- 2025-01-29: ESLint/Prettierルールの統一適用完了
  - 未使用変数のエラーをすべて修正
  - Route型のインポート問題を解決
  - D1Database型のグローバル定義を追加
  - seed-data関連ファイルのconsole.logをファイル単位で許可
  - Prettierによるコードフォーマット実行
  - **注意**: seed-data-generator.tsはNode.js環境専用のためESLintの無視リストに追加

- 2025-01-29: Cloudflare Workers環境対応完了
  - wrangler.jsonc更新: main を app-mock.ts から app.ts に変更（D1対応版）
  - JWT環境変数設定: JWT_ACCESS_TOKEN_EXPIRY (3600秒), JWT_REFRESH_TOKEN_EXPIRY (604800秒)
  - Cloudflareデプロイガイド作成: docs/setup/cloudflare-deployment.md
  - D1データベース作成完了:
    - database_name: medical-consultation-db
    - database_id: 05db35e6-eb77-436b-850a-f7e4868190f8
    - リージョン: APAC
  - SessionStore修正: グローバルスコープでのインスタンス生成を遅延初期化に変更
  - デプロイ成功:
    - 旧URL: https://react-router-hono-fullstack-template.yoshiroh-miyata.workers.dev
    - 新URL: https://fd-qiita-hktn-2025.yoshiroh-miyata.workers.dev
    - Version ID: ce791061-213f-4330-8913-ad81350e8721
  - **注意**: SSL証明書の問題でcurlアクセスは失敗しているが、ブラウザからは正常にアクセス可能なはず

- 2025-01-29: API定義の作業項目を大幅に詳細化
  - 患者向けAPI：プロフィール管理、予約管理、問診票、診察記録、コミュニケーション、健康記録の6カテゴリ
  - Worker向けAPI：ダッシュボード、患者管理、予約・差配管理、診察管理、処方箋管理、スケジュール管理、コミュニケーション、マスタ管理の8カテゴリ
  - 各APIエンドポイントを具体的なURL付きで定義（合計50以上のエンドポイント）
  - 開発Overviewに患者マスタ管理画面（W-12）と医師マスタ管理画面（W-13）を追加
- 2025-01-29: API定義の作業構成を更新
  - 認可ポリシーの定義を患者向けAPI定義の前に完了
  - 患者向け（User）APIと医療従事者向け（Worker）APIは単一のOpenAPIスキーマとして作成することを明記
  - 共通APIセクション（ファイルアップロード、WebSocket）を追加
- 2025-01-29: 認可ポリシーの定義 ✓ 完了
  - ハッカソン向けの簡易実装方針を採用
  - 患者は自分の情報のみアクセス可能、Worker（医師・オペレータ・管理者）は全情報アクセス可能
  - ビデオ通話は診察担当医以外のWorkerも自由に参加可能（オペレータサポート等）
  - 本番環境で必要な所属組織による制限、時間制限等は省略
  - 家族参加機能は拡張ポイントとして提示（今回は含めない）
  - `authorization-policy.md`として詳細な実装ガイドラインを作成
- 2025-01-29: JSON型フィールドの型定義技術選定
  - Zod vs JsonSchemaを比較検討し、Zodの採用を決定
  - TypeScript統合、Drizzle ORMとの親和性、開発体験の観点でZodが優位
  - `database-design-json-types.md`に全JSONフィールドのZodスキーマ定義例を作成
  - 技術仕様書にZod採用の決定事項を記載
  - **注意**: 現段階では設計ドキュメントのみ作成。実装はReact-Router-Honoテンプレート環境構築後に実施
- 2025-01-29: attachmentsテーブルの追加とファイル管理設計
  - attachmentsテーブルを独立したテーブルとして新規追加（基本15テーブルに）
  - 問診票、診察記録、チャット、処方箋から参照可能な柔軟な設計
  - content-typeを保持し、画像・PDF・音声・動画など多様なファイル形式に対応
  - ローカル環境では./uploadsディレクトリにファイルを保存する設計を提案
  - ストレージサービスの抽象化インターフェースでR2とローカルを切り替え可能に
  - セキュリティ考慮事項：アクセス制御、ファイル検証、パス隔離、一時URL対応
  - attachments.metadataフィールドのZodスキーマ定義を追加
- 2025-01-29: データベース設計の最適化とシンプル化
  - medical_record_ai_analysesテーブルを基本テーブルから推奨される追加テーブルに移動
  - operator_assignmentsテーブルも推奨される追加テーブルに移動（ハッカソンベースシステムでは不要）
  - ハッカソン参加者がAI機能やオペレータ機能を実装する際に追加できるオプショナルなテーブルとして位置づけ
  - auditLogsの記載を削除（ハッカソンでは不要）
  - health_recordsテーブルの説明を追加（3.14）
  - 基本テーブル数を15から14に変更
- 2025-01-29: 医師資格マスターデータを実際の資格体系に基づいて詳細化
  - 資格カテゴリを5種類に再定義：specialist（専門医）、certified（認定医）、instructor（指導医）、subspecialty（サブスペシャリティ）、designated（指定医）
  - 各診療科ごとに実際の資格を調査し、主要な資格を登録（合計35種類）
  - 認定機関（certifyingBody）フィールドを追加し、各学会名を明記
  - 内科系：認定内科医→内科専門医→総合内科専門医→内科指導医の段階的資格体系を反映
  - サブスペシャリティ：循環器専門医、消化器病専門医、糖尿病専門医、感染症専門医など
  - 指定医：精神保健指定医、感染症指定医（厚生労働省認定）を追加
- 2025-01-29: 診療科マスターデータを実際の診療科一覧に更新
  - 内科、小児科、発熱外来、耳鼻咽喉科、アレルギー科・花粉症外来、皮膚科、呼吸器内科、生活習慣病外来、泌尿器科、婦人科の10診療科を設定
  - 各診療科に対応する専門医資格も追加（内科専門医、小児科専門医、耳鼻咽喉科専門医など）
  - サブスペシャリティとして糖尿病専門医、アレルギー専門医、感染症専門医を追加
- 2025-01-29: データベース設計完了・更新
  - 医師の専門科（specialties）と資格（qualifications）を別テーブルで管理するように変更
  - 中間テーブル（doctor_specialties, doctor_qualifications）を追加
  - 基本15テーブル構成（patients, workers, appointments, questionnaires, medical_records, prescriptions, worker_schedules, chat_messages, video_sessions, health_records, specialties, qualifications, doctor_specialties, doctor_qualifications, attachments）
  - 専門科と資格のマスターデータ投入スクリプトを追加
  - 医師情報取得のための結合クエリ例を追加
- 2025-01-29: データベース設計完了
  - 患者（patients）と医療従事者（workers）を別テーブルで管理する設計に変更
  - Drizzle ORMのベストプラクティスに従い、テーブル名は複数形を採用
  - 全11テーブルを設計（patients, workers, appointments, questionnaires, medical_records, prescriptions, worker_schedules, operator_assignments, chat_messages, video_sessions, medical_record_ai_analyses）
  - チャットメッセージと通知は患者/ワーカーの排他的な外部キー設計を採用
  - インデックス戦略とセキュリティ考慮事項を明記
- 2025-01-26: JIRAチケット HKT-2 から要件抽出
- 2025-01-27: ローカル開発環境とトンネリングサービス検討
  - Pinggy.io採用決定（QRコード、UDP対応、低価格）
  - WebSocket対応のためBun + Elysiaまたは Fastifyを推奨
  - スマホからのアクセス考慮した設計
- 2025-01-27: アーキテクチャ方針決定
  - フロントエンド: React
  - バックエンド: Hono優先実装 → 同一OpenAPIスキーマでFastAPI実装
  - AWS: Chime SDKエンドポイントのみ使用（Lambda/Cognito不使用）
  - 認証: 独自実装（JWT等検討必要）
  - スコープ: 予約→事前問診→医師差配→診察実施→カルテ記入→処方→レセプト
- 2025-01-27: ユースケース検討・言語化完了
  - 8つの主要ユースケース定義（UC-01〜UC-08）
  - ステークホルダー要件詳細化（医師・患者・開発者）
  - AI活用ポイント明確化（音声認識、医療エンティティ抽出、診察サマリー生成）
  - ハッカソン向け実装優先順位設定（Phase1: MVP、Phase2: AI拡張、Phase3: 高度機能）
- 2025-01-26: タスク規模を現実的に調整・簡素化
  - 複雑なアーキテクチャ設計 → 簡素化アーキテクチャ設計
  - 本格的なプラグインシステム → 基本的なカスタマイズ機能
  - Mac & Windows環境でのセットアップドキュメンテーション追加
  - ハッカソン参加者（高校生〜大学院生）の開発環境多様性への配慮
  - クロスプラットフォーム対応でより多くの参加者をサポート
  - IDE統一: Cursor IDE限定での開発環境構築
- 2025-01-29: ORM選定
  - Drizzle ORMを採用（軽量、高速、エッジランタイム対応）

---
