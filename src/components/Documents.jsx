import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Upload, FileText, Download, Trash2, Lock, ShieldAlert } from 'lucide-react'
import { toCsv } from '../utils/workflow'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'

export default function Documents({ canViewSafeguarding = false, isOwnerUser = false, actorInitials = 'ST' }) {
  const [section, setSection] = useState('policies') // 'policies' or 'other'
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [safeguardingReports, setSafeguardingReports] = useState([])
  const [loadingSafeguarding, setLoadingSafeguarding] = useState(false)
  const [safeguardingActionId, setSafeguardingActionId] = useState('')
  const [safeguardingFilter, setSafeguardingFilter] = useState('open')

  useEffect(() => {
    loadDocuments()
  }, [section])

  useEffect(() => {
    if (section !== 'other' || !canViewSafeguarding) return
    loadSafeguardingReports()
  }, [section, canViewSafeguarding])

  async function loadDocuments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('section', section)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])

      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(d => d.category) || [])]
      setCategories(uniqueCategories.sort())
      setSelectedCategory(uniqueCategories[0] || '')
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchSafeguarding(action, body = {}) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken) {
      throw new Error('You must be logged in to access safeguarding reports')
    }

    const response = await fetch('/.netlify/functions/safeguarding-reports', {
      method: body && Object.keys(body).length > 0 ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body && Object.keys(body).length > 0 ? JSON.stringify({ action, ...body }) : undefined,
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Safeguarding request failed')
    }
    return result
  }

  async function loadSafeguardingReports() {
    setLoadingSafeguarding(true)
    try {
      const result = await fetchSafeguarding()
      setSafeguardingReports(result.reports || [])
    } catch (error) {
      console.error('Error loading safeguarding reports:', error)
    } finally {
      setLoadingSafeguarding(false)
    }
  }

  async function downloadSafeguardingReport(report) {
    setSafeguardingActionId(report.id)
    try {
      const result = await fetchSafeguarding('get_download_url', { reportId: report.id })
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert('Error downloading safeguarding report: ' + error.message)
    } finally {
      setSafeguardingActionId('')
    }
  }

  async function closeSafeguardingReport(report) {
    if (!window.confirm(`Mark safeguarding report for ${report.participantName} as resolved/closed?`)) return

    setSafeguardingActionId(report.id)
    try {
      await fetchSafeguarding('close_report', { reportId: report.id, actorInitials })
      await loadSafeguardingReports()
    } catch (error) {
      alert('Error closing safeguarding report: ' + error.message)
    } finally {
      setSafeguardingActionId('')
    }
  }

  async function reopenSafeguardingReport(report) {
    if (!window.confirm(`Reopen safeguarding report for ${report.participantName}?`)) return

    setSafeguardingActionId(report.id)
    try {
      await fetchSafeguarding('reopen_report', { reportId: report.id })
      await loadSafeguardingReports()
    } catch (error) {
      alert('Error reopening safeguarding report: ' + error.message)
    } finally {
      setSafeguardingActionId('')
    }
  }

  async function clearSafeguardingLogs(scope) {
    if (!isOwnerUser) {
      alert('Only the owner account can clear safeguarding logs.')
      return
    }

    const isAll = scope === 'all'
    const label = isAll ? 'all safeguarding logs' : 'closed safeguarding logs'
    const expectedPhrase = isAll ? 'DELETE ALL SAFEGUARDING LOGS' : 'DELETE CLOSED SAFEGUARDING LOGS'

    if (!window.confirm(`This will permanently delete ${label}. Continue?`)) return

    const typedPhrase = window.prompt(`Type exactly to confirm:\n${expectedPhrase}`)
    if (typedPhrase === null) return
    if (typedPhrase !== expectedPhrase) {
      alert('Confirmation text did not match. No records were deleted.')
      return
    }

    const actionKey = isAll ? '__clear_all__' : '__clear_closed__'
    setSafeguardingActionId(actionKey)
    try {
      const result = await fetchSafeguarding('clear_reports', {
        scope,
        confirmPhrase: typedPhrase,
      })
      await loadSafeguardingReports()
      alert(`Deleted ${result.deletedCount || 0} safeguarding report(s).`)
    } catch (error) {
      alert('Error clearing safeguarding reports: ' + error.message)
    } finally {
      setSafeguardingActionId('')
    }
  }

  async function deleteSafeguardingReport(report) {
    if (!isOwnerUser) {
      alert('Only the owner account can delete safeguarding reports.')
      return
    }

    if (!window.confirm(`Delete safeguarding report for ${report.participantName}? This cannot be undone.`)) return

    const expectedPhrase = 'DELETE SAFEGUARDING REPORT'
    const typedPhrase = window.prompt(`Type exactly to confirm:\n${expectedPhrase}`)
    if (typedPhrase === null) return
    if (typedPhrase !== expectedPhrase) {
      alert('Confirmation text did not match. No report was deleted.')
      return
    }

    setSafeguardingActionId(report.id)
    try {
      await fetchSafeguarding('delete_report', {
        reportId: report.id,
        confirmPhrase: typedPhrase,
      })
      await loadSafeguardingReports()
      alert('Safeguarding report deleted.')
    } catch (error) {
      alert('Error deleting safeguarding report: ' + error.message)
    } finally {
      setSafeguardingActionId('')
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedCategory.trim()) {
      alert('Please select a file and category')
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed')
      return
    }

    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      alert('You must be logged in to upload documents')
      return
    }

    setUploading(true)
    try {
      const fileName = `${Date.now()}-${selectedFile.name}`
      const filePath = `${section}/${fileName}`

      console.log('Uploading to path:', filePath)

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile)

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      console.log('Storage upload successful')

      // Save metadata to database
      let { error: dbError } = await supabase.from('documents').insert({
        section,
        filename: selectedFile.name,
        filepath: filePath,
        category: selectedCategory.trim(),
        uploaded_by_initials: actorInitials,
        created_at: new Date().toISOString(),
      })

      if (dbError && String(dbError.message || '').toLowerCase().includes('uploaded_by_initials') && String(dbError.message || '').toLowerCase().includes('does not exist')) {
        const fallback = await supabase.from('documents').insert({
          section,
          filename: selectedFile.name,
          filepath: filePath,
          category: selectedCategory.trim(),
          created_at: new Date().toISOString(),
        })
        dbError = fallback.error
      }

      if (dbError) {
        console.error('Database insert error:', dbError)
        throw dbError
      }

      console.log('Database insert successful')

      setSelectedFile(null)
      setNewCategory('')
      loadDocuments()
      alert('Document uploaded successfully!')
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Error uploading document: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  async function deleteDocument(id, filepath) {
    if (!window.confirm('Are you sure you want to delete this document?')) return

    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([filepath])

      // Delete metadata
      await supabase.from('documents').delete().eq('id', id)

      loadDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Error deleting document')
    }
  }

  async function downloadDocument(filepath, filename) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filepath)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error downloading document')
    }
  }

  function downloadBlob(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function ensureLoggedIn() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      alert('You must be logged in to export data')
      return false
    }
    return true
  }

  async function exportTableCsv(tableName, filenamePrefix) {
    if (!(await ensureLoggedIn())) return
    setExporting(true)
    try {
      const { data, error } = await supabase.from(tableName).select('*')
      if (error) throw error

      const datePart = new Date().toISOString().slice(0, 10)
      const csv = toCsv(data || [])
      downloadBlob(csv, `${filenamePrefix}-${datePart}.csv`, 'text/csv;charset=utf-8')
    } catch (error) {
      console.error(`Error exporting ${tableName}:`, error)
      alert(`Error exporting ${tableName}: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  async function exportJsonBackup() {
    if (!(await ensureLoggedIn())) return
    setExporting(true)
    try {
      const [participantsRes, attendanceRes, incidentsRes, staffRes, documentsRes] = await Promise.all([
        supabase.from('participants').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('incidents').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('documents').select('*'),
      ])

      const errors = [participantsRes.error, attendanceRes.error, incidentsRes.error, staffRes.error, documentsRes.error].filter(Boolean)
      if (errors.length > 0) {
        throw errors[0]
      }

      const payload = {
        generatedAt: new Date().toISOString(),
        participants: participantsRes.data || [],
        attendance: attendanceRes.data || [],
        incidents: incidentsRes.data || [],
        staff: staffRes.data || [],
        documents: documentsRes.data || [],
      }

      const datePart = new Date().toISOString().slice(0, 10)
      downloadBlob(JSON.stringify(payload, null, 2), `camp-db-backup-${datePart}.json`, 'application/json')
    } catch (error) {
      console.error('Error creating JSON backup:', error)
      alert(`Error creating JSON backup: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  const groupedByCategory = documents.reduce((acc, doc) => {
    const cat = doc.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  const filteredSafeguardingReports = safeguardingReports.filter(report => (
    safeguardingFilter === 'all' ? true : report.status === safeguardingFilter
  ))

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Documents</h2>
          <p className="text-stone-500 text-sm mt-1">
            {section === 'policies' 
              ? 'Upload and manage camp policies' 
              : 'Manage visitor logs, safeguarding concerns, and other sensitive documents'}
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setSection('policies')
          }}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all w-full sm:w-auto ${
            section === 'policies'
              ? 'bg-amber-500 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <FileText size={14} className="inline mr-2" />
          Policies
        </button>
        <button
          onClick={() => setSection('other')}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
            section === 'other'
              ? 'bg-amber-500 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <Lock size={14} />
          Other Docs
        </button>
      </div>

      {section === 'other' && canViewSafeguarding && (
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-700" /> Safeguarding Reports
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Restricted to Camp Coordinator, Admins, Director, and the owner account.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { id: 'open', label: 'Active / Open' },
                  { id: 'closed', label: 'Resolved / Closed' },
                  { id: 'all', label: 'All' },
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSafeguardingFilter(option.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${safeguardingFilter === option.id ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {isOwnerUser ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => clearSafeguardingLogs('closed')}
                  disabled={loadingSafeguarding || safeguardingActionId !== ''}
                  className={`btn-secondary text-xs ${loadingSafeguarding || safeguardingActionId !== '' ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  Clear Closed
                </button>
                <button
                  onClick={() => clearSafeguardingLogs('all')}
                  disabled={loadingSafeguarding || safeguardingActionId !== ''}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors ${loadingSafeguarding || safeguardingActionId !== '' ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  Clear All
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Only the owner account can clear logs.</p>
            )}
          </div>

          {loadingSafeguarding ? (
            <p className="text-sm text-stone-500">Loading safeguarding reports...</p>
          ) : filteredSafeguardingReports.length === 0 ? (
            <p className="text-sm text-stone-500">No safeguarding reports logged.</p>
          ) : (
            <div className="space-y-2">
              {filteredSafeguardingReports.map(report => (
                <div key={report.id} className="rounded-xl border border-stone-200 px-4 py-3 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-forest-950">{report.participantName}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${report.status === 'open' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                          <SafeguardingFlagIcon className="px-0 py-0 border-0 bg-transparent" size={11} />
                          {report.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">{report.reportName}</p>
                      <p className="text-xs text-stone-400 mt-1">
                        Raised {new Date(report.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                        {report.raisedByEmail ? ` by ${report.raisedByEmail}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => downloadSafeguardingReport(report)}
                        disabled={safeguardingActionId === report.id}
                        className={`btn-secondary text-xs ${safeguardingActionId === report.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        Download
                      </button>
                      {isOwnerUser && (
                        <button
                          onClick={() => deleteSafeguardingReport(report)}
                          disabled={safeguardingActionId === report.id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors ${safeguardingActionId === report.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Delete
                        </button>
                      )}
                      {report.status === 'open' && (
                        <button
                          onClick={() => closeSafeguardingReport(report)}
                          disabled={safeguardingActionId === report.id}
                          className={`btn-primary text-xs ${safeguardingActionId === report.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Resolve / Close
                        </button>
                      )}
                      {report.status === 'closed' && (
                        <button
                          onClick={() => reopenSafeguardingReport(report)}
                          disabled={safeguardingActionId === report.id}
                          className={`btn-secondary text-xs ${safeguardingActionId === report.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'other' && !canViewSafeguarding && (
        <div className="card flex items-start gap-3 bg-rose-50 border-rose-100">
          <ShieldAlert size={18} className="text-rose-700 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-display font-semibold text-forest-950">Safeguarding Reports</h3>
            <p className="text-sm text-stone-600 mt-1">
              Safeguarding flags remain visible across the app, but full reports are restricted to authorised roles.
            </p>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="font-display font-semibold text-forest-950">Upload New Document</h3>
        
        <div className="space-y-3">
          {/* File input */}
          <div>
            <label className="label">PDF File</label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="input cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-stone-600 mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Category selection */}
          <div>
            <label className="label">Category</label>
            <div className="space-y-2">
              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={e => {
                    setSelectedCategory(e.target.value)
                    setShowAddCategory(false)
                  }}
                  className="input w-full"
                >
                  <option value="">Select existing category...</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
              
              {!showAddCategory ? (
                <button
                  type="button"
                  onClick={() => setShowAddCategory(true)}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  + Add new category
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="Enter new category name"
                    className="input flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCategory.trim()) {
                        setSelectedCategory(newCategory.trim())
                        setNewCategory('')
                        setShowAddCategory(false)
                      }
                    }}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCategory('')
                    }}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {selectedCategory && !showAddCategory && (
              <p className="text-xs text-stone-600 mt-1">
                Will upload to: <span className="font-medium">{selectedCategory}</span>
              </p>
            )}
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedCategory.trim() || uploading}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-display font-medium transition-all ${
              !selectedFile || !selectedCategory.trim() || uploading
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
            }`}
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-display font-semibold text-forest-950">Data Backup & Export</h3>
        <p className="text-xs text-stone-500">
          Download regular backups for safekeeping. JSON contains all core tables in one file.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <button onClick={exportJsonBackup} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {exporting ? 'Working...' : 'Export JSON Backup'}
          </button>
          <button onClick={() => exportTableCsv('participants', 'participants')} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Export Participants CSV
          </button>
          <button onClick={() => exportTableCsv('attendance', 'attendance')} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Export Attendance CSV
          </button>
          <button onClick={() => exportTableCsv('incidents', 'incidents')} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Export Incidents CSV
          </button>
          <button onClick={() => exportTableCsv('staff', 'staff')} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Export Staff CSV
          </button>
          <button onClick={() => exportTableCsv('documents', 'documents')} disabled={exporting} className={`btn-secondary text-sm ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Export Documents CSV
          </button>
        </div>
      </div>

      {/* Documents list */}
      {loading ? (
        <div className="card text-center py-8">
          <p className="text-stone-500">Loading documents...</p>
        </div>
      ) : Object.keys(groupedByCategory).length === 0 ? (
        <div className="card text-center py-8">
          <FileText size={32} className="mx-auto text-stone-300 mb-2" />
          <p className="text-stone-500">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByCategory).map(([category, docs]) => (
            <div key={category} className="card">
              <h3 className="font-display font-semibold text-forest-950 mb-3 pb-2 border-b border-stone-100">
                {category}
              </h3>
              <div className="space-y-2">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={18} className="text-red-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-stone-900 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-stone-500">
                          {new Date(doc.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                          {(doc.uploaded_by_initials || doc.uploadedByInitials) ? ` · Uploaded by ${doc.uploaded_by_initials || doc.uploadedByInitials}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => downloadDocument(doc.filepath, doc.filename)}
                        className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => deleteDocument(doc.id, doc.filepath)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
