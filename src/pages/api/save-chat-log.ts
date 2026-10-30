import { logger } from '@/lib/logger'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { Message } from '@/features/messages/messages'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'

// Supabaseクライアントの初期化
let supabase: SupabaseClient | null = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      messages: newMessages,
      isNewFile,
      targetFileName,
      overwrite,
    } = req.body as {
      messages: Message[]
      isNewFile?: boolean
      targetFileName?: unknown
      overwrite?: boolean
    }
    const currentTime = new Date().toISOString()

    if (!Array.isArray(newMessages) || newMessages.length === 0) {
      return res.status(400).json({ message: 'Invalid messages data' })
    }

    const hasTargetFileName =
      targetFileName !== undefined && targetFileName !== null

    // overwrite=trueの場合はtargetFileNameが必須
    if (overwrite && !hasTargetFileName) {
      return res.status(400).json({
        message: 'targetFileName is required when overwrite is true',
      })
    }

    const logsDir =
      process.env.CHAT_LOGS_DIR || path.join(process.cwd(), 'logs')

    // logsディレクトリが存在しない場合は作成
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    // ファイル名の決定: isNewFile → targetFileName → 最新ファイル → 新規作成
    const newFileName = `log_${currentTime.replace(/[:.]/g, '-')}.json`
    const safeTargetFileName = hasTargetFileName
      ? getSafeLogFileName(targetFileName)
      : null
    if (hasTargetFileName && !safeTargetFileName) {
      return res.status(400).json({ message: 'Invalid targetFileName' })
    }

    const fileName = isNewFile
      ? newFileName
      : safeTargetFileName || getLatestLogFile(logsDir) || newFileName

    const filePath = path.join(logsDir, fileName)

    // 上書きモードでなければ既存メッセージを読み込んで追記
    const allMessages = overwrite
      ? newMessages
      : [...readExistingMessages(filePath, fileName), ...newMessages]

    // メッセージ配列を保存
    fs.writeFileSync(filePath, JSON.stringify(allMessages, null, 2))

    if (supabase) {
      const { data: existingSession } = await supabase
        .from('local_chat_sessions')
        .select('id')
        .eq('title', fileName)
        .maybeSingle()

      let sessionId = existingSession?.id

      if (sessionId) {
        await supabase
          .from('local_chat_sessions')
          .update({ updated_at: currentTime })
          .eq('id', sessionId)
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('local_chat_sessions')
          .insert({
            title: fileName,
            created_at: currentTime,
            updated_at: currentTime,
          })
          .select('id')
          .single()

        if (sessionError) throw sessionError
        sessionId = newSession.id
      }

      const messagesToSave = newMessages.map((msg) => ({
        session_id: sessionId,
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
        created_at: msg.timestamp || currentTime,
      }))

      const { error: messageError } = await supabase
        .from('local_messages')
        .insert(messagesToSave)

      if (messageError) throw messageError
    }

    res.status(200).json({ message: 'Logs saved successfully' })
  } catch (error) {
    logger.error('Error saving chat log:', error)
    res.status(500).json({ message: 'Error saving chat log' })
  }
}

export default withAccessPolicy(routePolicies['/api/save-chat-log'], handler)

function getSafeLogFileName(fileName: unknown): string | null {
  if (typeof fileName !== 'string') return null
  if (fileName !== path.basename(fileName)) return null
  if (fileName.includes('/') || fileName.includes('\\')) return null
  if (fileName === '.' || fileName === '..') return null
  if (!fileName.endsWith('.json')) return null
  return fileName
}

function getLatestLogFile(dir: string): string | null {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('log_') && f.endsWith('.json'))
      .sort()
      .reverse()
    return files[0] ?? null
  } catch (error) {
    logger.error('Error reading log directory:', error)
    return null
  }
}

function readExistingMessages(filePath: string, fileName: string): Message[] {
  if (!fs.existsSync(filePath)) return []

  try {
    const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (!Array.isArray(messages)) {
      logger.warn(`Invalid format in ${fileName}, resetting file.`)
      return []
    }
    return messages
  } catch (error) {
    logger.error(`Error parsing ${fileName}, resetting file.`, error)
    return []
  }
}
