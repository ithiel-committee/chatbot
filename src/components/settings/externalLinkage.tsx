import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import { ToggleSwitch } from '../toggleSwitch'
import { settingsControlClass } from '@/components/settings/formStyles'
import { useCallback } from 'react'
import { useRestrictedMode } from '@/hooks/useRestrictedMode'
import externalLinkageWebSocketStore from '@/features/stores/externalLinkageWebSocketStore'
import { TextButton } from '@/components/textButton'
import { createExternalLinkageCancelEvent } from '@/features/externalLinkage/externalLinkageProtocol'
import { DisabledSettingNote } from '@/components/settings/disabledSettingNote'

const SEND_EXAMPLE = `{
  "content": "ユーザーのメッセージ",
  "type": "chat",
  "image": "data:image/png;base64,..."
}`

const RECEIVE_EXAMPLE = `{
  "text": "アシスタントの応答",
  "role": "assistant",
  "emotion": "happy",
  "type": "",
  "image": "data:image/png;base64,..."
}`

const ExternalLinkage = () => {
  const { t } = useTranslation()
  const { isRestrictedMode } = useRestrictedMode()
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const externalLinkageUrl = settingsStore((s) => s.externalLinkageUrl)
  const connectionStatus = externalLinkageWebSocketStore((s) => s.status)
  const protocolVersion = externalLinkageWebSocketStore(
    (s) => s.protocolVersion
  )
  const lastError = externalLinkageWebSocketStore((s) => s.lastError)
  const reconnectCount = externalLinkageWebSocketStore((s) => s.reconnectCount)
  const heartbeatStatus = externalLinkageWebSocketStore(
    (s) => s.heartbeatStatus
  )
  const activeRequestId = externalLinkageWebSocketStore(
    (s) => s.activeRequestId
  )
  const lastRequestId = externalLinkageWebSocketStore((s) => s.lastRequestId)
  const requestStatus = externalLinkageWebSocketStore((s) => s.requestStatus)
  const requestError = externalLinkageWebSocketStore((s) => s.requestError)
  const lastAckAt = externalLinkageWebSocketStore((s) => s.lastAckAt)
  const nextReconnectAt = externalLinkageWebSocketStore(
    (s) => s.nextReconnectAt
  )
  const protocolVersionLabel = t(
    `ExternalLinkageProtocolVersion_${protocolVersion}`,
    {
      defaultValue: protocolVersion === '2' ? 'v2' : 'legacy (v1 compatible)',
    }
  )

  const handleExternalLinkageModeChange = useCallback((newMode: boolean) => {
    settingsStore.setState({ externalLinkageMode: newMode })
  }, [])

  const handleReconnect = useCallback(() => {
    externalLinkageWebSocketStore.getState().reconnect()
  }, [])

  const handleCancel = useCallback(() => {
    const state = externalLinkageWebSocketStore.getState()
    state.send(
      JSON.stringify(createExternalLinkageCancelEvent(state.activeRequestId))
    )
  }, [])

  return (
    <div className="mb-10">
      <div className="mb-4 text-xl font-bold">{t('ExternalLinkageMode')}</div>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('ExternalLinkageModeInfo')}
      </div>
      <DisabledSettingNote show={isRestrictedMode}>
        {t('RestrictedModeDisabledInfo')}
      </DisabledSettingNote>
      <div className="my-2">
        <ToggleSwitch
          enabled={externalLinkageMode}
          onChange={handleExternalLinkageModeChange}
          disabled={isRestrictedMode}
        />
      </div>

      {externalLinkageMode && (
        <div className="theme-surface-popover my-6 rounded-lg border p-4 space-y-4">
          <div>
            <div className="text-sm font-bold mb-1">
              {t('ExternalLinkageUrl')}
            </div>
            <input
              className={`${settingsControlClass.long} theme-surface-control`}
              type="text"
              value={externalLinkageUrl}
              onChange={(e) =>
                settingsStore.setState({ externalLinkageUrl: e.target.value })
              }
              placeholder="ws://localhost:8000/ws"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-bold">{t('ExternalLinkageStatus')}: </span>
              <span>{t(`ExternalLinkageStatus_${connectionStatus}`)}</span>
            </div>
            <div>
              <span className="font-bold">
                {t('ExternalLinkageProtocolVersion')}:{' '}
              </span>
              <span>{protocolVersionLabel}</span>
            </div>
            <div>
              <span className="font-bold">
                {t('ExternalLinkageReconnectCount')}:{' '}
              </span>
              <span>{reconnectCount}</span>
            </div>
            <div>
              <span className="font-bold">
                {t('ExternalLinkageHeartbeat')}:{' '}
              </span>
              <span>{t(`ExternalLinkageHeartbeat_${heartbeatStatus}`)}</span>
            </div>
            <div>
              <span className="font-bold">
                {t('ExternalLinkageRequestStatus')}:{' '}
              </span>
              <span>{t(`ExternalLinkageRequestStatus_${requestStatus}`)}</span>
            </div>
            {lastRequestId && (
              <div>
                <span className="font-bold">
                  {t('ExternalLinkageLastRequestId')}:{' '}
                </span>
                <span className="break-all">{lastRequestId}</span>
              </div>
            )}
            {lastAckAt && (
              <div>
                <span className="font-bold">
                  {t('ExternalLinkageLastAckAt')}:{' '}
                </span>
                <span>{new Date(lastAckAt).toLocaleTimeString()}</span>
              </div>
            )}
            {nextReconnectAt && (
              <div>
                <span className="font-bold">
                  {t('ExternalLinkageNextReconnect')}:{' '}
                </span>
                <span>{new Date(nextReconnectAt).toLocaleTimeString()}</span>
              </div>
            )}
            {lastError && (
              <div className="text-secondary sm:col-span-2">
                <span className="font-bold">
                  {t('ExternalLinkageLastError')}:{' '}
                </span>
                <span>{lastError}</span>
              </div>
            )}
            {requestError && (
              <div className="text-secondary sm:col-span-2">
                <span className="font-bold">
                  {t('ExternalLinkageRequestError')}:{' '}
                </span>
                <span>{requestError}</span>
              </div>
            )}
          </div>
          <TextButton
            type="button"
            onClick={handleReconnect}
            disabled={connectionStatus === 'idle'}
          >
            {t('ExternalLinkageReconnect')}
          </TextButton>
          <TextButton
            type="button"
            onClick={handleCancel}
            disabled={protocolVersion !== '2' || !activeRequestId}
            className="ml-2"
          >
            {t('ExternalLinkageCancel')}
          </TextButton>
          <div>
            <div className="font-bold text-lg">
              {t('ExternalLinkageImageProtocol')}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {t('ExternalLinkageImageProtocolInfo')}
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-1">
              {t('ExternalLinkageSendFormat')}
            </div>
            <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto font-mono">
              {SEND_EXAMPLE}
            </pre>
          </div>
          <div>
            <div className="text-sm font-bold mb-1">
              {t('ExternalLinkageReceiveFormat')}
            </div>
            <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto font-mono">
              {RECEIVE_EXAMPLE}
            </pre>
          </div>
          <div className="text-xs text-gray-500">
            {t('ExternalLinkageImageNote')}
          </div>
        </div>
      )}
    </div>
  )
}
export default ExternalLinkage
