# リファクタリングロードマップ

作成日: 2026-07-07（コードベース全体調査に基づく）

このドキュメントは、コードベース全体の調査（アーキテクチャ横断分析・git履歴分析・複数エージェントによる独立レビュー）から抽出した改善タスクの全リストである。**ほぼすべてが機能追加ではなくリファクタリング／品質負債の返済**であり、以下の3カテゴリに分類している。

- **B: バグ修正**（即対応。小さく、独立して着手可能）
- **F: 大規模再設計タスク**（設計難度が高い。全体像を保持したまま進める必要があり、担当モデル/担当者の力量が結果を左右する）
- **S: 通常タスク**（実行手順が明確。Sonnet級モデルや通常の開発フローで安全に完了できる）

## 進捗ボード（作業単位別・実行順）

全タスクは24件（作業単位3完了後レビューで追加したS17・S18を含む）。うちS7はF1に、S16はF4に包含されるため、**実行対象は22件**。これを作業量がほぼ均等になるよう**6つの作業単位**に分割した。作業単位を上から順に消化していけばよい（単位5は単位2完了後であれば前倒し可）。

> **運用ルール**: タスクに着手したら「状態」を `🔄 進行中` に、完了したら `✅ 完了` にし、完了日とPR番号を記入する。作業単位内の全タスクが完了したら見出しの ⬜ を ✅ に変える。スキップ判断した場合は `⏭️ スキップ` + 理由を備考に書く。このテーブルがこのロードマップの唯一の進捗ソースであり、各タスクの詳細は本文の該当セクションを参照する。

### ✅ 作業単位1: バグ修正とAPIテスト基盤

実バグの解消と、以降の全リファクタの前提になるテスト基盤づくり。

| ID  | タスク                                                                | 規模 | 状態    | 完了日 / PR | 備考                                                                                                                                                            |
| --- | --------------------------------------------------------------------- | ---- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | TTSルートのレスポンス未送信バグ修正                                   | 小   | ✅ 完了 | 2026-07-07  | `refactor/unit1-bugfix-api-test-infra` ブランチ。回帰テストはS1のcartesia/elevenLabsテストに含む                                                                |
| B2  | 未翻訳エラーコード8件 + デバッグログ削除                              | 小   | ✅ 完了 | 2026-07-07  |                                                                                                                                                                 |
| S6  | テスト基盤整備（guardモックヘルパー / 静的テスト / カバレッジ可視化） | 中   | ✅ 完了 | 2026-07-07  | `src/__tests__/helpers/apiRouteTestUtils.ts` + 静的テスト + CIジョブサマリーにカバレッジ表示                                                                    |
| S1  | TTS APIルートの単体テスト追加（未テスト5ルート）                      | 中   | ✅ 完了 | 2026-07-07  | S6のヘルパーを利用                                                                                                                                              |
| S3  | 外部制御API `v1/*` のテスト追加                                       | 中   | ✅ 完了 | 2026-07-07  | 実際には `externalApi.test.ts`（2026-06-29追加）が既存。未カバーだった制限モード/405/バリデーション/SSE/interrupt分岐と `features/api/http.ts` 単体テストを補完 |

### ✅ 作業単位2: 残りのテストと機械的な品質改善

セーフティネットの完成 + 影響が局所的で安全な品質改善。

> 2026-07-07 レビュー実施（8視点並列 + 個別検証）。確定指摘10件をすべて修正し、developへローカルマージ済み（`0a823392`〜`65959007`、push未実施）。主な修正: send-messageのサンプルコード復元 / RealtimeエラーをloggerErrorに格上げ / loggerのサーバー側常時出力化 / ErrorBoundaryにresetKey復帰機構と非同期エラー通知（`reportViewerError`）を追加 / pngTuber純粋関数を`pngTuberMath.ts`へ抽出 / テストヘルパー共通化。

| ID  | タスク                                 | 規模 | 状態    | 完了日 / PR | 備考                                                                                                                                      |
| --- | -------------------------------------- | ---- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S4  | PNGTuberEngine 純粋関数テスト          | 中   | ✅ 完了 | 2026-07-07  | `refactor/unit2-tests-and-quality` ブランチ。56ケース、プロダクションコード変更なし                                                       |
| S5  | フック・Mastraワークフローのテスト補完 | 中   | ✅ 完了 | 2026-07-07  | useDraggable/useResizable/useTheme + Mastra分岐E2E含む47テスト追加。usePresenceDetectionのTODO 6件解消（真因はモック実装のリーク）        |
| S12 | ErrorBoundary の導入（3ビューア）      | 小   | ✅ 完了 | 2026-07-07  | `common/ErrorBoundary.tsx` + 3ビューアラップ + toast通知（`Errors.ViewerRenderingError`）                                                 |
| S10 | ロガー統一（console.\* 163箇所）       | 中   | ✅ 完了 | 2026-07-07  | `lib/logger.ts` 追加（本番はNEXT_PUBLIC_DEBUG_LOG=true時のみlog出力、warn/errorは常時）。実際は409箇所/99ファイルを置換（調査時から増加） |

### ✅ 作業単位3: F1 統一アクセスポリシー

最重要の再設計。設計ドキュメント → レビュー → 実装の3段階で進める。

> 2026-07-07 完了。`refactor/unit3-unified-access-policy` ブランチ。設計ドキュメント `docs/access-policy-design.md`（2系統レビュー実施: 分類表のコード突合 + 批判的設計レビュー、Blocker 3件を含む指摘を反映してv2改訂後に実装）。成果物: `src/lib/accessPolicy/`（types / routePolicies=全46ルート宣言テーブル / secretPairs=S7吸収 / withAccessPolicy高階関数）、全46ルート移行、WAFルールを `scripts/waf/generate-waf-rules.mjs` で同一定義から生成（移行前ルールとの意味的等価テスト付き）、静的テストで新ルートのポリシー未登録を検出、デプロイ文脈マトリクステスト。意図的挙動変更は設計§8に列挙（ガード優先統一順序 / 14ルートへのメソッド検査追加 / 405ボディ統一）。実装時にdifyChatの条件結合を検出しdynamicへ分類変更。
>
> **2026-07-07 完了後レビュー**（8並列Angle + 個別検証）で見つかった4件のうち2件はその場で修正済み: (1) `withAccessPolicy.ts` の serverUrl解決と `secretPairs.ts` の `evaluateSecretPairs` が持っていたクライアント値抽出ロジックの重複を `extractClientValue()` に共通化、(2) `update-voicevox-speakers.ts`/`update-aivis-speakers.ts` が `resources: [...'server-url']` を宣言しながら実際はprotocol検査のみで、兄弟ルート（`tts-voicevox`/`tts-aivisspeech`）が持つ `isAllowedConfiguredOrListedUrl` によるSSRFホスト許可リスト検証を欠いていた不整合を解消（回帰テスト追加、全1751テスト・lint・tsc差分なしを確認）。残り2件は設計判断を伴うためS17・S18として後方に切り出し（詳細は該当セクション参照）。

| ID  | タスク                                     | 規模 | 状態    | 完了日 / PR | 備考                                                                   |
| --- | ------------------------------------------ | ---- | ------- | ----------- | ---------------------------------------------------------------------- |
| F1  | デプロイ境界の統一アクセスポリシー設計     | 大   | ✅ 完了 | 2026-07-07  | S7を包含（computeUsesServerSecret / evaluateSecretPairs として共通化） |
| S13 | `azureOpenAITTS.ts` エンドポイント検証強化 | 小   | ✅ 完了 | 2026-07-07  | isHttpUrl検証 + deploymentName文字種制限（400化）+ 回帰テスト4件       |

### ✅ 作業単位4: F2 settingsマイグレーション基盤

出荷済みユーザーのlocalStorageを壊さないことが最優先。設計ドキュメント必須。

> 2026-07-07 完了。`refactor/unit4-settings-migration-foundation` ブランチ。設計ドキュメント `docs/settings-migration-design.md`。既存の無条件`migratePersistedSettings`をzustand persistの`version`/`migrate`オプションに乗せ替え、4つの既存マイグレーション条件をバージョン採番済みの独立ステップ関数（`settingsMigrationSteps`）に分解。最新バージョンのユーザーは`migrate`自体が呼ばれず起動時の再評価コストがゼロに。version 0〜3の各世代フィクスチャ+ダウングレード安全性のテストを追加（`settingsMigration.test.ts`）。S14は`.env.example`とコード内`NEXT_PUBLIC_*`参照の双方向ドリフトを検出する静的テスト（`envExampleConsistency.test.ts`）として実施し、既存の実ドリフト7件（コードにあるが`.env.example`に未記載）+1件（`.env.example`にあるが未使用の`NEXT_PUBLIC_LOCAL_LLM_MODEL`）を発見・修正済み。スキーマ自動生成は範囲外（設計ドキュメント参照）。全1769テスト・lint・build確認済み。

| ID  | タスク                                             | 規模 | 状態    | 完了日 / PR | 備考                                                    |
| --- | -------------------------------------------------- | ---- | ------- | ----------- | ------------------------------------------------------- |
| F2  | settingsストアのバージョン付きマイグレーション基盤 | 大   | ✅ 完了 | 2026-07-07  |                                                         |
| S14 | `.env.example` 整合性パス                          | 中   | ✅ 完了 | 2026-07-07  | ドリフト検出の静的テストとして実施。実ドリフト8件を修正 |

### ✅ 作業単位5: 共通化・型・分割（並行可）

すべて委任可能な中規模タスク。作業単位2の完了後であれば、単位3・4と並行して前倒し実施してよい。

> `refactor/unit5-common-types-split` ワークツリー（`/Users/user/WorkSpace/aituber-kit-unit5`）で作業。
>
> 2026-07-07 いったん中断（S8・S2・S9完了、S11部分完了）。2026-07-08 残り（S11続き・S17・S18・S15）を再開し全完了。S11はプロダクションコード全28ファイルの`any`を実SDK型に置換（修正中に判明したテスト回帰2件も修正）。S17はRoutePolicy.resourcesの実行時検証を静的テストとして追加。S18はSecretPairに`onlyIfAbsent`を追加しdifyChat.tsを宣言的表現へ移行（stylebertvits2.ts/ai/custom.tsは挙動保持のためdynamicのまま理由を明記して維持）。S15はcharacter.tsx/voice.tsx/index.tsxを`modelProvider/`パターンに倣い分解し、previewツールで視覚回帰なしを確認。作業単位5の全7タスク完了、全1821テスト・lint・tsc・build確認済み。2026-07-08 developへローカルマージ済み（`dbca4d62`、push未実施）。マージ後developで全1830テスト・tsc再確認済み。

| ID  | タスク                                          | 規模 | 状態    | 完了日 / PR | 備考                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | ---- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S8  | TTS共通フェッチヘルパーの抽出                   | 中   | ✅ 完了 | 2026-07-07  | `synthesizeVoiceApi()` に集約、既存エラーメッセージ文言を維持、全1751テスト・lint通過                                                                                                                                                                                                                                                                                                                                                                      |
| S2  | クライアント側 `synthesizeVoice*.ts` テスト追加 | 中   | ✅ 完了 | 2026-07-07  | 未テスト9エンジンに46テスト追加。S8のデフォルトエラーメッセージ回帰（" API"抜け）をテストで検出・修正。2026-07-08に`live2dHandler.ts`のAudioContext/PCM16/stopSpeaking系テスト4件を追加し、残タスクメモを解消                                                                                                                                                                                                                                              |
| S9  | CharacterRenderer 共通インターフェース定義      | 中   | ✅ 完了 | 2026-07-07  | `getCharacterRenderer()`に一元化、speakQueue.ts(3箇所)+speakCharacter.ts(1箇所)の分岐重複を解消。testVoice()のLive2Dブランチのawait漏れも修正                                                                                                                                                                                                                                                                                                              |
| S11 | `any` の削減（44ファイル）                      | 中   | ✅ 完了 | 2026-07-07  | プロダクションコード全28ファイル（youtubeComments.ts/vercelAIChat.ts/customApi.ts + 残り25ファイル）完了。i18nextのTFunction/Vercel AI SDKのLanguageModel/axiosのisAxiosErrorガード等、実際のSDK型に置き換え。テストヘルパー内の`any`（14ファイル、主にモック定義）は対象外（プロダクションコードのstrict保証が目的のため）。修正中に発覚したテスト回帰2件（axios.isAxiosError/OpenAI.APIErrorのモック不足）を修正し全1809テスト・lint・tsc・build確認済み |
| S15 | 設定画面コンポーネントの分割                    | 中   | ✅ 完了 | 2026-07-07  | character.tsx/voice.tsx/index.tsxをmodelProvider/パターンに倣いcharacter/・voice/・shell/へ分解。previewツールでスクロール全域・エンジン切替・検索ハイライトの見た目を目視比較し差異なしを確認                                                                                                                                                                                                                                                             |
| S17 | `RoutePolicy.resources` の実行時検証            | 中   | ✅ 完了 | 2026-07-07  | 各ApiResource種別ごとにgrepベース静的テストを追加。server-urlを意図的に未検証とする例外ルートは許可リスト方式で除外                                                                                                                                                                                                                                                                                                                                        |
| S18 | `SecretPolicy` の条件付きペア表現への拡張       | 中   | ✅ 完了 | 2026-07-07  | `SecretPair.onlyIfAbsent`を追加しdifyChat.tsをpairsへ移行。stylebertvits2.ts/ai/custom.tsは既存挙動保持のためdynamicのまま維持（理由をコード内コメントで明記）                                                                                                                                                                                                                                                                                             |

### ✅ 作業単位6: F4 + F3 アーキテクチャ再構築

最も重い単位。F4（ストリーミング）→ F3（audioモード）の順。1回で消化しきれない場合は 6a / 6b に分割してよい。

> `refactor/unit6-streaming-state-machine` ブランチで作業。2026-07-08 developへローカルマージ済み（`a1fe151a`、push未実施）。マージ後developで全1903テスト・tsc（既存225エラーから増分ゼロ）を再確認済み。
>
> F4は2026-07-08完了（コミット `0afe2300`）。設計ドキュメント `docs/streaming-pipeline-design.md`（2系統レビュー: コード突合 + 批判的設計レビュー。Blocker 2件〔新旧セッションのピンポン、停止スコープ〕・Major 5件を反映してv2改訂後に実装）。成果物: `src/features/chat/speechPipeline/`（SpeechSegmenter純粋状態機械 / messageLogWriter / speechDispatcher / consumeStream）、handlers.tsのファサード化（S16吸収、既存7呼び出し元・既存テスト無修正で通過）、キャンセレーション契約テスト（設計§6の7契約）。調査で発見した実バグ6件（D1停止後発話再開 / D2未完文のコード混入 / D3コード後テキスト表示欠落 / D4タグ持ち越し二重意味論 / D5チャンク跨ぎ```表示漏れ / D6 speakMessageHandler無限ループ）を修正。SpeakQueueへは追加的変更のみ（currentStopScope / finalizeIfIdle）。goToSlideをslideStoreへ移設。新規テスト65件、全1888テスト・lint・tsc（既存225エラーから増分ゼロ）・build・preview実機確認済み。
>
> **2026-07-08 完了後レビュー実施**（ブランチ全diffの精査 + segmenter状態機械のエッジケース実行検証）。Blockerなし。MAJOR 1件（C4タグ持ち越しの副作用でspeakMessageHandler正規化表示にタグが重複プレフィックスされる → `emotionTagExplicit` フラグ導入で修正）+ MINOR 4件のうち3件（audioクライアントの途中エラー握り潰し→controller.error伝播 / TextDecoder終端フラッシュ / 契約6-3テスト欠落）を修正（コミット `081b0a5c`）。残るMINOR 1件（abort時にバッファ済みPCMをflushする挙動）は旧実装のbreak経路と同一のためparityとして維持。全1903テスト・lint・tsc確認済み。
>
> F3は2026-07-08完了（コミット `b2a580ad`）。設計ドキュメント `docs/audio-mode-auth-design.md`（コード突合レビューでBlocker 1件〔pairsルートでのgate.guardServerSecret誤用〕・Major 2件〔WAFフィクスチャ更新、NDJSONアンチバッファリング〕を反映してv2改訂後に実装）。`dangerouslyAllowBrowser` を廃止し、サーバー中継ルート `/api/ai/audio`（pairs宣言・NDJSONストリーミング・切断時上流Abort）へ移行。audioモードがサーバー側キーで動作可能になりdemoモードで提供可能に。実機確認: サーバーキーのみ（クライアントキーなし）で `gpt-audio` モデルのtranscript+PCM16ストリーミングを確認。**注意1**: WAF反映には `apply-cloudflare-waf.yml` のマージ後手動実行が必要。**注意2**: アプリのデフォルトaudioモデル `gpt-4o-mini-audio-preview` は新しいAPIキーで404になる既存問題を発見（2026-07-08修正済み、詳細は「残課題メモ」の[[refactoring-roadmap#audioモードのOpenAIモデルID更新]]参照）。2026-07-08フォローアップでRealtime API用の短命client secret発行ルート `/api/ai/realtime-client-secret` を追加し、既存のOpenAI Realtime WebSocket接続を短命トークン認証へ移行。全1899テスト・lint・tsc・build確認済み。

| ID  | タスク                                     | 規模 | 状態    | 完了日 / PR | 備考                                                                                                                                           |
| --- | ------------------------------------------ | ---- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| F4  | ストリーミング応答パイプラインの状態機械化 | 大   | ✅ 完了 | 2026-07-08  | S16を包含。設計 `docs/streaming-pipeline-design.md`                                                                                            |
| F3  | audioモードの認証アーキテクチャ再構築      | 大   | ✅ 完了 | 2026-07-08  | サーバー中継方式。設計 `docs/audio-mode-auth-design.md`。Realtime APIは `/api/ai/realtime-client-secret` で短命client secret発行方式に移行済み |

### 包含済み（単独実施しない）

| ID  | タスク                                 | 状態        | 備考                               |
| --- | -------------------------------------- | ----------- | ---------------------------------- |
| S7  | ガード監査 + `usesServerSecret` 共通化 | 📎 F1に包含 | F1着手前のつなぎとして最小実施は可 |
| S16 | handlers.ts の機械的分割               | 📎 F4に包含 | 単独着手は非推奨（設計競合）       |

### 分割・順序の根拠

1. **作業量の均等化**: 各タスクを規模（小=1 / 中=2〜3 / 大=5〜8）で点数化し、各単位が8〜11点程度になるよう配分した。単位6のみ最重量（F×2）のため、必要なら6a/6bに分割する。
2. **B1, B2が先頭**: 実バグとユーザー可視の不具合は無条件で先。
3. **テスト（単位1・2）が全リファクタに先行**: セーフティネットなしのリファクタは退行検知ができない。
4. **F1が単位3**: セキュリティDDで最初に刺される箇所であり、F3がF1の成果物（ポリシーモデル）に依存する。
5. **依存関係**: S8 → S2（共通化後にテスト）、S9 → F4（インターフェース確定後に再設計）、F1 → F3（ポリシーモデル確定後に載せ替え）。
6. **単位5は並行可**: 影響が局所的で、単位3・4との設計競合がない。

---

## B: バグ修正（即対応）

### B1. TTS APIルートのレスポンス未送信バグ ★実バグ

- **内容**: `src/pages/api/cartesia.ts` と `src/pages/api/elevenLabs.ts` のエラーパス（APIキー欠落・voice ID欠落）が `new Response(JSON.stringify(...), { status: 400 })` を return している。Pages Router の Node.js ランタイムでは返り値の `Response` は無視されるため、クライアントにレスポンスが届かず**タイムアウトまでハングする**。
- **修正**: 他のTTSルート（`tts-google.ts` 等）と同じ `res.status(400).json(...)` パターンへ統一。両ルートのエラーブランチの回帰テストを追加（`src/__tests__/pages/api/tts-voicevox.test.ts` がテンプレート）。
- **再発防止**: `src/pages/api/**` を走査し「Nodeランタイムで `new Response` を return」する箇所が他にないか確認。同パターンを検出する静的テスト（grepベースのJestテスト）を追加する（S6と関連）。

### B2. 未翻訳エラーコード8件 + デバッグログ残留

- **内容**: `locales/ja/translation.json` の `Errors` ブロックに翻訳が存在しないエラーコードが8件ある: `AIServiceError`, `CustomAPIEmptyBody`, `CustomAPIInvalidRequest`, `EmptyAzureDeployment`, `InvalidAPIKey`, `OpenAITTSUpstreamError`, `ServerSecretAccessDenied`, `ServerSecretRateLimited`。特に後ろ2つは `src/lib/api-services/serverSecretGuard.ts:180-188` が発行するコードで、ガードがリクエストを拒否すると**トーストに生のキー文字列がそのまま表示される**。
- **あわせて**: `src/pages/api/ai/vercel.ts:163` 付近に残っている `console.log('options', options)`（本番ホットパスのデバッグ残留）を削除。
- **注意**: プロジェクトルール上、更新するのは `locales/ja/` のみ。

---

## F: 大規模再設計タスク

> このカテゴリのタスクは「何をするか」より「どう設計するか」が本体。部分的なパッチで着手すると、履歴上のhotfixチェーンと同じ轍を踏む。着手前に設計ドキュメントを書き、レビューを挟むこと。

### F1. デプロイ境界の統一アクセスポリシー設計（最優先）

- **内容**: 現在4つの防御機構が互いを知らずに併存している。
  1. `guardServerSecretAccess`（`src/lib/api-services/serverSecretGuard.ts`）— サーバー環境変数のAPIキー保護
  2. `isRestrictedMode`（`src/utils/restrictedMode.ts`）— サーバーレス環境向けファイルシステム機能の一括無効化
  3. `requireApiKey`（`src/features/api/http.ts`）— 外部制御API `v1/*` のみのBearer認証
  4. Cloudflare WAFルール（`.github/workflows/apply-cloudflare-waf.yml`）— リポジトリ外ロジックの第4層
     これを「**デプロイ文脈（self-host / demo / embed / kiosk / 外部API）× 呼び出し元 × リソース**」の単一ポリシーモデルに再設計し、全約40のAPIルートを移行、WAFルールも同じポリシー定義から導出する。
- **証拠**:
  - 2026-06-30〜07-01に約20連続のhotfixチェーン + revert 1回（`38296f0f` → `627bd431` → `f343c87b`）
  - その後embed用WAF許可の後追い修正5連発（`dad78a0c` 〜 `690fb6a1 Allow Safari embed API requests in demo mode`）
  - `tts-koeiromap.ts` は3機構いずれも未適用
  - ファイル書き込み系ルート（`upload-image.ts`, `upload-vrm-list.ts`, `update-pose-rotation.ts`, `delete-image.ts`, `memory-restore.ts`, `updateSlideData.ts`）は self-host 環境で実質無認可
  - `src/features/stores/home.ts:303-307` でサーバー用の `isRestrictedMode` がクライアントのstore購読に漏出
- **完了条件**: ポリシーモジュール1個 + 全ルートの分類表 + WAFワークフローが同一定義から生成 + デプロイ文脈ごとのテスト。新機能追加時にhotfixチェーンが構造的に再発しないこと。
- **備考**: 商用ライセンス販売・売却時のセキュリティデューデリジェンスで最初に精査される箇所。S7を包含する。

### F2. settingsストアのバージョン付きマイグレーション基盤

- **内容**: `src/features/stores/settings.ts`（441トップレベルキー）の persist 設定に `version`/`migrate` が存在しない。現在は `migratePersistedSettings` が毎起動時に古いフィールド名を文字列マッチで探す方式で、ユーザーのlocalStorageが「どの世代か」を知る手段がない。スキーマ駆動のバージョン付きマイグレーションパイプラインを設計し、`.env.example` の202個の `NEXT_PUBLIC_*` 変数と排他制御ルール（`exclusionRules.ts`）を同じスキーマから導出・検証する。
- **証拠**:
  - settings.ts は全履歴で**116タッチの最高チャーン `src` ファイル**
  - `migratePersistedSettings` のバグ修正が3連続（`dcef5cef`, `77917bae`, `00f24261`）
  - 古いマイグレーション分岐を消すと、長期間起動していないユーザーの設定が静かに壊れるリスクが恒久的に残る
- **完了条件**: バージョン番号付きマイグレーション（各世代のlocalStorageフィクスチャテスト付き）、`.env.example` がスキーマから生成され乖離がCIで検出される状態。
- **リスク**: 出荷済みユーザーのlocalStorageを壊すと数ヶ月後に他人の環境で顕在化する。機械的な移行は厳禁。

### F3. audioモードの認証アーキテクチャ再構築

- **内容**: `src/features/chat/openAIAudioChat.ts:26` が `dangerouslyAllowBrowser: true` でブラウザからOpenAI APIを直接呼んでおり、サーバーのセキュリティモデル（F1のガード群）を丸ごと迂回している。サーバー中継または ephemeral セッショントークン方式に作り直し、audioモード / Realtime API をF1のポリシーモデル配下に入れる。
- **証拠**: 他の全プロバイダーが `/api/ai/vercel` + ガード経由なのに対し、audioモードだけサーバー側 `OPENAI_API_KEY` が使えず、demoモードで提供不可、レート制限ゼロ。
- **完了条件**: audioモードがサーバー側キーで動作し、demoモードで提供可能になり、ガードのテストマトリクスに乗ること。
- **備考**: 厳密にはリファクタリングに加えて「demoモードでaudioが使えるようになる」という機能面の改善を伴う唯一のタスク。PCM16ストリーミング + function calling + Cloudflare Workersランタイム制約を壊さないこと。

### F4. ストリーミング応答パイプラインの状態機械化

- **内容**: `src/features/chat/handlers.ts`（1,284行）の `processAIResponse`（380〜778行、約400行）に絡み合った「トークンストリーム → 感情/モーションタグ解析 → 文分割 → コードブロック処理 → SpeakQueue投入 → スライド/WebSocket副作用」を、明示的なストリーム変換パイプライン + セッション/停止トークンの証明可能な状態機械として再設計する。
- **証拠**:
  - モジュールスコープの `externalSpeechLifecycleStates` Map（`handlers.ts:40`）
  - SpeakQueue のセッションID管理と停止トークンが3つの入力源（チャット / WebSocket / Realtime）に跨って暗黙結合
  - handlers.ts は全履歴36タッチで、新プロバイダー追加のたびに変更されている
- **完了条件**: パイプライン各段が独立テスト可能、停止/割り込みのキャンセレーション意味論がテストで固定され、`processAIResponse` が100行以下のオーケストレーションになること。
- **注意**: 単なるファイル分割（S12）では「競合バグの位置が変わるだけ」になる。危険地帯は並行セッション・中断/割り込みの意味論。ここを退行させないことが本体。

---

## S: 通常タスク

> 実行手順が明確で、既存のテンプレート/パターンを踏襲すれば安全に完了できるタスク。Sonnet級モデルへの委任や通常の開発フローで対応可能。

### テスト系（リファクタ前のセーフティネット）

#### S1. TTS APIルートの単体テスト追加

- 11エンジン中、ルートレベルのテストがあるのは voicevox / aivisspeech / google / openAITTS / stylebertvits2 のみ。**未テスト**: `cartesia.ts`, `elevenLabs.ts`, `azureOpenAITTS.ts`, `tts-koeiromap.ts`, `tts-aivis-cloud-api.ts`。
- `src/__tests__/pages/api/tts-voicevox.test.ts` をテンプレートに、成功パス / キー欠落パス / 上流エラーパス / `guardServerSecretAccess` のdemoモード分岐を検証。
- B1のバグはまさにこのテスト欠落が見逃した実例。

#### S2. クライアント側 `synthesizeVoice*.ts` の単体テスト追加

- 11エンジン中テストがあるのは `synthesizeVoiceGoogle.ts` と `synthesizeVoiceOpenAI.ts` のみ。残り9ファイル（`Cartesia`, `Elevenlabs`, `AzureOpenAI`, `AivisCloudApi`, `AivisSpeech`, `GSVI`, `Koeiromap`, `Voicevox`, `StyleBertVITS2`）+ `live2dHandler.ts` が未テスト。
- 正しいAPIルートへ正しいペイロードで呼ぶこと、エラーレスポンス処理を検証。S10（共通ヘルパー抽出）を先にやると、テストは「ヘルパー1式 + エンジンごとの薄いテスト」に圧縮できる。

#### S3. 外部制御API `v1/*` のテスト追加

- `v1/*`（chat / messages / commands / events / status / stop）は**最も新しく、最も攻撃者から到達しやすいサーフェスなのにテストがゼロ**。`requireApiKey` の認証分岐を含めてルートレベルのテストを追加。

#### S4. PNGTuberEngine の純粋関数テスト

- `src/features/pngTuber/pngTuberEngine.ts`（1,069行）の決定的・副作用なしのメソッド群（`computeAffine`, `applyCalibrationToQuad`, `hexToRGB`, `selectMouthState`/`selectMouthStateHQ`, `getVolumeThresholds` 系）にテストがない。
- アフィン行列は手計算例との照合、口形状選択はヒステリシス遷移を検証。canvasモックは `src/__mocks__` に既存。

#### S5. フック・Mastraワークフローのテスト補完

- 未テストのフック: `useDraggable.ts`, `useResizable.ts`, `useTheme.ts`（ドラッグ座標計算・matchMediaのモバイル判定・リサイズ差分）。
- `src/lib/mastra/` のYouTube会話継続ワークフロー（継続/新トピック/スリープ分岐）のステップ単位テストのギャップを列挙して補完。
- 既知の負債: `src/__tests__/hooks/usePresenceDetection.test.ts` に「useCallbackとモックのタイミング問題で失敗する」TODOが6件残っている。原因を解消してテストを有効化。

#### S6. テスト基盤の整備

- `guardServerSecretAccess` の4モード（disabled / protected / demo / unprotected）を模倣する共有テストヘルパー `mockServerSecretGuard()` を作成し、APIルートテストのボイラープレートを削減。
- 「Nodeランタイムルートで `new Response` を return」アンチパターンを検出する静的テストを追加（B1の再発防止）。
- `pnpm run test:coverage` の結果をCI/READMEに表面化（カバレッジの可視化）。

### 重複排除・共通化系

#### S7. `guardServerSecretAccess` 適用状況の監査と `usesServerSecret` 計算の共通化 【F1に包含】

- `elevenLabs.ts`, `cartesia.ts`, `azureOpenAITTS.ts`, `openAITTS.ts`, `embedding.ts`, `difyChat.ts`, `stylebertvits2.ts` 等が `usesServerSecret = (!body.apiKey && Boolean(process.env.X_KEY)) || ...` を各自微妙に異なる形で手書きしている。`(clientValue, envValue)` ペアのリストを取る共通ヘルパーに集約。
- `process.env.*_API_KEY` を読む全ルートがガードを通ることをgrepベースの静的テストで保証。
- **F1着手前のつなぎとして実施する場合は最小限に**。F1の設計が決まったらそちらに吸収される。

#### S8. TTS共通フェッチヘルパーの抽出

- 11個の `synthesizeVoice*.ts` は「fetch → res.ok確認 → arrayBuffer → サービス名付きエラーラップ」の同一パターンを30〜70行ずつ重複している。引数の形式もバラバラ（位置引数 vs 個別シグネチャ）。
- `synthesizeVoiceApi(endpoint, body, serviceName): Promise<ArrayBuffer>` 相当の共通ユーティリティに集約し、エンジン固有のバリデーションは各ファイルに残す。12個目のエンジン追加コストを下げる。

#### S9. CharacterRenderer 共通インターフェースの定義

- VRM（`vrmViewer/model.ts:85-115`）/ Live2D（`messages/live2dHandler.ts`）/ PNGTuber（`pngTuber/pngTuberHandler.ts`）の3実装は `speak(buffer, talk, isNeedDecode)` を**慣習のみ**で共有しており、`interface CharacterRenderer` がどこにも存在しない。
- `speakQueue.ts:164-172` と `speakCharacter.ts:454-462` に同一の `modelType` 分岐が重複。インターフェース定義 + dispatch一元化で、4つ目のモデルタイプ追加時の変更箇所を1箇所にする。
- 既知の非対称: PNGTuberHandler は `talk.emotion`/`talk.motion` を受け取るが無視している（`_talk`）。インターフェース化の際に「対応しない」ことを型で明示すること。

#### S10. ロガー統一

- `src` 全体に163箇所の `console.*` 呼び出しが散在（handlers.ts だけで24箇所）。env/デバッグフラグでゲートされる薄い `lib/logger.ts` を追加し、ファイル単位で置換。ブラウザコンソールへの内部状態リークの解消と、商用製品としての品質シグナル改善。

### 型・堅牢性系

#### S11. `any` の削減

- 44ファイルに `: any` が残存。strict モードの保証を損なっている上位: `youtubeComments.ts`, `vercelAIChat.ts`, `customApi.ts`（製品の核であるAIプロバイダー接合部に集中）。実際のSDK/レスポンス型に合わせて修正し `tsc --noEmit` で検証。

#### S12. ErrorBoundary の導入

- `src` に `ErrorBoundary` の使用が皆無。不正なモデルファイル等でThree.js/canvasが例外を投げるとReactツリー全体が落ちる。3つのビューア（VRM / Live2D / PNGTuber）のエントリポイントを再利用可能なErrorBoundaryでラップし、`toastStore` 経由でユーザー通知。

#### S13. `azureOpenAITTS.ts` のエンドポイント検証強化

- `deploymentName` をユーザー/環境変数由来の `endpoint` URLパスから無検証でパースしている（`pathParts[pathParts.indexOf('deployments') + 1]`）。`stylebertvits2.ts` が使っている `serverUrlGuard.ts` の `isHttpUrl`/`isAllowedConfiguredOrListedUrl` を適用し、`deploymentName` の文字種を制限。テストも追加。

#### S14. `.env.example` の整合性パス

- 全202個の `NEXT_PUBLIC_*` 変数と settingsStore のデフォルト値を突き合わせ、クライアント公開（`NEXT_PUBLIC_*`）とサーバー専用の接頭辞が実際のコードパスと一致しているか全プロバイダー分を確認。セルフホスト時の「キーが読まれない」混乱の主要因。

### 分割系（UI/UX不変が絶対条件）

#### S15. 設定画面コンポーネントの分割

- `character.tsx`（1,509行）、`voice.tsx`（1,366行）、`settings/index.tsx`（998行）を、既存の `modelProvider/` サブコンポーネント分割パターンに倣って分解。
- **UI/UXは一切変更しない**（プロジェクトルール）。previewツールで視覚回帰を確認しながら進めること。

#### S16. handlers.ts の機械的分割 【F4に包含 — 単独着手は非推奨】

- ベースライン案としては「責務ごと（メッセージディスパッチ / ツールコール処理 / TTSトリガ / エラーパス）に分割」だが、**F4を実施するならこのタスクは不要**。F4に先行して部分的に分割すると設計が競合するため、F4の設計ドキュメント完成後にその分割方針に従うこと。

### 作業単位3レビュー起源のフォローアップ

#### S17. `RoutePolicy.resources` の実行時検証

- **内容**: `src/lib/accessPolicy/types.ts` の `RoutePolicy.resources`（`ApiResource[]`）は現状、宣言のみで `withAccessPolicy.ts` のどのガード分岐からも参照されない純粋な記述メタデータ。新ルート追加時に `resources` を書き間違えても静的テスト・ランタイムいずれも検知できない。
- **証拠**: 2026-07-07の作業単位3完了後レビューで指摘。`update-voicevox-speakers.ts`/`update-aivis-speakers.ts` が `resources: [...'server-url']` を宣言しながら実際のURL検証が不足していた実例（この2件はレビュー後に即修正済み、[[refactoring-roadmap]] 作業単位3の備考参照）が、フィールドが不整合を防げていなかったことを示す。
- **完了条件**: 各 `ApiResource` 種別（`server-url` なら `serverUrl` 宣言か明示的な `serverUrlGuard` 呼び出しの存在、等）に対応する静的検証を追加。ただし `ai/custom.ts` のように意図的に検証しない `server-url` ルート（任意エンドポイント機能）を誤検知しないよう、許可リスト方式か `resources` に例外フラグを設けるかの設計判断が先行して必要。

#### S18. `SecretPolicy` の条件付きペア表現への拡張

- **内容**: `difyChat.ts` / `stylebertvits2.ts` / `ai/custom.ts` はいずれも「他フィールドが未指定の場合のみenvを見る」という同型の条件結合を持つが、`SecretPair` で宣言的に表現できず `secret.kind: 'dynamic'`（命令的エスケープハッチ）に逃げている。設計ドキュメント §4.1 もこれを「宣言的に表現できない」と認めた上での妥協。
- **リスク**: 次に同種の条件付きシークレット解決を持つルートを追加する開発者が、モデル拡張の動機を持たず同じ `dynamic` バイパスをコピーし続け、宣言的ポリシーモデルの意義が徐々に空洞化する。
- **完了条件**: `SecretPair` に `onlyIfAbsent`/`onlyIfPresent` 相当の条件を追加できるか検討し、対象3ルートを宣言的表現に載せ替える。既存の `dynamic` ルート用テスト（`gate.guardServerSecret()` 呼び出し検証）と等価な保証を維持すること。

---

## 残課題メモ（このロードマップの本流とは別件）

### audioモードのOpenAIモデルID更新（2026-07-08、developにコミット済み）

`defaultModels.openaiAudio` / `openAIAudioModels`（`gpt-4o-*-audio-preview`）が新しいAPIキーで404 `model_not_found` になる問題を修正し、`gpt-audio` / `gpt-audio-mini` 系へ更新した（コミット `3d3cf14c`）。設定マイグレーション（version 5）で旧モデル名保存済みユーザーも自動移行する。

- **検証済み**: 2026-07-08に`.env.local`のOpenAI APIキーで `models.list` を実行し、`gpt-audio` / `gpt-audio-mini` / `gpt-audio-2025-08-28` / `gpt-audio-mini-2025-10-06` が取得可能であることを確認。公式ドキュメントとAPI一覧に合わせて `gpt-audio-1.5` / `gpt-audio-mini-2025-12-15` も選択肢へ追加した。デフォルトは挙動・コスト変更を避けるため `gpt-audio-mini` のまま維持。
- **追加検証**: Realtime APIの短命client secret発行は `POST /v1/realtime/client_secrets` で実API確認済み。対象差分は `pnpm run lint:fix`、対象ファイルPrettier、該当テスト、全テスト、buildで確認済み。

---

## 補足: 分類の根拠

- **F系がFカテゴリである理由**: いずれも「局所的には正しい判断が横断的に矛盾している」構造問題で、部分パッチでは解決しない。git履歴（hotfixチェーン、revert、同一ファイルへの連続修正）がその証拠。
- **S系がSカテゴリである理由**: 既存のテンプレート・パターン（テスト雛形、`modelProvider/` 分割前例、`serverUrlGuard` 前例）を踏襲すれば完了でき、失敗しても影響が局所的。
- **機能追加は含まれない**: 本ロードマップは全項目がリファクタリング / バグ修正 / テスト負債返済 / セキュリティ堅牢化であり、新機能はゼロ。唯一F3のみ、再設計の副産物として「demoモードでaudioモードが提供可能になる」という機能面の改善を伴う。
