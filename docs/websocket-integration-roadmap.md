# WebSocket外部連携 改修計画

## 目的

AITuberKitの外部連携モードを、既存機能を壊さずにリッチなWebSocket連携基盤へ更新する。

現行実装は `ws://localhost:8000/ws` に接続し、シンプルなJSONメッセージを送受信する構成である。テキスト、画像、ストリーミング応答、server initiated message などの基礎機能はあるが、接続状態、再接続、heartbeat、ack/error、cancel、プロトコルバージョン管理が不足している。

サーバー側は `tegnike/aituber-server` が現行の連携先である。現行ドキュメントも `tegnike/aituber-server` を参照している。

## 方針

既存機能は互換レイヤーとして残しつつ、内部構造は一新する。

完全に既存実装へ積み増すのではなく、新しい `v2` プロトコルと外部連携専用WebSocket client/storeを追加する。既存の送受信形式は `v1 legacy` として受け付け、段階的に `v2` へ移行する。

この方針にする理由は次のとおり。

- 現行機能を使っている既存ユーザーを壊さない
- 外部連携WebSocketとOpenAI/Azure Realtime API WebSocketの責務混在を解消できる
- server側の応答生成を交換可能なagent backendへ整理できる
- プロトコルを明示することで、今後の機能追加とテストが容易になる

## 現行仕様

### AITuberKit側

外部連携モードON時、フロントエンドは固定URL `ws://localhost:8000/ws` に接続する。

送信形式:

```json
{
  "content": "ユーザーのメッセージ",
  "type": "chat",
  "image": "data:image/png;base64,..."
}
```

受信形式:

```json
{
  "text": "アシスタントの応答",
  "role": "assistant",
  "emotion": "neutral",
  "type": "",
  "image": "data:image/png;base64,..."
}
```

`type` は主に次の用途で使われている。

- `start`: 応答開始
- `end`: 応答終了
- 空文字またはその他: 通常メッセージ

`role` が `assistant` の場合、受信テキストはチャットログに表示され、TTS再生される。`output`、`executing`、`console` は表示上 `code` として扱われる。

### server側

現行serverはFastAPIで構成されている。

- `WS /ws`: AITuberKitとのWebSocket接続
- `POST /send_message`: 接続中のクライアントへメッセージ送信
- `GET /`: 疎通確認

主な機能は次のとおり。

- WebSocketで `chat` メッセージを受信
- agent backendへ入力
- stream chunkをAITuberKitへ送信
- `file` メッセージを受信して `./workspace` に保存
- 保存済みファイルパスを次回指示に混ぜる
- `POST /send_message` からAITuberKitへserver initiated messageを送る

## 新プロトコル

新しいWebSocketメッセージは、共通envelopeを持つ `v2` 形式にする。

```json
{
  "version": "2",
  "id": "msg_...",
  "type": "chat.message",
  "sessionId": "session_...",
  "timestamp": "2026-06-20T00:00:00.000Z",
  "payload": {},
  "metadata": {}
}
```

### 必須フィールド

- `version`: プロトコルバージョン
- `id`: メッセージID
- `type`: イベント種別
- `sessionId`: 会話または接続セッションID
- `timestamp`: ISO 8601形式の発生時刻
- `payload`: イベント本体

### 任意フィールド

- `metadata`: UI表示、送信元、互換情報などの補助情報
- `requestId`: 応答、ack、error、cancel の対応付けに使うID

## イベント種別

初期実装では次のイベントを扱う。

| type             | 方向             | 用途                   |
| ---------------- | ---------------- | ---------------------- |
| `session.hello`  | client -> server | 接続開始時の機能交渉   |
| `session.ready`  | server -> client | server準備完了         |
| `chat.message`   | client -> server | ユーザー入力           |
| `chat.start`     | server -> client | 応答開始               |
| `chat.delta`     | server -> client | ストリーミング断片     |
| `chat.done`      | server -> client | 応答終了               |
| `chat.error`     | server -> client | 応答単位のエラー       |
| `media.image`    | bidirectional    | 画像送受信             |
| `file.upload`    | client -> server | ファイル送信           |
| `control.cancel` | client -> server | 実行中処理のキャンセル |
| `ping`           | bidirectional    | heartbeat              |
| `pong`           | bidirectional    | heartbeat応答          |

## 互換方針

`v1 legacy` の形式は当面維持する。

client側では、serverが `session.ready` を返す場合は `v2` として扱う。返さない場合は既存の `v1` 形式で送受信する。

server側では、受信メッセージに `version: "2"` がない場合は `v1` と見なし、内部で `v2` に正規化する。

`v1` から `v2` への変換例:

```json
{
  "content": "こんにちは",
  "type": "chat"
}
```

```json
{
  "version": "2",
  "type": "chat.message",
  "payload": {
    "text": "こんにちは"
  },
  "metadata": {
    "legacyType": "chat"
  }
}
```

## AITuberKit側の実装計画

### 1. 外部連携専用WebSocket client/storeを追加

現在の `webSocketStore` は外部連携とRealtime APIで共有されている。これを分離し、外部連携専用の状態管理を追加する。

管理する状態:

- 接続URL
- 接続状態
- プロトコルバージョン
- 最終接続時刻
- 最終エラー
- 再接続回数
- heartbeat状態
- server capabilities

### 2. 接続URLを設定化

固定の `ws://localhost:8000/ws` を設定値に移す。

候補:

- `externalLinkageUrl`
- 環境変数 `NEXT_PUBLIC_EXTERNAL_LINKAGE_URL`
- 設定画面の入力項目

初期値は互換性のため `ws://localhost:8000/ws` とする。

### 3. プロトコル変換層を追加

UIやチャット処理は既存の抽象に近い形を保ち、WebSocket送受信前後で `v1` / `v2` を変換する。

これにより、チャット表示、TTS、画像表示、既存テストへの影響を抑える。

### 4. UIを拡張

外部連携設定に次を追加する。

- 接続URL
- 接続状態
- 再接続ボタン
- protocol version
- server capabilities
- 最終エラー

既存UIの見た目は大きく変えず、設定パネル内に必要な運用情報を追加する。

## server側の実装計画

### 1. WebSocket接続管理を分離

現在はrouter内に接続管理がある。次の責務に分ける。

- connection manager
- protocol parser
- message dispatcher
- agent backend
- broadcast service

### 2. `v2` protocol schemaを追加

Pydantic modelで `v2` envelopeとpayloadを定義する。

server内部では全メッセージを `v2` として扱い、`v1` は入力境界で変換する。

### 3. agent backendを交換可能にする

応答生成をbackend interfaceの背後に分離する。

初期backend:

- echo backend
- slow echo backend

これにより、server単体の疎通確認やテストが外部AI実装に依存しなくなる。

### 4. `POST /send_message` を維持

既存のHTTP送信APIは残す。

ただし内部では `chat.message` またはserver initiated messageの `v2` eventとして扱う。

### 5. file uploadを整理

既存の `file` メッセージは `file.upload` に移行する。

保存先、ファイル名、MIME type、サイズ、base64 bodyを明示する。

## 実装ステップと状態

| Phase | 内容                                                            | 状態 |
| ----- | --------------------------------------------------------------- | ---- |
| 1     | 外部連携専用WebSocket client/store分離                          | 完了 |
| 2     | `v2` protocol追加と `v1 legacy` 互換                            | 完了 |
| 3     | heartbeat / reconnect / ack / cancel / 接続状態UI               | 完了 |
| 4     | server connection manager / protocol parser / agent backend分離 | 完了 |
| 5     | ドキュメント、移行手順、実サーバー疎通確認                      | 完了 |

## 実装進捗

### 2026-06-20 時点

完了:

- AITuberKit側に外部連携専用WebSocket manager/storeを追加
- 外部連携送受信をRealtime API用 `webSocketStore` から分離
- 外部連携URLを `externalLinkageUrl` / `NEXT_PUBLIC_EXTERNAL_LINKAGE_URL` として設定化
- 外部連携設定UIに接続URL、接続状態、プロトコル、再接続回数、最終エラー、再接続ボタンを追加
- AITuberKit側に `v1 legacy` 送信payload生成と `v1` / `v2` 受信正規化レイヤーを追加
- server側に `v2` envelope schema、`v1` input正規化、`session.hello` / `session.ready`、`v2` 応答送信ヘルパーを追加
- server側の既存 `v1` クライアントには従来JSONで返す互換を維持
- AITuberKit側に `session.ready` 検知、`ping` 送信、`pong` 受信、ack記録、cancel送信、再接続backoffを追加
- AITuberKit側に `session.ready` 後の `session.hello` 送信を追加
- server側に connection manager を分離
- server側に接続直後の `session.ready`、`ack`、`ping` / `pong`、`control.cancel` 受信処理を追加
- server側に `AgentBackend` interface、`EchoAgentBackend`、`SlowEchoAgentBackend` を追加
- 応答生成のstream実行をbackend層へ分離
- server側の `POST /send_message` を内部 `server.message` eventへ変換し、接続protocolに応じてlegacyまたは `chat.start` / `chat.delta` / `chat.done` へ展開
- server側の受信ループとagent stream処理を分離し、`control.cancel` が実行中taskへ届く構造へ変更
- AITuberKit側にrequest単位の `sent` / `acknowledged` / `completed` / `error` 状態管理を追加
- 外部連携設定UIに最終request ID、request状態、最終ACK時刻、request errorを表示
- server側からOpen Interpreter依存とbackendを削除
- server `requirements.txt` をFastAPI/WebSocket serverに必要な最小構成へ削減
- Docker composeからobsoleteな `version` を削除し、`AITUBER_SERVER_BACKEND` をcontainerへ渡すように変更

検証済み:

- AITuberKit targeted Jest
- AITuberKit targeted ESLint
- AITuberKit `pnpm build`
- server protocol/websocket helper pytest
- server agent backend pytest
- server websocket session service cancel pytest
- server `python -m compileall app tests`
- echo backendでの実WebSocket smoke
  - `session.ready`
  - `session.hello` / `ack`
  - `chat.message` / `ack` / `chat.start` / `chat.delta` / `chat.done`
  - `ping` / `pong`
  - `POST /send_message` からのv2 `chat.start` / `chat.delta` / `chat.done`
- Docker build
- Docker compose上のslow echo backendでの実WebSocket cancel smoke
  - `chat.message` / `ack`
  - `chat.delta`
  - `control.cancel` / `ack`
  - `chat.done` with `cancelled: true`

実サーバー疎通確認の状態:

- Open Interpreter依存削除とrequirements削減後、Docker buildは成功
- 空き容量回復後、一時venvにFastAPI/uvicorn/websocketsを入れて `AITUBER_SERVER_BACKEND=echo` でserverを起動し、実WebSocket smokeは成功
- smoke後にclient切断時のASGI RuntimeErrorを確認したため、WebSocketDisconnect処理を修正し、再smokeで切断時エラーが消えたことを確認
- Docker compose上で `AITUBER_SERVER_BACKEND=slow_echo` を使い、実WebSocket cancel smokeが成功

未着手または未完了:

- なし

## 現在の実装マップ

### AITuberKit

| 領域              | ファイル                                                  | 役割                                                                       |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| WebSocket manager | `src/utils/ExternalLinkageWebSocketManager.ts`            | 外部連携専用WebSocketの接続、切断、送信、イベント通知                      |
| Zustand store     | `src/features/stores/externalLinkageWebSocketStore.ts`    | 接続状態、protocol version、capabilities、heartbeat、ack、再接続状態を保持 |
| Protocol helper   | `src/features/externalLinkage/externalLinkageProtocol.ts` | `v1 legacy` payload生成、`v2` envelope生成、受信message正規化              |
| Connection hook   | `src/components/useExternalLinkage.tsx`                   | 外部連携ON時の接続開始、受信処理、heartbeat、reconnect backoff             |
| Chat send         | `src/features/chat/handlers.ts`                           | protocol versionに応じて `v1` または `v2 chat.message` を送信              |
| Settings UI       | `src/components/settings/externalLinkage.tsx`             | URL、接続状態、protocol、heartbeat、再接続、cancel操作を表示               |
| Settings store    | `src/features/stores/settings.ts`                         | `externalLinkageUrl` と環境変数初期値を管理                                |
| Env sample        | `.env.example`                                            | `NEXT_PUBLIC_EXTERNAL_LINKAGE_URL` を定義                                  |
| i18n              | `locales/ja/translation.json`                             | 外部連携UIの日本語文言を追加                                               |

### server

| 領域                      | ファイル                                                           | 役割                                                                  |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Protocol schema           | `tegnike/aituber-server:app/protocol.py`                           | `v2` envelope、ack生成、`v1` input正規化                              |
| Connection manager        | `tegnike/aituber-server:app/connection_manager.py`                 | 接続一覧、protocol version、接続直後の `session.ready`、broadcast管理 |
| WebSocket service         | `tegnike/aituber-server:app/services/websocket_service.py`         | `v1` / `v2` 応答送信、`chat.start` / `chat.delta` / `chat.done` 変換  |
| WebSocket session service | `tegnike/aituber-server:app/services/websocket_session_service.py` | 受信message dispatch、ack、ping/pong、cancel、backend stream実行      |
| Agent backend             | `tegnike/aituber-server:app/agent_backends.py`                     | `EchoAgentBackend` と `SlowEchoAgentBackend` の切替                   |
| Router                    | `tegnike/aituber-server:app/routers/base.py`                       | 分離したconnection managerを利用                                      |

## `v2` 利用例

clientからの入力:

```json
{
  "version": "2",
  "id": "msg_client_001",
  "type": "chat.message",
  "sessionId": "session_client_001",
  "timestamp": "2026-06-20T00:00:00.000Z",
  "payload": {
    "text": "こんにちは",
    "image": "data:image/png;base64,..."
  }
}
```

serverからのack:

```json
{
  "version": "2",
  "type": "ack",
  "requestId": "msg_client_001",
  "payload": {
    "requestId": "msg_client_001",
    "type": "chat.message",
    "status": "ok"
  }
}
```

serverからのstream応答:

```json
{
  "version": "2",
  "type": "chat.delta",
  "payload": {
    "text": "応答テキスト",
    "role": "assistant",
    "emotion": "neutral"
  }
}
```

## 運用上の切替

AITuberKit側の接続先は `externalLinkageUrl` で管理する。環境変数では次を使う。

```env
NEXT_PUBLIC_EXTERNAL_LINKAGE_URL=ws://localhost:8000/ws
```

server側は通常 `EchoAgentBackend` を使う。cancel確認では、次の環境変数でslow echo backendに切り替える。

```env
AITUBER_SERVER_BACKEND=slow_echo
```

echo backendは受け取ったmessageを `Echo: ...` として返す。slow echo backendは最初のchunk送信後にcancelまで待機するため、WebSocket接続、protocol変換、cancel確認に使う。

### Phase 1: 基盤分離

- AITuberKitに外部連携専用client/storeを追加
- 既存外部連携モードを新clientへ接続
- 現行 `v1` protocolのまま動作確認
- Realtime API用WebSocketとの共有状態を解消

### Phase 2: `v2` protocol追加

- AITuberKitに `v2` envelope生成とparserを追加
- serverに `v2` schemaと `v1` 互換parserを追加
- `session.hello` / `session.ready` でcapability negotiationを実装
- `v2` 対応serverでは `v2` を優先

### Phase 3: リッチ連携

- heartbeat
- reconnect backoff
- ack/error
- cancel
- server capabilities表示
- 接続URL設定
- 接続状態UI

### Phase 4: server再構成

- connection managerを分離
- protocol parserを分離
- echo backendを追加
- slow echo backendを追加
- `POST /send_message` を `v2` 内部イベントへ移行

### Phase 5: ドキュメントと移行

- AITuberKit側の外部連携設定ドキュメントを更新
- server READMEを更新
- `v1 legacy` と `v2` の利用例を掲載
- 将来的な `v1` 廃止条件を明記

## 検証計画

### 自動テスト

AITuberKit:

- `v1` 送信payload生成
- `v2` 送信payload生成
- `v1` 受信payload parsing
- `v2` 受信payload parsing
- `chat.delta` の追記表示
- `chat.done` で `chatProcessing` が解除されること
- 画像付きメッセージの保持
- 切断時のエラー通知

server:

- `v1` inputを `v2` eventへ変換
- `v2` inputをschema validation
- connection managerの接続・切断
- `POST /send_message`
- echo backend
- `file.upload`

### 手動確認

- server起動
- AITuberKitで外部連携ON
- テキスト往復
- stream応答
- 画像付き送信
- 画像付き受信
- server initiated message
- 切断からの再接続
- 実行中cancel

## 残す機能

次の機能は互換維持対象とする。

- `ws://localhost:8000/ws` への接続
- `{ content, type: "chat", image? }` 送信
- `{ text, role, emotion, type, image? }` 受信
- `start` / `end` によるストリーミング制御
- assistant応答のTTS再生
- 画像付きメッセージ
- file保存
- `POST /send_message`

## 作り直す部分

次は積み増しではなく作り直す。

- 外部連携WebSocketの状態管理
- Realtime APIとのWebSocket共有構造
- 接続URL固定
- 再接続処理
- protocol parsing
- server側の接続管理
- 応答生成とWebSocket session処理の密結合

## 移行と今後の拡張

`v1 legacy` は当面維持する。

廃止を検討できる条件:

- AITuberKitの標準連携先が `session.ready` を返す `v2` serverになっている
- `v1 legacy` しか扱えない外部server利用者向けに、移行期間と移行例を案内できている
- `POST /send_message`、画像送受信、file upload、cancelの `v2` 利用例がREADMEまたはdocsに揃っている

今後の拡張候補:

- 実運用向けAgentBackendの追加
- `file.upload` のMIME type、size、保存先制御の強化
- server capabilitiesに応じたAITuberKit側UI制御
- request履歴の複数件表示
