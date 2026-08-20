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
    <div className="flex flex-col items-center sm:items-end gap-1.5 p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-xs max-w-sm w-full sm:w-auto">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-500">Status Data:</span>
        {downloadState === 'idle' && localVersion > 0 && (
          <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Offline Ready (v{localVersion})
          </span>
        )}
        {downloadState === 'idle' && localVersion === 0 && (
          <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded-full">
            Online Only (State A)
          </span>
        )}
        {downloadState === 'downloading' && (
          <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg className="animate-spin h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Unduh background... {downloadProgress}%
          </span>
        )}
        {downloadState === 'verifying' && (
          <span className="bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg className="animate-spin h-3.5 w-3.5 text-yellow-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Memverifikasi data... {downloadProgress}%
          </span>
        )}
        {downloadState === 'failed' && (
          <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
            Gagal Unduh
          </span>
        )}
      </div>

      {/* Progress Bar for Downloading/Verifying */}
      {(downloadState === 'downloading' || downloadState === 'verifying') && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
          <div 
            className={`h-1.5 rounded-full transition-all duration-150 ${downloadState === 'verifying' ? 'bg-yellow-500' : 'bg-blue-600'}`} 
            style={{ width: `${downloadProgress}%` }}
          ></div>
        </div>
      )}

      {error && (
        <span className="text-red-500 text-[10px] text-center sm:text-right mt-1 max-w-[200px] truncate block" title={error}>
          {error}
        </span>
      )}

      {/* Buttons */}
      <div className="flex gap-2 mt-1">
        {downloadState === 'idle' && (
          <button
            onClick={handleManualCheck}
            className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 border border-indigo-200 transition text-[10px]"
          >
            {localVersion === 0 ? 'Unduh Kamus Offline' : 'Cek Update Kamus'}
          </button>
        )}
        {downloadState === 'failed' && (
          <button
            onClick={handleManualCheck}
            className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50 border border-red-200 transition text-[10px]"
          >
            Coba Lagi
          </button>
        )}
      </div>
    </div>
  )
}
