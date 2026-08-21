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
    <div className="flex items-center gap-2 p-2 bg-surface rounded-xl border border-border shadow-sm text-xs">
      <span className="font-semibold text-ink-muted">Sync Progres:</span>
      {state === 'error' ? (
        <span className="badge-status badge-status-danger" title={error ?? undefined}>
          Gagal sync ({pendingCount} tertunda)
        </span>
      ) : state === 'syncing' ? (
        <span className="badge-status badge-status-brand">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
          Menyinkronkan...
        </span>
      ) : pendingCount > 0 ? (
        <span className="badge-status badge-status-warning">
          {pendingCount} menunggu
        </span>
      ) : (
        <span className="badge-status badge-status-success">
          Tersinkron
        </span>
      )}

      {state === 'error' && (
        <button
          onClick={() => syncEngine.triggerSync()}
          className="text-danger hover:text-danger font-semibold px-2 py-1 rounded hover:bg-danger-soft border border-danger transition text-xs"
        >
          Coba Lagi
        </button>
      )}
    </div>
  )
}
