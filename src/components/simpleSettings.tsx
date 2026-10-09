import React from 'react'
import { TextButton } from './textButton' // 既存のボタンコンポーネント
import { IconButton } from './iconButton'

type Props = {
  onClose: () => void
  onOpenAdvanced: () => void
}

export const SimpleSettings = ({ onClose, onOpenAdvanced }: Props) => {
  return (
    // 背景の半透明オーバーレイ
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="rounded-3xl w-full max-w-sm p-6 relative shadow-2xl backdrop-blur-md bg-black/40 border border-white/10 text-white">
        {/* 閉じるボタン */}
        <div className="absolute top-4 left-4">
          <IconButton
            isProcessing={false}
            iconName="24/Close"
            onClick={onClose}
          />
        </div>

        <h2 className="text-xl font-bold mb-6 text-center">クイック設定</h2>

        {/* 設定項目の実装箇所 */}
        <div className="space-y-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm font-bold text-gray-200">キャラクター設定</p>
            {/* プレイスホルダー、実際のキャラクター選択セレクトボックス等を配置 */}
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm font-bold text-gray-200">音声設定</p>
            {/* プレイスホルダー実際のマイクオンオフ等を配置 */}
          </div>
        </div>

        {/* 詳細な設定を呼び出すボタン */}
        <div className="border-t border-white/10 pt-4 text-center">
          <TextButton onClick={onOpenAdvanced}>詳細な設定を開く</TextButton>
        </div>
      </div>
    </div>
  )
}
