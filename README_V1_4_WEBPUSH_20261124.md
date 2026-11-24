# v1.4 Web Push 試験版（2026-11-24）
## 目的
毎朝6:30（JST）にPWAの通知を送信。タップで既存のホーム画面アプリを起動する。本文217件、復習音声297本、記録を含む既存IndexedDB・manifest ID・scope・URLを維持。通知のために教材・進捗を送信しない。
## 初回登録
1. ホーム画面PWAをオンラインで起動し、設定の「最新版を確認・更新する」でv1.4に更新。
2. 設定の「毎朝の学習通知（試験）」→「通知を準備」→「通知を許可」。iOSのダイアログでも許可。
3. 「登録情報を安全にコピー」を押す。VAPID鍵とPushSubscriptionを画面に表示せずコピーする。GitHubのリポジトリSettings → Secrets and variables → Actions → New repository secretで、名前を PATAPURA_PUSH_CONFIG として値欄に貼る。チャット、公開ファイル、メールには貼らない。
4. Actions → Patapura daily push → Run workflow で手動送信。送信サービスの受理とiPhoneの受信・タップ起動・既存データ表示を確認。未設定では送信しない。
5. 配信は毎朝6:30 JST（UTC 21:30）を予定。GitHub Actionsの混雑で遅延する場合があり、公開リポジトリに60日間活動がないとスケジュール停止の可能性がある。必要時は非公開送信リポジトリを別途検討する。
## 設計
- WebKitのDeclarative Web Pushのimmutableペイロードにnavigateとapp_badgeを指定。従来Web Push用のSW fallbackも追加。
- 端末内でP-256鍵を生成、ローカル保存。購読とVAPID秘密鍵をGitHub Actions Secretにだけ登録。公開ソースには実値を含めない。依存ライブラリのインストール段階にはSecret本体を渡さない。送信ログに秘密情報・エンドポイントを出さない。
- 3レッスン完了時、端末側でバッジを解除。取り消し時は再表示。配信側は進捗を知らないため、毎朝の通知は学習済みの場合も届き、アプリを開けば最新状態に合わせる。
- 停止：アプリ設定の「通知を停止」、GitHubのSecretを削除。再登録する場合は新しいSecret値が必要。
## QA
構文・HTML ID、キャッシュビルド、DB/manifest同一性、模擬鍵生成・購読・コピー・停止・バッジ設定と解除、SW従来通知・クリック時の既存ウィンドウフォーカス、送信コードとスケジュールを検査済み。
GitHub Actions実行、Apple Push Serviceへの実送信、iPhoneの受信と直接起動は未検証。通知の利用開始にはユーザー自身による初回許可とSecret登録が必要。
安定版v1.3は preserve-v1.3-20261124 に保全。