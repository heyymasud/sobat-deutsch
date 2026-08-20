import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'
import type { DictionaryEntry } from '../../modules/dictionary/types'

const BUCKET_NAME = 'dictionary-releases'

export interface SyncStatus {
  downloadState: 'idle' | 'downloading' | 'verifying' | 'failed'
  downloadProgress: number
  localVersion: number
  serverVersion: number
  error: string | null
}

export type SyncListener = (status: SyncStatus) => void

class DictionarySyncManager {
  private listeners = new Set<SyncListener>()
  private status: SyncStatus = {
    downloadState: 'idle',
    downloadProgress: 0,
    localVersion: 0,
    serverVersion: 0,
    error: null,
  }

  constructor() {
    this.initLocalStatus()
  }

  private async initLocalStatus() {
    try {
      const meta = await db.dictSyncMeta.toCollection().first()
      if (meta) {
        this.status = {
          ...this.status,
          localVersion: meta.localVersion,
          downloadState: meta.downloadState,
          downloadProgress: meta.downloadProgress,
        }
      } else {
        // Initial state A
        await db.dictSyncMeta.add({
          localVersion: 0,
          downloadState: 'idle',
          downloadProgress: 0,
          lastCheckedAt: 0,
        })
      }
      this.notify()
    } catch (err) {
      console.error('Failed to init sync manager status:', err)
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l(this.status))
  }

  private updateStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.notify()
    
    // Persist status change to Dexie in background
    db.dictSyncMeta.toCollection().first().then((meta) => {
      if (meta && meta.id) {
        db.dictSyncMeta.update(meta.id, {
          localVersion: this.status.localVersion,
          downloadState: this.status.downloadState,
          downloadProgress: this.status.downloadProgress,
          lastCheckedAt: Date.now(),
        })
      }
    })
  }

  /**
   * Checks the server dictionary version and triggers background download if needed.
   */
  public async checkForUpdates(forceDownload: boolean = false): Promise<void> {
    if (this.status.downloadState === 'downloading' || this.status.downloadState === 'verifying') {
      return
    }

    this.updateStatus({ error: null })

    try {
      // 1. Get latest metadata from Supabase
      const { data: serverMeta, error: metaErr } = await supabase
        .from('dictionary_meta')
        .select('version, row_count, checksum')
        .limit(1)
        .single()

      if (metaErr) throw metaErr
      if (!serverMeta) throw new Error('No server dictionary metadata found')

      const serverVer = serverMeta.version
      const expectedRows = serverMeta.row_count
      const checksum = serverMeta.checksum

      this.updateStatus({ serverVersion: serverVer })

      const localMeta = await db.dictSyncMeta.toCollection().first()
      const localVer = localMeta ? localMeta.localVersion : 0

      if (localVer < serverVer || forceDownload) {
        // Trigger background download
        await this.startDownload(serverVer, expectedRows, checksum)
      } else {
        this.updateStatus({ downloadState: 'idle', downloadProgress: 100 })
      }
    } catch (err: any) {
      console.error('Update check failed:', err)
      this.updateStatus({ downloadState: 'failed', error: err.message || 'Gagal memeriksa pembaruan.' })
    }
  }

  private async startDownload(version: number, expectedRows: number, _expectedChecksum: string) {
    this.updateStatus({ downloadState: 'downloading', downloadProgress: 0 })

    try {
      // Get public URL of the JSON file
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`dictionary-full.v${version}.json`)

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Gagal mendapatkan URL unduhan dictionary')
      }

      // Download file with progress monitoring using XMLHttpRequest
      const xhr = new XMLHttpRequest()
      xhr.open('GET', urlData.publicUrl, true)
      
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          this.updateStatus({ downloadProgress: progress })
        }
      }

      const fileData = await new Promise<string>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.responseText)
          } else {
            reject(new Error(`Gagal mengunduh file: HTTP ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error('Koneksi jaringan error saat mengunduh.'))
        xhr.send()
      })

      this.updateStatus({ downloadState: 'verifying' })

      // Verify and Parse JSON
      const entries: DictionaryEntry[] = JSON.parse(fileData)
      if (!Array.isArray(entries)) {
        throw new Error('Format file unduhan tidak valid')
      }

      if (entries.length !== expectedRows) {
        throw new Error(`Data tidak lengkap. Ditemukan ${entries.length} baris, diharapkan ${expectedRows} baris`)
      }

      // Populate Staging table in Dexie
      console.log('Clearing staging table...')
      await db.dictionaryStaging.clear()

      console.log('Writing to staging in batches...')
      const batchSize = 5000
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize)
        await db.dictionaryStaging.bulkPut(batch)
        const progress = Math.min(100, Math.round(((i + batch.length) / entries.length) * 100))
        this.updateStatus({ downloadProgress: progress })
      }

      // Atomic Swap
      console.log('Committing atomic swap...')
      await db.transaction('rw', [db.dictionary, db.dictionaryStaging, db.dictSyncMeta], async () => {
        await db.dictionary.clear()
        
        // Copy in batches
        const count = await db.dictionaryStaging.count()
        let offset = 0
        while (offset < count) {
          const chunk = await db.dictionaryStaging.offset(offset).limit(batchSize).toArray()
          if (chunk.length === 0) break
          await db.dictionary.bulkAdd(chunk)
          offset += chunk.length
        }

        await db.dictionaryStaging.clear()
        
        // Update local version meta
        const meta = await db.dictSyncMeta.toCollection().first()
        if (meta && meta.id) {
          await db.dictSyncMeta.update(meta.id, {
            localVersion: version,
            downloadState: 'idle',
            downloadProgress: 100,
            lastCheckedAt: Date.now(),
          })
        }
      })

      this.updateStatus({
        localVersion: version,
        downloadState: 'idle',
        downloadProgress: 100,
      })

      console.log(`Dictionary version ${version} successfully swapped and ready offline.`)
    } catch (err: any) {
      console.error('Download or import failed:', err)
      this.updateStatus({ downloadState: 'failed', error: err.message || 'Gagal mengunduh kamus.' })
      await db.dictionaryStaging.clear()
    }
  }
}

export const syncManager = new DictionarySyncManager()
