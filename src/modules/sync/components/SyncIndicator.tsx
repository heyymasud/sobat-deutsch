import React, { useState, useEffect } from 'react'
import { CloudCheck, CloudOff, CloudAlert, Loader2, RotateCw, Download } from 'lucide-react'
import { syncManager } from '../../../core/dictSync/syncManager'
import type { SyncStatus } from '../../../core/dictSync/syncManager'

export const SyncIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null)

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus)
    })

    syncManager.checkForUpdates().catch((err) => {
      console.error('Initial update check failed:', err)
    })

    return unsubscribe
  }, [])

  if (!status) return null

  const handleManualCheck = () => {
    syncManager.checkForUpdates(true).catch((err) => {
      console.error('Manual check failed:', err)
    })
  }

  const { downloadState, downloadProgress, localVersion, error } = status
  const isBusy = downloadState === 'downloading' || downloadState === 'verifying'

  const toneClass =
    downloadState === 'failed'
      ? 'bg-danger-soft text-danger'
      : isBusy
        ? 'bg-brand-soft text-brand'
        : localVersion > 0
          ? 'bg-success-soft text-success'
          : 'bg-surface-muted text-ink-faint'

  const Icon = isBusy ? Loader2 : downloadState === 'failed' ? CloudAlert : localVersion > 0 ? CloudCheck : CloudOff

  const title =
    downloadState === 'downloading'
      ? 'Mengunduh kamus offline'
      : downloadState === 'verifying'
        ? 'Memverifikasi data'
        : downloadState === 'failed'
          ? 'Gagal mengunduh'
          : localVersion > 0
            ? 'Kamus offline siap'
            : 'Belum ada kamus offline'

  const subtitle = isBusy
    ? `${downloadProgress}%`
    : downloadState === 'failed'
      ? error ?? 'Coba lagi'
      : localVersion > 0
        ? `Versi ${localVersion}`
        : 'Mode online'

  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${toneClass}`}>
        <Icon className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink truncate">{title}</p>
        {isBusy ? (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-surface-muted overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all duration-200 ${downloadState === 'verifying' ? 'bg-warning' : 'bg-brand'}`}
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-ink-faint">{downloadProgress}%</span>
          </div>
        ) : (
          <p className={`text-[11px] truncate ${downloadState === 'failed' ? 'text-danger' : 'text-ink-faint'}`} title={error ?? undefined}>
            {subtitle}
          </p>
        )}
      </div>

      {downloadState === 'idle' && (
        <button
          onClick={handleManualCheck}
          title={localVersion === 0 ? 'Unduh Kamus Offline' : 'Cek Update Kamus'}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:text-brand hover:bg-brand-soft transition-colors"
        >
          {localVersion === 0 ? <Download className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
      )}
      {downloadState === 'failed' && (
        <button
          onClick={handleManualCheck}
          title="Coba Lagi"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger-soft transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
