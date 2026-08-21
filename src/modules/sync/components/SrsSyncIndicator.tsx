import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
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

  const toneClass =
    state === 'error'
      ? 'bg-danger-soft text-danger'
      : state === 'syncing'
        ? 'bg-brand-soft text-brand'
        : pendingCount > 0
          ? 'bg-warning-soft text-warning'
          : 'bg-success-soft text-success'

  const Icon = state === 'error' ? AlertCircle : state === 'syncing' ? RefreshCw : pendingCount > 0 ? Clock : CheckCircle2

  const title = state === 'error' ? 'Sinkronisasi gagal' : state === 'syncing' ? 'Menyinkronkan progres' : pendingCount > 0 ? `${pendingCount} perubahan tertunda` : 'Progres tersinkron'

  const subtitle = state === 'error' ? (error ?? 'Coba lagi') : state === 'syncing' ? 'Mohon tunggu…' : pendingCount > 0 ? 'Akan sync otomatis' : 'Semua perangkat terbaru'

  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${toneClass}`}>
        <Icon className={`h-4 w-4 ${state === 'syncing' ? 'animate-spin' : ''}`} strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink truncate">{title}</p>
        <p className={`text-[11px] truncate ${state === 'error' ? 'text-danger' : 'text-ink-faint'}`} title={error ?? undefined}>
          {subtitle}
        </p>
      </div>

      {state === 'error' && (
        <button
          onClick={() => syncEngine.triggerSync()}
          title="Coba Lagi"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger-soft transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
