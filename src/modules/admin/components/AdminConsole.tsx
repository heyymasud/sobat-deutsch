import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'

export const AdminConsole: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'applications' | 'suggestions' | 'reports'>('applications')
  const [applications, setApplications] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [needsReexport, setNeedsReexport] = useState(false)

  // Suggestion edit fields
  const [editedSuggestedValue, setEditedSuggestedValue] = useState('')

  // Word report inline dictionary edit fields (S6-10)
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [reportEditFields, setReportEditFields] = useState<{ translations: string; gender: string; plural: string; example: string }>({ translations: '', gender: '', plural: '', example: '' })

  // Standard hoisted function declarations
  async function loadData() {
    setLoading(true)
    setNote('')
    setReviewingId(null)
    try {
      if (activeSubTab === 'applications') {
        const { data, error } = await supabase
          .from('teacher_applications')
          .select('*, profiles(display_name)')
          .eq('status', 'pending')
        if (error) throw error
        setApplications(data || [])
      } else if (activeSubTab === 'suggestions') {
        const { data, error } = await supabase
          .from('dictionary_suggestions')
          .select('*, dictionary(lemma, pos, translations, gender, plural, example), profiles(display_name)')
          .eq('status', 'pending')
        if (error) throw error
        setSuggestions(data || [])

        // ponytail: single global row, so just read the flag — no count query needed
        const { data: meta } = await supabase.from('dictionary_meta').select('needs_reexport').limit(1).single()
        setNeedsReexport(!!meta?.needs_reexport)
      } else {
        const { data, error } = await supabase
          .from('word_reports')
          .select('*, dictionary(id, lemma, pos, translations, gender, plural, example)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        if (error) throw error
        setReports(data || [])
      }
    } catch (err) {
      console.error('Failed to load admin queue data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReviewApplication(applicationId: string, action: 'approve' | 'reject') {
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('admin-review-application', {
        body: { applicationId, action, note: note.trim() }
      })
      if (error) throw error
      alert(`Permohonan pengajar berhasil ${action === 'approve' ? 'diterima' : 'ditolak'}.`)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Gagal merespon permohonan pengajar.')
    } finally {
      setLoading(false)
    }
  }

  function startEditSuggestion(s: any) {
    setReviewingId(s.id)
    setEditedSuggestedValue(s.suggested_value || '')
  }

  async function handleReviewSuggestion(suggestionId: string, action: 'approve' | 'reject') {
    setLoading(true)
    try {
      if (action === 'approve') {
        const { error: prepErr } = await supabase
          .from('dictionary_suggestions')
          .update({ suggested_value: editedSuggestedValue.trim() || null })
          .eq('id', suggestionId)

        if (prepErr) throw prepErr
      }

      const { error } = await supabase.functions.invoke('admin-review-suggestion', {
        body: { suggestionId, action, note: note.trim() }
      })
      if (error) throw error
      alert(`Usulan koreksi kata berhasil ${action === 'approve' ? 'diterima' : 'ditolak'}.`)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Gagal memproses usulan koreksi.')
    } finally {
      setLoading(false)
    }
  }

  function startEditReport(r: any) {
    setEditingReportId(r.id)
    setReportEditFields({
      translations: r.dictionary?.translations || '',
      gender: r.dictionary?.gender || '',
      plural: r.dictionary?.plural || '',
      example: r.dictionary?.example || '',
    })
  }

  // S6-10: admin applies the fix directly to `dictionary` (no approval Edge Function for this simple flow)
  async function handleApplyReportFix(report: any) {
    setLoading(true)
    try {
      const { error: updateErr } = await supabase
        .from('dictionary')
        .update({
          translations: reportEditFields.translations.trim() || null,
          gender: (reportEditFields.gender || null) as any,
          plural: reportEditFields.plural.trim() || null,
          example: reportEditFields.example.trim() || null,
        })
        .eq('id', report.word_id)
      if (updateErr) throw updateErr

      const { error: resolveErr } = await supabase
        .from('word_reports')
        .update({ status: 'resolved' })
        .eq('id', report.id)
      if (resolveErr) throw resolveErr

      alert('Koreksi berhasil diterapkan ke kamus.')
      setEditingReportId(null)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Gagal menerapkan koreksi.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDismissReport(reportId: string) {
    setLoading(true)
    try {
      const { error } = await supabase.from('word_reports').update({ status: 'dismissed' }).eq('id', reportId)
      if (error) throw error
      loadData()
    } catch (err: any) {
      alert(err.message || 'Gagal menutup laporan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeSubTab])

  return (
    <div className="max-w-4xl mx-auto my-6 px-4 text-left">
      <h1 className="text-3xl font-extrabold text-ink mb-6">Panel Admin</h1>

      {needsReexport && (
        <div className="mb-6 text-xs font-semibold text-warning bg-warning-soft border border-warning rounded-xl px-4 py-2">
          Ada perubahan kamus yang disetujui sejak ekspor terakhir. Jalankan{' '}
          <code className="bg-amber-100 px-1 rounded">scripts/export_dictionary_full.py</code> untuk mempublikasikan versi baru.
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex gap-4 border-b border-border pb-3 mb-6">
        <button
          onClick={() => setActiveSubTab('applications')}
          className={`pb-1 text-sm font-semibold transition ${
            activeSubTab === 'applications' ? 'text-brand border-b-2 border-brand' : 'text-ink-muted hover:text-brand'
          }`}
        >
          Permohonan Pengajar ({applications.length})
        </button>
        <button
          onClick={() => setActiveSubTab('suggestions')}
          className={`pb-1 text-sm font-semibold transition ${
            activeSubTab === 'suggestions' ? 'text-brand border-b-2 border-brand' : 'text-ink-muted hover:text-brand'
          }`}
        >
          Koreksi Kamus ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`pb-1 text-sm font-semibold transition ${
            activeSubTab === 'reports' ? 'text-brand border-b-2 border-brand' : 'text-ink-muted hover:text-brand'
          }`}
        >
          Laporan Kata ({reports.length})
        </button>
      </div>

      {loading && <div className="text-sm text-ink-muted py-6 text-center">Memuat data...</div>}

      {!loading && activeSubTab === 'applications' && (
        <div className="flex flex-col gap-4">
          {applications.length === 0 ? (
            <div className="text-sm text-ink-faint italic text-center py-8 bg-surface border border-dashed rounded-xl">
              Tidak ada permohonan pengajar yang sedang pending.
            </div>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="card p-6 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-ink">{app.profiles?.display_name || 'Tanpa Nama'}</h3>
                    <p className="text-xs text-ink-faint">Diminta pada: {new Date(app.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-warning-soft text-warning border border-warning rounded-full">
                    Pending
                  </span>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-ink-faint mb-1">Catatan/Alasan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Tulis umpan balik atau alasan jika ditolak..."
                    className="w-full field-input text-xs !py-1.5"
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleReviewApplication(app.id, 'reject')}
                    className="bg-danger-soft hover:bg-red-100 text-danger font-semibold px-4 py-1.5 rounded-xl text-xs transition border border-danger"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => handleReviewApplication(app.id, 'approve')}
                    className="btn-primary !py-1.5 !px-3 text-xs"
                  >
                    Setujui
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && activeSubTab === 'suggestions' && (
        <div className="flex flex-col gap-4">
          {suggestions.length === 0 ? (
            <div className="text-sm text-ink-faint italic text-center py-8 bg-surface border border-dashed rounded-xl">
              Tidak ada usulan koreksi kamus yang sedang pending.
            </div>
          ) : (
            suggestions.map((s) => {
              const displayLemma = s.dictionary?.lemma?.charAt(0).toUpperCase() + s.dictionary?.lemma?.slice(1)

              return (
                <div key={s.id} className="card p-6 flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <div>
                      <h3 className="font-bold text-ink">
                        {displayLemma} <span className="text-xs font-semibold text-ink-faint">({s.dictionary?.pos?.toUpperCase()})</span>
                      </h3>
                      <p className="text-xs text-ink-faint">
                        Diajukan oleh pengajar: <strong>{s.profiles?.display_name}</strong>
                      </p>
                    </div>
                    <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-warning-soft text-warning border border-warning rounded-full">
                      Pending
                    </span>
                  </div>

                  <div>
                    <strong className="text-xs text-ink-muted block mb-1">Koreksi Kolom: <span className="text-brand  font-bold uppercase">{s.field_name}</span></strong>
                    <div className="grid grid-cols-2 gap-4 text-xs bg-surface-muted  p-3 rounded border border-border  mb-3">
                      <div>
                        <span className="text-ink-faint block font-semibold">NILAI SAAT INI:</span>
                        <span className="text-ink-muted font-medium italic">"{s.dictionary?.[s.field_name] || '(kosong)'}"</span>
                      </div>
                      <div>
                        <span className="text-ink-faint block font-semibold">USULAN BARU:</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold italic">"{s.suggested_value || '(kosong)'}"</span>
                      </div>
                    </div>
                    <strong className="text-xs text-ink-muted block mb-1">Alasan Pengajar:</strong>
                    <p className="text-xs text-ink-muted  italic bg-surface-muted  p-2 rounded border border-border ">
                      "{s.reason_for_change}"
                    </p>
                  </div>

                  {reviewingId === s.id ? (
                    /* Suggestions Edit Interface */
                    <div className="bg-brand-soft p-4 border border-brand rounded-xl flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-brand">Ubah & Tinjau Usulan Sebelum Persetujuan</h4>
                      <div>
                        <label className="block text-xs text-ink-faint uppercase font-semibold">Ubah Nilai Usulan ({s.field_name})</label>
                        {s.field_name === 'gender' ? (
                          <select
                            className="w-full field-input text-xs"
                            value={editedSuggestedValue}
                            onChange={(e) => setEditedSuggestedValue(e.target.value)}
                          >
                            <option value="">(Tanpa gender)</option>
                            <option value="m">der (m)</option>
                            <option value="f">die (f)</option>
                            <option value="n">das (n)</option>
                          </select>
                        ) : (
                          <textarea
                            className="w-full field-input text-xs !py-1"
                            value={editedSuggestedValue}
                            onChange={(e) => setEditedSuggestedValue(e.target.value)}
                            rows={s.field_name === 'translations' || s.field_name === 'example' ? 2 : 1}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-ink-faint uppercase font-semibold">Catatan Keputusan Admin (Opsional)</label>
                        <input
                          type="text"
                          placeholder="Umpan balik atau catatan untuk log..."
                          className="w-full field-input text-xs !py-1"
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setReviewingId(null)}
                          className="px-3 py-1 border text-xs rounded hover:bg-surface-muted transition"
                        >
                          Batal Edit
                        </button>
                        <button
                          onClick={() => handleReviewSuggestion(s.id, 'reject')}
                          className="bg-red-550 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded text-xs transition"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleReviewSuggestion(s.id, 'approve')}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Terapkan & Setujui
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Initial View Buttons */
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleReviewSuggestion(s.id, 'reject')}
                        className="bg-danger-soft hover:bg-red-100 text-danger font-semibold px-4 py-1.5 rounded-xl text-xs transition border border-danger"
                      >
                        Tolak Langsung
                      </button>
                      <button
                        onClick={() => startEditSuggestion(s)}
                        className="btn-primary !py-1.5 !px-3 text-xs"
                      >
                        Tinjau & Setujui
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {!loading && activeSubTab === 'reports' && (
        <div className="flex flex-col gap-4">
          {reports.length === 0 ? (
            <div className="text-sm text-ink-faint italic text-center py-8 bg-surface border border-dashed rounded-xl">
              Tidak ada laporan kesalahan kata yang sedang pending.
            </div>
          ) : (
            reports.map((r) => {
              const lemma = r.dictionary?.lemma
              const displayLemma = lemma ? lemma.charAt(0).toUpperCase() + lemma.slice(1) : '(kata dihapus)'

              return (
                <div key={r.id} className="card p-6 flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <div>
                      <h3 className="font-bold text-ink">
                        {displayLemma} <span className="text-xs font-semibold text-ink-faint">({r.dictionary?.pos?.toUpperCase()})</span>
                      </h3>
                      <p className="text-xs text-ink-faint">Dilaporkan pada: {new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 bg-warning-soft text-warning border border-warning rounded-full">
                      Pending
                    </span>
                  </div>

                  <div>
                    <strong className="text-xs text-ink-muted block mb-1">Catatan Pelapor:</strong>
                    <p className="text-xs text-ink-muted italic bg-surface-muted p-2 rounded border border-border">"{r.note}"</p>
                  </div>

                  {editingReportId === r.id ? (
                    <div className="bg-brand-soft p-4 border border-brand rounded-xl flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-brand">Edit Entri Kamus Langsung</h4>
                      <div>
                        <label className="block text-xs text-ink-faint uppercase font-semibold">Terjemahan</label>
                        <textarea
                          className="w-full field-input text-xs !py-1"
                          value={reportEditFields.translations}
                          onChange={(e) => setReportEditFields({ ...reportEditFields, translations: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-ink-faint uppercase font-semibold">Gender</label>
                          <select
                            className="w-full field-input text-xs"
                            value={reportEditFields.gender}
                            onChange={(e) => setReportEditFields({ ...reportEditFields, gender: e.target.value })}
                          >
                            <option value="">(Tanpa gender)</option>
                            <option value="m">der (m)</option>
                            <option value="f">die (f)</option>
                            <option value="n">das (n)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-ink-faint uppercase font-semibold">Plural</label>
                          <input
                            type="text"
                            className="w-full field-input text-xs !py-1"
                            value={reportEditFields.plural}
                            onChange={(e) => setReportEditFields({ ...reportEditFields, plural: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-ink-faint uppercase font-semibold">Kalimat Contoh</label>
                        <textarea
                          className="w-full field-input text-xs !py-1"
                          value={reportEditFields.example}
                          onChange={(e) => setReportEditFields({ ...reportEditFields, example: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setEditingReportId(null)}
                          className="px-3 py-1 border text-xs rounded hover:bg-surface-muted transition"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => handleApplyReportFix(r)}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Terapkan Perbaikan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleDismissReport(r.id)}
                        className="bg-danger-soft hover:bg-red-100 text-danger font-semibold px-4 py-1.5 rounded-xl text-xs transition border border-danger"
                      >
                        Abaikan
                      </button>
                      <button
                        onClick={() => startEditReport(r)}
                        className="btn-primary !py-1.5 !px-3 text-xs"
                      >
                        Lihat & Perbaiki
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
export default AdminConsole
