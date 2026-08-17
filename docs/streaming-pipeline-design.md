# ストリーミング応答パイプライン 状態機械化 設計ドキュメント

作成日: 2026-07-08（作業単位6 / F4。S16を包含）
改訂: v2 — 2系統レビュー（コード突合 / 批判的設計レビュー）のBlocker 2件・Major 5件を反映

## 1. 課題

`src/features/chat/handlers.ts`（1,286行、全履歴89コミット）の `processAIResponse`（約392行）に、以下の責務が単一のwhileループへ絡み合っている。

- トークンストリームの読み取り（THINKINGチャンク分類を含む）
- 感情タグ `[happy]` / モーションタグ `[motion:xxx]` の解析と持ち越し
- 文分割（発話単位の切り出し）
- コードブロック（``` 区切り）の検出・分離
- chatLogへの逐次upsert（表示系）とメッセージID境界管理
- SpeakQueueへの発話投入（`speakCharacter`）
- スライド字幕・chatProcessingCount・思考ポーズの副作用

`speakMessageHandler`（約154行）も同じロジックの別実装を持ち、両者の意味論は微妙に異なる。セッションID・停止トークンは3つの入力源（チャット / 外部連携WebSocket / Realtime API）に跨って暗黙結合しており、キャンセレーションの正しさを誰も証明できない。

### 現状分析で確認した具体的欠陥（レビューで全件コード突合済み）

| #   | 欠陥                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 根拠                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| D1  | **停止後の発話再開**: `SpeakQueue.stopAll()` 後も `processAIResponse` はストリームを読み続けて `speakCharacter` を呼ぶ。呼ばれた `speakCharacter` は新しい stopToken を捕捉するため停止扱いにならず、`checkSessionId` の「停止中なら再開」パス（`speakQueue.ts:233-239`）で `stopped` が解除され、**同一レスポンスの残りが発話され続ける**。Stopボタン（`messageInputContainer.tsx:50`）・音声認識開始（`useVoiceRecognition.ts:79` ほか）の `stopAll()` が実質無効化される | `handlers.ts:443-732` に停止チェックなし    |
| D2  | **コードブロック直前の未完文がコード内容へ漏れる**: 文として確定しないテキストが ``の直前にあると `receivedChunksForSpeech` へpush-backされ（`handlers.ts:597-598`）、閉じ`` が後続チャンクにある場合は `handlers.ts:548` のprepend経由で**コード内容の途中に混入**する（表示済みテキストの重複でもある）。閉じ ``` が同一チャンク内なら混入しない代わりに、コードブロックの後で順序が入れ替わって発話される                                                                | `handlers.ts:596-601` → `:548` → `:513-514` |
| D3  | **コードブロック終了後の同一チャンク内テキストが表示されない**: (a) 開閉 ``が同一チャンクの場合は `textToAdd` が最初の`` で切られる（`handlers.ts:466-471`）、(b) コードブロック継続中に閉じ ```が来た場合は`else if (!isCodeBlock)` ガード（`:486`）で表示追記がスキップされ `currentMessageContent` がリセットされる（`:542-543`）。いずれも発話はされるがchatLogに残らない                                                                                               | 同左                                        |
| D4  | **感情タグ持ち越しの二重意味論**: `processAIResponse` は `currentEmotionTag` を持ち越すが、文がバッファを使い切った瞬間にリセットされる（`handlers.ts:592-595`, `:652-655`）というチャンク境界依存の挙動。`speakMessageHandler` は一切持ち越さない（`:282-301`）                                                                                                                                                                                                            | 同左                                        |
| D5  | **チャンク跨ぎの ``` が表示パスで検出されない**: 表示系は生チャンク単体に対する `indexOf`（`handlers.ts:467`）のため、``` がチャンク境界で分割されるとバッククォート断片や最大1チャンク分のコードが表示メッセージへ漏れる。なお発話パスの窓判定（`:517-524`）は `codeBlockContent` が常に空で始まるため実質無条件成立のデッドウェイトであり、push-back（`:548`）により発話側は結果的に再結合される                                                                          | `handlers.ts:466-471`                       |
| D6  | **`speakMessageHandler` が閉じられないコードブロックで無限ループ**: `"text ```code"`（閉じなし）を入力すると `:267-272` → `:347-357` → `:262-265` の循環で `isCodeBlock` が解除されず `while` (`:233`) が終了しない。messageReceiver / スライド自動再生から到達可能で**UIがフリーズする**                                                                                                                                                                                   | `handlers.ts:233-374`                       |

## 2. 設計方針

**「1つの純粋な状態機械 + 注入可能な副作用」に分解する。** ストリーム処理の本体を、副作用ゼロの逐次変換器 `SpeechSegmenter`（push型状態機械）として切り出し、表示・発話・記憶などの副作用はすべてイベントの消費側（注入された依存）に移す。`processAIResponse` は「読む → 分類する → 状態機械に流す → イベントを配る」だけの100行以下のオーケストレーションになる。

危険地帯は並行セッションと中断/割り込みの意味論である（ロードマップF4の注意書き）。したがって:

- `speakCharacter.ts` / `characterRenderer.ts` は変更しない。`speakQueue.ts` への変更は**追加的なもの2点のみ**に限定する（§5.2: 読み取り専用の `currentStopScope`、§5.4: `finalizeIfIdle()`）。既存メソッドの挙動・既存テスト（`speakQueue.test.ts` 546行ほか）は不変。
- キャンセレーション意味論の修正はパイプライン層（発話ディスパッチ前のガード）で行い、その意味論を**テストで固定する**（§6）。
- handlers.ts の公開API（`handleSendChatFn` / `handleReceiveTextFromWsFn` / `handleReceiveTextFromRtFn` / `processAIResponse` / `speakMessageHandler`）はシグネチャ・importパスとも不変。7つの呼び出し元（form / messageReceiver / slides / youtubeManager / websocketManager / youtubeComments / openAIAudioChat — grepで全件確認済み）は一切変更しない。

## 3. モジュール構成（S16の分割方針を兼ねる）

```
src/features/chat/
├── handlers.ts                    # 再エクスポートのみのファサード（後方互換維持）
├── sendChatHandler.ts             # handleSendChatFn（入力段: 外部連携/realtime/通常/スライドの分岐）
├── externalLinkageReceiver.ts     # handleReceiveTextFromWsFn + 発話ライフサイクル状態
├── realtimeReceiver.ts            # handleReceiveTextFromRtFn
└── speechPipeline/
    ├── types.ts                   # SegmenterEvent / 依存インターフェース定義
    ├── tagExtractors.ts           # extractEmotion / extractMotionTag / extractSentence（移設・export）
    ├── speechSegmenter.ts         # SpeechSegmenter 状態機械（純粋・副作用なし）
    ├── messageLogWriter.ts        # chatLog upsert・メッセージID境界・thinking蓄積
    ├── speechDispatcher.ts        # セッションアービトレーション・停止追従・speakCharacter呼び出し
    ├── consumeStream.ts           # ReadableStream読み取りループ（THINKING分類 → segmenter → writer/dispatcher）
    ├── processAIResponse.ts       # オーケストレーション（100行以下）
    └── speakMessageHandler.ts     # 完成テキスト用オーケストレーション（同じsegmenterを一括pushで再利用）
```

- `handlers.ts` はファサードとして残す。既存テスト `handlers.test.ts` はモジュールパス単位のjest.mock（`aiChatFactory` / `speakCharacter` / stores / `@/components/slides`）のみ使用しており、内部関数をモックしていないため、ファサード経由でも無修正で通る（レビューで検証済み）。留意点: (a) `memoryStoreSync` はモックされていないため import パス・呼び出しパターンを変えない、(b) 新モジュールがモジュールスコープで `getState()` を呼ばない（`clearAllMocks` 環境での漏れ対策）、(c) `thinkingPose*` 未定義の settings モックに耐える（現行同様のoptional扱い）。
- `externalSpeechLifecycleStates`（モジュールスコープMap）は `createExternalSpeechLifecycle()` ファクトリーに包み、`externalLinkageReceiver.ts` 内のシングルトンインスタンスとする。挙動は不変だが、テストからリセット可能になる。
- `goToSlide` は実体が `slideStore.setState({currentSlide})` のみ（`slides.tsx:14-18`）のため、`features/stores/slide.ts` のアクションへ移設し、`components/slides.tsx` はそれを再エクスポートする。features→components 依存が消える（既存テストは goToSlide を assert していないことを確認済み）。

## 4. SpeechSegmenter 状態機械の仕様

### 状態

```ts
type SegmenterState = {
  mode: 'text' | 'code'
  speechBuffer: string // 文として未確定のテキスト（発話カーソル）
  displayHold: string // 表示保留中の末尾バッククォート断片（最大2文字）
  codeBuffer: string // コード内容（code時）
  emotionTag: string // 持ち越し中の感情タグ（例: "[happy]"）
  motionTag: string // 持ち越し中のモーションタグ（例: "think"）
}
```

発話カーソル（speechBuffer）と表示カーソル（displayHold）は独立している: 表示は push ごとに即時確定（保留はバッククォート断片のみ）、発話は文確定を待つ。

### API

```ts
class SpeechSegmenter {
  push(chunk: string): SegmenterEvent[] // チャンクを与え、確定したイベント列を返す
  flush(): SegmenterEvent[] // ストリーム終端で未確定分を強制確定する
}

type SegmenterEvent =
  | { kind: 'display'; text: string } // chatLogへ追記する生テキスト（タグ含む・コード内容含まず）
  | { kind: 'speech'; text: string; emotionTag: string; motionTag?: string }
  | { kind: 'code'; content: string } // 完結したコードブロック（メッセージ境界を含意する）
```

### 遷移規則

**text モード**:

1. `displayHold + chunk` を作業領域とし、speechBufferへも追記する。
2. 作業領域内に ``があれば、その手前までを `display` として確定し、speechBuffer中の**文として未確定の残余を `speech` イベントとして強制確定してから**（D2の修正）`code` モードへ遷移。開始`` 直後の言語指定行（`/^ *(\w+)? *\n/`）は、改行がまだ到着していなければcodeBuffer先頭で保留し、到着時点で除去する（現行の「同一チャンク内でのみ除去」というチャンク依存を解消）。
3. ```がなければ: 作業領域の末尾がバッククォート1〜2個で終わる場合のみその断片を`displayHold`に保留し、残りを`display`として確定。speechBufferに対して文抽出ループを回す:`extractEmotion`→`extractMotionTag`→`extractSentence`。VOICEVOX / AivisSpeech / Google TTS / OpenAI TTS / Aivis Cloud選択時は初回発話のみ6文字以上の読点で早期確定し、2発話目以降と他TTSは従来どおり10文字以上の読点または文末記号で確定する。タグが見つかれば持ち越しタグを更新。文が確定するたび `speech` イベントを発行。確定しない残余はspeechBufferに保持して次のpushを待つ。
4. `display` と `speech` は同じテキストを別カーソルで見ているため、**flushで二重出力しない**: flush時の `display` は `displayHold` の残余のみ、`speech` はspeechBufferの残余のみを発行する。

**code モード**:

5. チャンクをcodeBufferへ追記。閉じ ```を検出したら`code`イベント（内容確定）を発行し、残余を作業領域へ戻して`text` モードへ復帰。タグ持ち越しはリセット（現行踏襲）。
6. 閉じ `の部分列がcodeBuffer末尾にある場合は保留し次pushを待つ（チャンク跨ぎ` の正確な検出）。

**flush()**:

7. text モード: `displayHold` 残余を `display` として、speechBuffer残余をタグ抽出のうえ最終 `speech` として発行（規則4の二重出力禁止に従う）。
8. code モード: codeBufferを `code` イベントとして発行（現行の「ストリーム途中終了時はコードとして保存」を踏襲）。D6は、pushが常に消費して返る（push-back循環を持たない）構造により原理的に解消される。

無限ループ対策（現行の stuck 検出）は「進捗がなければバッファに保持して抜ける」構造で原理的に不要になるが、防御として `push` 内のループに反復上限を残す。

### タグ持ち越しの統一意味論（D4の修正）

感情タグ・モーションタグは**次のタグ出現・コードブロック境界・改行（`\n`）・レスポンス終端まで持ち越す**。

- 現行の「バッファが空になった瞬間にリセット」（チャンク境界依存）は廃止。
- 改行で区切る理由（レビューM4対応）: タグが疎な応答で1つの `[angry]` が長文応答全体の音声（koeiromapは感情で声質が変わる）と表情に粘着するリスクを、段落境界で自然に抑止するため。1行内の複数文には同じタグが適用される（「[happy]こんにちは！いい天気だね。」の2文目もhappyになる — 現行はチャンク割れ次第でneutral）。
- `speakMessageHandler` も同じsegmenterを使うため同一意味論になる（スライド自動再生の台本読みにも適用される — 台本にタグがなければ従来通り全文neutral）。

## 5. 副作用の消費側

### 5.1 messageLogWriter

`display` / `code` イベントとTHINKINGチャンクを受け、chatLogを更新する。依存は `upsertMessage` 関数を注入（デフォルトは homeStore）。

- `display`: 現在のアシスタントメッセージIDへ内容を追記しupsert。最初のupsertは「最初の非空テキストまたはthinkingチャンク」で発生（現行踏襲）。中間upsertは非トリム、終端の最終upsertはトリム済み内容 + `currentMessageId ?? generateMessageId()`（現行踏襲）。
- `code`: 現在のアシスタントメッセージを確定 → `role: 'code'` メッセージ（IDなし、現行踏襲）をupsert → 新しいメッセージIDを発番（D3の修正: コードブロック後のテキストは新メッセージとして正しく表示される）。
- THINKINGチャンク: thinking内容へ追記し `content: currentMessageContent || ''` でupsert（現行踏襲）。
- 終端で最終メッセージ内容を返し、`processAIResponse` がそれを `saveMessageToMemory` へ渡す（現行の「最後のコードブロック以降のテキストのみ保存」という挙動を踏襲。speakMessageHandlerは記憶保存を行わない — 現行踏襲）。
- **speakMessageHandler用の表示は現行フォーマットを保存する**（レビューM4）: 同handlerは表示を生テキストではなく `` `${emotionTag} ${sentence}` `` をスペース結合した正規化形式で書き、モーションタグを表示から落とす。この挙動はUI可視のため変更せず、`speech` イベント列から現行と同じ形式を再構成する専用writerを使う。

### 5.2 speechDispatcher（キャンセレーションの中核）

`speech` イベントを受け、`speakCharacter` を呼ぶ。3つのガードを持つ。

```ts
// モジュールレベル: 最新の応答セッションID（チャット/スライド由来の応答セッションのみが登録する）
let latestResponseSessionId: string | null = null

const createSpeechDispatcher = (sessionId: string) => {
  latestResponseSessionId = sessionId
  let capturedToken: number | null = null   // 遅延捕捉（M1）
  let disabled = false
  let anyDispatched = false
  return {
    dispatch(event): boolean {
      if (disabled) return false
      // ガード1: セッションアービトレーション（B1対応）
      if (latestResponseSessionId !== sessionId) { disabled = true; return false }
      // ガード2: 停止トークン（D1対応）。初回dispatch時に捕捉（M1対応）
      if (capturedToken === null) {
        capturedToken = SpeakQueue.currentStopToken
      } else if (SpeakQueue.currentStopToken !== capturedToken) {
        const scope = SpeakQueue.currentStopScope
        if (scope === 'all' || scope === sessionId) { disabled = true; return false }
        capturedToken = SpeakQueue.currentStopToken   // 他セッション向け停止 → 追従して継続（B2対応）
      }
      // ガード3: 発話可否（記号のみ判定、現行ロジック移設）
      if (!isSpeakable(event.text)) return false
      speakCharacter(sessionId, {...}, onStart, onComplete)  // スライド字幕・chatProcessingCount連動は現行のまま
      anyDispatched = true
      return true
    },
    get anyDispatched() { ... },   // 思考ポーズ・finalize判定用
    get disabled() { ... },
  }
}
```

**`SpeakQueue` への追加的変更（その1）**: 停止スコープの記録。

```ts
private static stopScope: 'all' | string = 'all'
public static get currentStopScope() { return SpeakQueue.stopScope }
// stopAll(): stopScope = 'all' を設定（token++と同時）
// stopSession(id): token++する分岐（=対象が現在発話中セッションの場合のみ）で stopScope = id を設定
```

読み取り専用の情報追加であり、既存メソッドの制御フロー・既存テストに影響しない。`stopSession` は対象が現在発話中でない場合トークンを増やさない（`speakQueue.ts:94-96`、既存テストで固定済み）——この場合キューのフィルタのみで、dispatcherガードは発動しない（現行と同じく、その対象セッションのストリームが続けばまた発話される。ただしゲーム実況の `stopSession` はストリームではなく単発 `speakCharacter` のため実害なし）。

既知の限界: 停止が極短時間に連続した場合（`stopAll` 直後に他セッションへの `stopSession`）、間にdispatchを挟まなかったdispatcherは最後の停止のスコープでのみ判定する。実運用で該当する導線はない（許容）。

### 5.3 consumeStream

reader駆動ループ。チャンクを `THINKING_MARKER` で分類し、thinkingはwriterへ、テキストはsegmenterへpushしてイベントをwriter/dispatcherへ配る。`done` で `flush()`。エラー時は現行同様ログのみ（読み取り済み分は確定済み）。

停止後もストリームは**現行同様最後まで読み**、chatLogを完成させる（契約としては「`speakCharacter` が二度と呼ばれない」ことのみを固定し、読み取り継続は実装詳細とする — 将来 `reader.cancel()` によるトークン節約を契約変更なしで導入可能にするため）。

### 5.4 停止後のファイナライゼーション（レビューM2対応）

現行では、停止後もD1バグで発話が再開され、キューが最終的に排水されることで `shouldResetToNeutral`（`speakQueue.ts:192-217`）→ 発話完了コールバック（連続マイクモードの再開: `useVoiceRecognition.ts:96-108`）と表情の `resetToIdle` が発火していた。C1修正後は停止後にタスクが積まれないため、この経路が死ぬ。

**`SpeakQueue` への追加的変更（その2）**: 安全条件付きの手動ファイナライズ。

```ts
/** キューが完全に空転している場合のみ、発話完了コールバック実行 + 表情リセットを行う */
public static async finalizeIfIdle(): Promise<void> {
  const q = SpeakQueue.getInstance()
  if (q.queue.length > 0 || q.isProcessing || homeStore.getState().isSpeaking) return
  const finalizingSessionId = q.currentSessionId
  const canResetToIdle = () =>
    q.queue.length === 0 &&
    !homeStore.getState().isSpeaking &&
    q.currentSessionId === finalizingSessionId
  let shouldResumeQueue = false
  q.isProcessing = true
  try {
    q.stopped = false
    SpeakQueue.speakCompletionCallbacks.forEach(...)   // 既存の完了通知と同じ
    if (!canResetToIdle()) {
      shouldResumeQueue = q.queue.length > 0 && homeStore.getState().isSpeaking
    } else {
      await getCharacterRenderer()?.resetToIdle()
    }
  } finally {
    q.isProcessing = false
  }
  if (shouldResumeQueue) {
    await q.processQueue()
  }
}
```

`processAIResponse` はストリーム終端で「dispatcherがdisabledになっていた（=停止で殺された）」場合に `finalizeIfIdle()` を呼ぶ。新しい応答が既に発話中の場合は `isSpeaking === true` でno-opになる。完了コールバック中に次の発話が積まれた場合も、`resetToIdle` 前に「キュー空・非発話中・同一セッション」を再チェックして表情リセットを避け、直列化を解除したあとキュー処理へ戻すため、C7（後述）のケースで誤発火しない。`resetToIdle` のawait中は `isProcessing` がtrueのままなので、新しく積まれた発話はリセット完了後に処理される。

### 5.5 思考ポーズと chatProcessing（レビューF11対応 — 現行踏襲の明文化）

- 思考ポーズ: 開始時適用（`handlers.ts:386-401`）、ストリーム取得失敗/null時リセット（`:420`, `:426`）、終了時は `didStreamProcessingFail || !dispatcher.anyDispatched` でリセット（`:740-742` の `hasSpeakBeenCalled` を dispatcher.anyDispatched で置換）。settingsモックに `thinkingPose*` が無くても落ちないoptional扱いを維持。
- `chatProcessing`: 開始時 `true`（`:383`）、ストリームループ終了直後・最終upsert前に `false`（`:743-745`）。このタイミングは `processQueue` の `hs.chatProcessing` 参照（`speakQueue.ts:176-178`）と結合しているため**変更しない**。
- `speakMessageHandler` は chatProcessing 管理・記憶保存・思考ポーズを**持たない**（現行踏襲）。共通オーケストレーションに紛れ込ませない。

### 5.6 TTS初動の低遅延化

- OpenAI TTSはVRMレンダラーで24kHz PCM16のチャンク転送を利用し、全音声の生成完了を待たずに再生する。Live2D / PNGTuberは従来の一括再生へフォールバックする。
- VOICEVOX / AivisSpeech / Google TTS / OpenAI TTS / Aivis Cloudは、初回だけ読点前の最小長を5文字（読点込み6文字）へ下げる。最初の短い合成を前倒しし、2発話目以降は10文字へ戻して過度な細切れ化を避ける。
- Realtime API / Audio APIモードのPCMチャンクは、約2.1秒分だった再生開始閾値を約500ms分へ下げる。WebSocket/APIから届く増分音声を保持しすぎず、既存の全レンダラーへ順次渡す。

## 6. キャンセレーション意味論（テストで固定する契約）

| #   | シナリオ                                                                  | 契約                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6-1 | ストリーミング中（発話開始後）に `stopAll()`                              | 以後この応答から `speakCharacter` は一度も呼ばれない。chatLogへの表示は完成する。ストリーム終端で `finalizeIfIdle()` により完了コールバック+表情リセットが発火する                                                                                          |
| 6-2 | 応答Aのストリーミング中に新しい応答Bが開始                                | Aのdispatcherは以後 `speakCharacter` を呼ばない（アービトレーション）。Bは通常通り発話し、Bの最初の `speakCharacter` が `checkSessionId` 経由でAの残キューを破棄（既存動作）。**現行のセッションピンポン（A/B交互発話・相互キュー破棄）は解消される（C7）** |
| 6-3 | `stopSession(このセッション)` が発話中に発火                              | 6-1と同じ（scope一致で死ぬ）                                                                                                                                                                                                                                |
| 6-4 | `stopSession(他セッション)`（ゲーム実況等）がこのセッションの発話中に発火 | このセッションのdispatcherはトークンを追従して**発話を継続する**。in-flight合成分のみ破棄される（`speakCharacter.ts:228/:307`、現行と同等の回復挙動）                                                                                                       |
| 6-5 | モデル応答待ち中（初回dispatch前）に `stopAll()`                          | 遅延捕捉により、この応答は到着後**通常通り発話する**（現行UXと一致）。停止が殺すのは「その時点で発話を始めていた応答」のみ                                                                                                                                  |
| 6-6 | 発話開始前も含む2連続送信（A送信→即B送信）                                | 6-2と同じ。Aが1文も発話する前でもアービトレーションで沈黙する                                                                                                                                                                                               |
| 6-7 | WS外部連携 / Realtime API                                                 | 現行意味論を変更しない（メッセージ単位のイベント駆動でありdispatcherを使わない。`latestResponseSessionId` にも登録しない）                                                                                                                                  |

補足: アイドルモード・人感検知・ゲーム実況は `speakCharacter` を直接呼ぶ（dispatcherを経由しない）ため、これらとストリーム応答の相互作用は現行のまま（`checkSessionId` の後勝ち動作）。本設計のアービトレーションは「チャット/スライド由来の応答セッション同士」にのみ適用される。

## 7. 意図的挙動変更の列挙

| #   | 変更                                                                                                                                                                                                                                                                               | 種別       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C1  | 停止後、同一レスポンスの残りが発話されなくなる（D1修正）。停止後のマイク再開・表情リセットは `finalizeIfIdle()` が引き継ぐ                                                                                                                                                         | バグ修正   |
| C2  | コードブロック直前の未確定文が、コード内容への混入ではなく発話+表示として確定する（D2修正）                                                                                                                                                                                        | バグ修正   |
| C3  | コードブロック終了後のテキストがchatLogに表示されるようになる（D3修正）                                                                                                                                                                                                            | バグ修正   |
| C4  | 感情/モーションタグの持ち越しが「次のタグ・コード境界・改行・終端まで」に統一される（D4修正）。`speakMessageHandler`（スライド台本含む）でもタグが持ち越されるようになる                                                                                                           | 意味論統一 |
| C5  | チャンク跨ぎで分割された ``` が表示パスでも正しく検出される（D5修正）。表示上、チャンク末尾のバッククォート1〜2個は次チャンク確定まで保留される（1チャンク分の表示遅延）                                                                                                           | バグ修正   |
| C6  | `speakMessageHandler` の無限ループが解消される（D6修正）                                                                                                                                                                                                                           | バグ修正   |
| C7  | 並行する応答セッションのピンポン（交互発話・相互キュー破棄）が「最新の応答のみ発話する」に統一される（レビューB1対応）                                                                                                                                                             | 意味論統一 |
| C8  | 応答が ``` で始まる場合、コード内容がアシスタント文メッセージに混入する現行挙動が解消され、codeメッセージとして表示される                                                                                                                                                          | バグ修正   |
| C9  | コードブロックの言語指定行の除去がチャンク割れに依存しなくなる（現行は開始 ``` と改行が別チャンクだと言語名がコード内容に混入）                                                                                                                                                    | バグ修正   |
| —   | **不変なもの**: 初回読点の早期確定を除く文切り出し規則・記号のみ判定・processAIResponseの表示にタグが含まれる挙動・speakMessageHandlerの表示正規化形式・インライン ``` をフェンス開始と誤認する既知の限界・chatProcessingのタイミング・SpeakQueue/speakCharacterの既存メソッド挙動 | —          |

## 8. テスト戦略

1. **新規単体テスト**（純粋部分）
   - `speechSegmenter.test.ts`: 文分割のチャンク跨ぎ / タグのチャンク跨ぎ / コードブロック開閉のチャンク跨ぎ / 言語指定行の除去（チャンク割れ含む） / D2シナリオ / D6シナリオ（閉じなしフェンス+flush） / flushの二重出力禁止 / バッククォート断片の保留 / タグ持ち越しと改行リセット
   - `tagExtractors.test.ts`: 移設した3関数の既存挙動固定
   - `speechDispatcher.test.ts`: 遅延トークン捕捉 / stopAll後dispatch無効 / 他セッションstopSessionでの追従継続 / アービトレーション（新セッション登録で旧dispatcher無効化） / 記号のみフィルタ
   - `messageLogWriter.test.ts`: 初回upsert条件 / メッセージID境界（コードブロック前後） / thinking蓄積 / 終端flushのトリム / speakMessageHandler用正規化writerの現行形式一致
2. **キャンセレーション契約テスト**: §6の7行を1行ずつテスト化（`processAIResponse` + モックストリーム + 実SpeakQueue/モックspeakCharacterの組み合わせ）。特に 6-1（stopAll後にspeakCharacter不呼出+finalize発火）、6-2（旧セッション沈黙）、6-4（他セッション停止で継続）、6-5（遅延捕捉）
3. **既存テストの無修正通過**: `handlers.test.ts` / `speakQueue.test.ts` / `speakCharacter.test.ts` / `speakCharacterConcurrency.test.ts` を一切変更せずに通す（公開API・SpeakQueue既存意味論の不変性の証明）
4. 全テスト・lint・tsc・build通過

## 9. スコープ外（non-goals）

- `speakCharacter.ts` / `characterRenderer.ts` の変更
- `speakQueue.ts` の既存メソッドの挙動変更（追加は§5.2/§5.4の2点のみ）
- WS外部連携 / Realtime APIハンドラーの意味論変更（ファイル移動+ライフサイクルMapのファクトリー化のみ）
- アイドルモード・人感検知・ゲーム実況の直接 `speakCharacter` 呼び出しとストリーム応答の相互作用の変更
- UI/UXの変更
- F3(audioモード認証) — 本設計とは独立に後続で実施

## 10. 完了条件

- [ ] パイプライン各段（segmenter / writer / dispatcher）が独立した単体テストを持つ
- [ ] 停止/割り込みのキャンセレーション意味論が§6の契約テスト（7行）で固定されている
- [ ] `processAIResponse` が100行以下のオーケストレーションになっている
- [ ] handlers.ts がファサード化され、既存の7呼び出し元と既存テストが無修正で通る
- [ ] 意図的挙動変更が§7に列挙されている（それ以外の挙動差ゼロ）
