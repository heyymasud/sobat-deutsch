import React, { useState, useEffect } from 'react'
import { syncEngine } from '../../../core/sync/syncEngine'
import type { SyncEngineStatus } from '../../../core/sync/syncEngine'

// S9-02 (AC-SYNC-01, AC-SYNC-03, FR-SYNC-06): status + manual retry for the
// decks/srsCards/reviewLogs push queue — distinct from SyncIndicator, which
// only reports dictionary-download status (syncManager, not syncEngine).
export const SrsSyncIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncEngineStatus | null>(null)

  useEffect(() => {
    return syncEngine.subscribe(setStatus)
  }, [])

  if (!status) return null

  const { state, pendingCount, error } = status

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-xs">
      <span className="font-semibold text-gray-500">Sync Progres:</span>
      {state === 'error' ? (
        <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full" title={error ?? undefined}>
          Gagal sync ({pendingCount} tertunda)
        </span>
      ) : state === 'syncing' ? (
        <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Menyinkronkan...
        </span>
      ) : pendingCount > 0 ? (
        <span className="bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-full">
          {pendingCount} menunggu
        </span>
      ) : (
        <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">
          Tersinkron
        </span>
      )}

      {state === 'error' && (
        <button
          onClick={() => syncEngine.triggerSync()}
          className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50 border border-red-200 transition text-[10px]"
        >
          Coba Lagi
        </button>
      )}
    </div>
  )
}
