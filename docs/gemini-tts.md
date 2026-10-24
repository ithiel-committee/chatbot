# Gemini Flash-Lite TTS の設定

既存の音声合成エンジンに Gemini TTS を追加しています。Google Cloud Text-to-Speech とは別の選択肢です。モデルは `gemini-3.8-flash-lite-tts` です。

## 導入

1. Voice Design の声を保存した Google プロジェクトの API キーを用意します。
2. `.env.local` に次の値を設定してアプリを起動します。既存デプロイでは環境変数を変更して再ビルドしてください。

```dotenv
GEMINI_TTS_API_KEY="your-api-key"
NEXT_PUBLIC_SELECT_VOICE="gemini"
NEXT_PUBLIC_GEMINI_TTS_VOICE="voice_gkzvygsq8i5b"
NEXT_PUBLIC_GEMINI_TTS_STYLE=""
NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES="false"
```

3. 設定画面の「音声設定」で「Gemini TTS」を選択し、テスト音声を再生します。既存のブラウザ設定が残っている場合は、画面でエンジンを切り替えてください。

API キーはサーバー専用です。`NEXT_PUBLIC_*` にキーを設定しないでください。専用キーが空の場合は `GEMINI_API_KEY`、次に `GOOGLE_API_KEY` を使用します。画面で Gemini TTS API キーを入力した場合は、そのキーが優先され、既存設定と同様にブラウザに保存されます。通常の設定バックアップではこのキーを除外します。

サーバーのキーには、他の TTS と同じ `AITUBERKIT_SERVER_SECRET_ACCESS_MODE` の制限が適用されます。公開環境の保護設定は [アクセスポリシー設計](access-policy-design.md) に従ってください。クライアント持ち込みキーを使用する場合も、リクエストの入力検証は行います。

## 声IDの差し替え

- **画面から**: 通常の設定メニューの「合成音声設定」、詳細設定の「合成音声設定」、またはクイックスタートの「声ID / 音声名」を別の `voice_...` に変更します。次の合成から適用されます。`Kore` などの標準音声名も指定できます。
- **配布時の初期値**: `NEXT_PUBLIC_GEMINI_TTS_VOICE` を変更し、再ビルドします。
- **全端末で環境変数を優先**: `NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES="true"` にします。この場合、画面での変更はリロード時に環境変数へ戻ります。
- **画面の変更を維持**: 上記を `false` にします。ブラウザの保存済み設定が環境変数より優先されます。

カスタム声IDは Google プロジェクトに紐づくため、別プロジェクトのキーでは使えません。声を変える際はキーの所属も確認してください。既定の合成エンジンは引き続き VOICEVOX です。C3 の既存構成には影響しません。

## 演技指示と読み上げ

演技指示は任意です。空欄や空白だけなら `speech_metadata` 自体を送らず、本文と声だけを指定します。入力した場合は本文とは別の `speech_metadata.style` へ渡し、表情タグからの演技指示や話速・音高を自動追加しません。

生成結果の WAV を既存の発話キューとキャラクター再生へ渡します。複数の合成が並行しても再生順序は既存キューで維持します。合成済みの区間・再生待ちの区間は声を変更しても作り直しません。初回の読点を短く区切る最適化は追加せず、既存の標準文分割を使用します。

429、アクセス権不足、音声なし、通信失敗、60秒のタイムアウトは既存のエラー通知で表示します。自動再試行と音声キャッシュは今回追加していません。モデルの出力には揺らぎがあるため、同じ声ID・演技指示でも同一音声になる保証はありません。

## API と確認方法

`POST /api/tts-gemini` は `{ message, voice, style?, apiKey? }` を受け取り、成功時に `audio/wav` を返します。サーバーが固定の Gemini Interactions REST API へ接続します。SDK や依存パッケージの追加・更新はありません。キー・本文・上流エラー本文をログへ出しません。

- [公式の音声生成ガイド](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Voice Design](https://ai.google.dev/gemini-api/docs/voice-design)

開発時は以下で API 契約、空の演技指示、声の変更・永続化、キーの保護、エラー処理、発話キューへの接続を確認できます。

```sh
pnpm test --runInBand tts-gemini synthesizeVoiceGemini settingsGeminiTts components/voice.test speakCharacterConcurrency apiRouteStaticChecks
pnpm build
```

実 API の確認には、その声を保存した Google プロジェクトのキーが必要です。API 応答をモックするテストだけでは、声IDの利用権限や実際の音質までは検証できません。
