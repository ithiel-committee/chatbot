import { Talk } from './messages'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'

export async function synthesizeVoiceGSVIApi(
  talk: Talk,
  url: string,
  character: string,
  batchsize: number,
  speed: number
): Promise<ArrayBuffer> {
  return synthesizeVoiceApi(
    '/api/tts-gsvi',
    {
      message: talk.message,
      serverUrl: url,
      character,
      batchSize: batchsize,
      speed,
    },
    'GSVI',
    {
      parseResponse: async (res) => {
        const blob = await res.blob()
        return blob.arrayBuffer()
      },
    }
  )
}
