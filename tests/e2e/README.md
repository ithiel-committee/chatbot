# E2E Testing

AITuberKit の E2E テストは Playwright で実行します。設定は `playwright.config.ts`、テスト本体は `tests/e2e/*.spec.ts` に配置します。

## 初回セットアップ

E2E はプロジェクト標準の Node.js `24.x` と pnpm `^10.20.0` で実行します。ローカルで Node.js を切り替える場合は `.nvmrc` を使ってください。

```bash
nvm use
corepack enable
node --version
pnpm --version
```

```bash
pnpm install
pnpm run test:e2e:install
```

Linux CI やブラウザ実行に必要な OS 依存もまとめて入れる場合は次を使います。

```bash
pnpm run test:e2e:install:with-deps
```

## ローカル実行

通常のヘッドレス実行です。

```bash
pnpm run test:e2e
```

通常実行では `chromium` project が desktop spec を、`mobile-chromium` project が `*.mobile.spec.ts` の最小 smoke を実行します。現在のテスト件数は `pnpm exec playwright test --list` で確認してください。既存の desktop spec は mobile project では実行しません。

ブラウザを表示して動きを確認する場合は headed 実行を使います。

```bash
pnpm run test:e2e:headed
```

Playwright の UI モードでテストを選択・再実行する場合は次を使います。

```bash
pnpm run test:e2e:ui
```

ステップ実行やセレクタ確認をしながら調査する場合は debug 実行を使います。

```bash
pnpm run test:e2e:debug
```

特定ファイルだけを実行する場合は、pnpm script の後ろに Playwright の引数を渡します。

```bash
pnpm run test:e2e -- tests/e2e/youtube-mode.spec.ts
pnpm run test:e2e:headed -- tests/e2e/game-commentary-mode.spec.ts
```

mobile smoke だけを実行する場合は project を指定します。

```bash
pnpm run test:e2e -- --project=mobile-chromium
```

production mode 相当の smoke は、通常の E2E から分離しています。`E2E_MODE=production` を指定すると `next build && next start` でサーバーを起動し、`*.production.spec.ts` だけを `production-chromium` project で実行します。現在のテスト件数は `E2E_MODE=production pnpm exec playwright test --list` で確認してください。

```bash
pnpm run test:e2e:production
```

## 開発サーバー

Playwright は `webServer` 設定で `node scripts/start-e2e-server.js` を起動します。ローカルでは既存サーバーを再利用し、CI では毎回起動します。

デフォルトの URL は `http://127.0.0.1:3100` です。ポートを変える場合は `E2E_PORT` を指定します。

```bash
E2E_PORT=3200 pnpm run test:e2e
```

production smoke では既存サーバーを再利用しません。dev server を誤って production smoke として検証しないため、`E2E_MODE=production` 実行時は専用ポートを使うことを推奨します。

```bash
E2E_PORT=3201 pnpm run test:e2e:production
```

E2E 用サーバーでは次の初期値を固定しています。

- `NEXT_PUBLIC_SHOW_INTRODUCTION=false`
- `NEXT_PUBLIC_MODEL_TYPE=pngtuber`
- `NEXT_PUBLIC_SELECTED_PNGTUBER_PATH=/pngtuber/nike01`

起動時には `process.execPath`、`process.version`、platform / arch、`NEXT_TEST_WASM`、npm/pnpm user agent をログに出します。CI や Codex 環境で Next.js の SWC 読み込みに失敗した場合は、まずこのログで想定どおり Node.js `24.x` が使われているか確認してください。

テスト側でも `tests/e2e/helpers/app.ts` で localStorage とメディア API を初期化し、外部 API キーや実デバイスに依存しない状態にしています。`setupTestNetwork` は TTS / embedding / save-chat-log など副作用のある API を mock し、必要に応じて API / 外部リクエストの diagnostics を記録できます。

## SWC エラーの切り分け

macOS やエージェント環境で Next.js の native SWC が code signature などの理由で読み込めない場合は、次の順で確認します。

```bash
node --version
pnpm --version
node scripts/start-e2e-server.js
```

`node --version` が `24.x` でない場合は `.nvmrc` に合わせて Node.js を切り替えてから再実行します。Node.js が正しいのに native SWC だけが失敗する場合は、一時的な切り分けとして WASM 版 SWC を使って E2E を実行できます。

```bash
NEXT_TEST_WASM=1 pnpm run test:e2e
```

`Attempted to load @next/swc-wasm-nodejs, but it was not installed` が出る場合は、現在の `node_modules` では WASM 版 SWC の回避を使えません。この回避は原因調査用です。通常のローカル実行と CI では Node.js `24.x` / pnpm `^10.20.0` と native SWC を前提にします。

## レポートと失敗時の確認

CI では GitHub reporter と HTML report を出力します。ローカルで HTML report を開く場合は次を使います。

```bash
pnpm run test:e2e:report
```

失敗時はスクリーンショットが保存されます。リトライが発生した場合は trace も保存されるため、Playwright の出力に表示される trace zip を `pnpm exec playwright show-trace <trace.zip>` で確認します。

## CI 運用

GitHub Actions では `Run Tests` workflow の `e2e` job が E2E を実行します。CI は Node.js `24.x` を `actions/setup-node` で固定し、pnpm を使用して検証します。

CI では次の順で実行します。

```bash
corepack enable
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm run test:e2e:install:with-deps
pnpm run test:e2e -- --list
pnpm run test:e2e
pnpm run test:e2e:production -- --list
E2E_PORT=3201 pnpm run test:e2e:production
```

`CI` 環境変数が設定されている場合、Playwright は失敗時に最大 2 回リトライし、HTML report は自動で開きません。CI の artifact には `playwright-report/` と `test-results/` を保存します。通常 E2E は `playwright-report-e2e` / `playwright-test-results-e2e`、production smoke は `playwright-report-e2e-production` / `playwright-test-results-e2e-production` から確認します。

## テスト追加時の注意

- テストは `tests/e2e/*.spec.ts` に追加します。
- 共通の起動準備は `tests/e2e/helpers/app.ts` に寄せます。
- 外部 API キー、カメラ、画面共有などの実環境に依存する処理は mock または固定入力にします。
- 画像添付などファイル入力が絡む導線は、小さな data URL または fixture を使い、外部 API には送信しません。
- UI の探索だけでなく、永続化される設定は localStorage の値も確認します。

## 現在のカバレッジ

現時点の E2E は、主要な設定保存と外部 API を使わないユーザーフローのスモークテストを目的にしています。

- `chat-flow.spec.ts`: チャット入力、送信、AI 応答 mock、payload、画像添付の multimodal payload、chatLog 永続化
- `youtube-mode.spec.ts`: YouTube モード設定、API/OneComme 切替、再生トグル
- `game-commentary-mode.spec.ts`: ゲーム実況モード設定、キャプチャ再生トグル
- `settings-modes.spec.ts`: Idle / Presence 設定保存、Realtime API / Audio mode 排他制御
- `kiosk-mode.spec.ts`: Kiosk 設定保存、overlay 表示、入力文字数制限、NG ワード送信ブロック、passcode 一時解除、3 回失敗 lockout、lockout 復元
- `slide-mode.spec.ts`: Slide folder mock、Slide mode ON / OFF、selectedSlideDocs 永続化、slide 表示、next / previous、表示切替
- `helpers-foundation.spec.ts`: localStorage seed、network mock、diagnostics helper の基盤確認
- `mobile-smoke.mobile.spec.ts`: mobile Chromium で起動、チャット入力、設定タブ dropdown、Kiosk overlay を確認
- `production-smoke.production.spec.ts`: `E2E_MODE=production` で production app shell、チャット入力、設定パネルを確認

Project 分離はファイル名で行います。通常 desktop project は `*.mobile.spec.ts` と `*.production.spec.ts` を除外した `*.spec.ts` を実行します。mobile project は `*.mobile.spec.ts` のみ、production project は `*.production.spec.ts` のみを実行します。そのため `slide-mode.spec.ts`、`chat-flow.spec.ts` の multimodal test、`kiosk-mode.spec.ts` の unlock / lockout test は通常 desktop project にだけ含まれます。

この状態は「E2E を増やせる土台」としては十分ですが、リリース品質を担保する網羅にはまだ不足があります。

## Next Actions

### 完了: CI で E2E を安定実行する

目的: E2E をローカル確認だけでなく、PR / main branch の品質ゲートとして使える状態にする。

対応済み:

- GitHub Actions の `Run Tests` workflow に `e2e` job を追加する。
- CI では `pnpm install --frozen-lockfile`、`pnpm run test:e2e:install:with-deps`、`pnpm run test:e2e` の順で実行する。
- Playwright report / trace / screenshot を artifact として保存する。
- CI 上の Node.js は `24.x`、pnpm は `^10.20.0` に固定する。
- production smoke は `e2e-production` job で `pnpm run test:e2e:production` として通常 E2E から分離して実行する。

完了条件:

- CI 上で E2E が安定して通る。
- 失敗時に HTML report と trace を確認できる。
- E2E 失敗が PR の失敗として扱われる。

### 完了: E2E サーバー起動環境を固定する

目的: `scripts/start-e2e-server.js` が実行環境の Node.js 差異に引きずられないようにする。

背景:

- Codex 内蔵 Node などで実行すると、Next.js の native SWC が macOS code signature エラーで読み込めない場合があります。
- 一時回避として `NEXT_TEST_WASM` と `@next/swc-wasm-nodejs` を使えますが、通常運用ではプロジェクト要件に合う Node.js で起動するのが前提です。

対応済み:

- README に Node.js `24.x` と pnpm `^10.20.0` を前提として明記する。
- CI では `actions/setup-node` で Node.js を固定する。
- ローカルで SWC エラーが出る場合の切り分け手順を README に追記する。
- `scripts/start-e2e-server.js` で起動時の `process.execPath` と `process.version` をログ出力する。

完了条件:

- `pnpm run test:e2e` で Next dev server が安定起動する。
- SWC 起動エラー時の原因切り分けが README だけでできる。

### P1: Kiosk の解除・ロックアウトを追加する

Status: 完了。`kiosk-mode.spec.ts` で passcode dialog の起動、正しい passcode による一時解除、3 回失敗時の lockout、`aituber-kiosk-lockout` localStorage からの復元を検証しています。

目的: Kiosk mode の安全制御を UI 経由で検証する。

追加候補:

- `kioskModeEnabled: true` の初期状態で `kiosk-overlay` が表示される。
- `kiosk-multi-tap-zone` の複数クリックで passcode dialog が開く。
- 正しい passcode で一時解除され、設定ボタンへアクセスできる。
- 間違った passcode を 3 回入力すると lockout 表示になる。
- `aituber-kiosk-lockout` の localStorage 状態で lockout が復元される。

注意:

- 30 秒の lockout 解除待ちは E2E では避ける。
- lockout state は localStorage または fake clock で検証する。
- fullscreen API はブラウザ制約で不安定なので、通常の Kiosk E2E では mock する。

### P1: Slide モードの E2E を追加する

Status: 完了。`slide-mode.spec.ts` で `/api/getSlideFolders` と markdown 変換を mock し、Slide mode と selectedSlideDocs の保存、slide 表示、next / previous、表示切替を検証しています。

目的: プレゼンテーション機能の基本導線を検証する。

追加候補:

- `/api/getSlideFolders` を mock して slide folder を固定する。
- `slideMode` の ON / OFF と `selectedSlideDocs` の保存を確認する。
- slide 表示領域が描画されることを確認する。
- 可能なら next / previous / play / stop の操作を確認する。

事前作業:

- スライド操作ボタンに `data-testid` または明確な `aria-label` を追加する。
- Slide タブを開く前に `/api/getSlideFolders` を route mock する。

### Done: 画像添付チャットの基本導線

目的: マルチモーダル入力の基本導線を検証する。

実装済み:

- 小さな PNG data URL を `paste` して画像プレビューを表示する。
- `/api/ai/vercel` payload に text + image content が含まれることを確認する。
- TTS / embedding / save-chat-log / 外部 fetch は mock する。

残りの拡充候補:

- drop 操作、画像削除、非 multimodal モデル時のエラー表示を追加する。

### Done: Mobile viewport を追加する

目的: desktop だけでなく、モバイル用設定タブ UI と入力導線を検証する。

対応済み:

- `playwright.config.ts` に mobile Chromium project を追加する。
- 設定タブのモバイル dropdown 操作 helper を追加する。
- `*.mobile.spec.ts` のみを mobile project に割り当て、既存の desktop spec が mobile で大量実行されないようにする。

現在の smoke:

- 最低限、起動、設定パネル表示、チャット入力、Kiosk overlay が mobile project で通る。

### Done: 本番ビルド相当の E2E を追加する

目的: `next dev` では見つからないビルド・配信時の問題を検出する。

対応済み:

- `E2E_MODE=production` で `next build && next start` を起動する `production-chromium` project を追加する。
- `*.production.spec.ts` のみに絞り、通常の `pnpm run test:e2e` からは分離する。

現在の smoke:

- production mode で起動、チャット入力表示、設定パネル表示が通る。

### P2: 監視対象を増やす

追加候補:

- Presence detection の camera mock と状態遷移
- Memory / RAG のファイル restore と embedding mock
- Idle mode の countdown 表示
- API route の失敗時 toast / error 表示
- 外部リンク / WebSocket / message receiver の限定的な smoke test

## 優先順位

次に着手する順番は以下を推奨します。

1. CI で E2E を実行する。
2. E2E サーバー起動環境と SWC エラーの切り分けを文書化する。
3. Kiosk unlock / lockout を追加する。
4. Slide mode と画像添付チャットを追加する。
5. Presence / Memory / Idle などの監視対象を増やす。
