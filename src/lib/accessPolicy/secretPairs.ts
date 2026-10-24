/**
 * usesServerSecret 判定の共通ヘルパー
 *
 * 「クライアントが値を持ち込まず、サーバーenvに値がある場合は
 * サーバー秘匿リソースを使う」という判定式を一元化する。
 * （旧S7: 各ルートで微妙に異なる手書き式の集約）
 */

import type { NextApiRequest } from 'next'
import type { SecretPair } from './types'

/**
 * body/query からクライアント提供値を取り出す（配列指定は先頭要素を採用）。
 * withAccessPolicy.ts のサーバーURL解決と共有する。
 */
export function extractClientValue(
  req: NextApiRequest,
  source: 'body' | 'query',
  key: string
): unknown {
  const holder = source === 'body' ? req.body : req.query
  const rawValue =
    holder && typeof holder === 'object'
      ? (holder as Record<string, unknown>)[key]
      : undefined
  return Array.isArray(rawValue) ? rawValue[0] : rawValue
}

/**
 * dynamicルート用の低レベルヘルパー。
 * [クライアント提供値, サーバーenv値] のペア列を受け取り、
 * いずれかのペアで「クライアント未提供かつenv有り」なら true。
 */
export function computeUsesServerSecret(
  pairs: Array<[clientValue: unknown, envValue: string | undefined]>
): boolean {
  return pairs.some(
    ([clientValue, envValue]) => !clientValue && Boolean(envValue)
  )
}

/**
 * 宣言的 SecretPair をリクエストに対して評価する。
 *
 * onlyIfAbsent が指定されているペアは、参照先フィールドをクライアントが
 * 提供している場合は評価対象から除外する（S18: 条件付きペア）。
 */
export function evaluateSecretPairs(
  req: NextApiRequest,
  pairs: SecretPair[]
): boolean {
  return pairs.some((pair) => {
    if (pair.onlyIfAbsent) {
      const gateValue = extractClientValue(
        req,
        pair.onlyIfAbsent.source,
        pair.onlyIfAbsent.key
      )
      if (gateValue) return false
    }
    const rawClientValue = extractClientValue(req, pair.source, pair.key)
    const clientValue =
      pair.trimClientValue && typeof rawClientValue === 'string'
        ? rawClientValue.trim()
        : rawClientValue
    return (
      !clientValue && pair.envVars.some((name) => Boolean(process.env[name]))
    )
  })
}
