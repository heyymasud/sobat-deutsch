import React, { useState, useEffect } from 'react'
import { syncManager } from '../../../core/dictSync/syncManager'
import type { SyncStatus } from '../../../core/dictSync/syncManager'

export const SyncIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null)

  useEffect(() => {
    // Subscribe to syncManager updates
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus)
    })
    
    // Initial check on load
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
  };

  const { downloadState, downloadProgress, localVersion, error } = status

  return (
    <div className="flex flex-col items-center sm:items-end gap-1.5 p-3 bg-surface rounded-xl border border-border shadow-sm text-xs max-w-sm w-full sm:w-auto">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ink-muted">Status Data:</span>
        {downloadState === 'idle' && localVersion > 0 && (
          <span className="badge-status badge-status-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
            Offline Ready (v{localVersion})
          </span>
        )}
        {downloadState === 'idle' && localVersion === 0 && (
          <span className="badge-status badge-status-neutral">
            Online Only (State A)
          </span>
        )}
        {downloadState === 'downloading' && (
          <span className="badge-status badge-status-brand">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Unduh background... {downloadProgress}%
          </span>
        )}
        {downloadState === 'verifying' && (
          <span className="badge-status badge-status-warning">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Memverifikasi data... {downloadProgress}%
          </span>
        )}
        {downloadState === 'failed' && (
          <span className="badge-status badge-status-danger">
            Gagal Unduh
          </span>
        )}
      </div>

      {/* Progress Bar for Downloading/Verifying */}
      {(downloadState === 'downloading' || downloadState === 'verifying') && (
        <div className="w-full bg-surface-muted rounded-full h-1.5 mt-1 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-150 ${downloadState === 'verifying' ? 'bg-warning' : 'bg-brand'}`}
            style={{ width: `${downloadProgress}%` }}
          ></div>
        </div>
      )}

      {error && (
        <span className="text-danger text-xs text-center sm:text-right mt-1 max-w-xs truncate block" title={error}>
          {error}
        </span>
      )}

      {/* Buttons */}
      <div className="flex gap-2 mt-1">
        {downloadState === 'idle' && (
          <button
            onClick={handleManualCheck}
            className="text-brand hover:text-brand font-semibold px-2 py-1 rounded hover:bg-brand-soft border border-brand transition text-xs"
          >
            {localVersion === 0 ? 'Unduh Kamus Offline' : 'Cek Update Kamus'}
          </button>
        )}
        {downloadState === 'failed' && (
          <button
            onClick={handleManualCheck}
            className="text-danger hover:text-danger font-semibold px-2 py-1 rounded hover:bg-danger-soft border border-danger transition text-xs"
          >
            Coba Lagi
          </button>
        )}
      </div>
    </div>
  )
}
