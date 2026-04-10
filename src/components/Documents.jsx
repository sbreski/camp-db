import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Upload, FileText, Download, Trash2, Lock, Eye, EyeOff } from 'lucide-react'

export default function Documents() {
  const [section, setSection] = useState('policies') // 'policies' or 'other'
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [showAddCategory, setShowAddCategory] = useState(false)

  const STAFF_PASSWORD = 'shrek2021'
  const currentSection = section === 'policies' ? 'Policies' : 'Other Docs'
  const requiresAuth = section === 'other'

  useEffect(() => {
    if (!requiresAuth || isAuthenticated) {
      loadDocuments()
    }
  }, [section, isAuthenticated])

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

  async function handleUpload() {
    if (!selectedFile || !selectedCategory.trim()) {
      alert('Please select a file and category')
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed')
      return
    }

    setUploading(true)
    try {
      // Debug: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error:', authError)
        alert('Authentication error: ' + authError.message)
        return
      }
      if (!user) {
        alert('You must be logged in to upload documents')
        return
      }
      console.log('Authenticated user:', user.id)

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
      const { error: dbError } = await supabase.from('documents').insert({
        section,
        filename: selectedFile.name,
        filepath: filePath,
        category: selectedCategory.trim(),
        created_at: new Date().toISOString(),
      })

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

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error downloading document')
    }
  }

  function handlePasswordSubmit() {
    if (passwordInput === STAFF_PASSWORD) {
      setIsAuthenticated(true)
      setShowPasswordPrompt(false)
      setPasswordInput('')
    } else {
      alert('Incorrect password')
      setPasswordInput('')
    }
  }

  if (requiresAuth && !isAuthenticated) {
    return (
      <div className="fade-in max-w-md mx-auto">
        <div className="card border-2 border-amber-200">
          <div className="flex items-center justify-center mb-4">
            <Lock size={28} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-center text-forest-950 mb-2">
            Other Documents
          </h2>
          <p className="text-center text-stone-600 text-sm mb-6">
            This section is password protected. Please enter the password to continue.
          </p>
          <div className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Enter password"
              className="input w-full"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handlePasswordSubmit} className="btn-primary flex-1">
                Unlock
              </button>
              <button onClick={() => setSection('policies')} className="btn-secondary flex-1">
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const groupedByCategory = documents.reduce((acc, doc) => {
    const cat = doc.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Documents</h2>
          <p className="text-stone-500 text-sm mt-1">
            {section === 'policies' 
              ? 'Upload and manage camp policies' 
              : 'Manage visitor logs, safeguarding concerns, and other sensitive documents'}
          </p>
        </div>
        {section === 'other' && isAuthenticated && (
          <button
            onClick={() => { setIsAuthenticated(false); setSection('policies') }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 transition-all"
          >
            <Lock size={14} /> Logout
          </button>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setSection('policies')
            setIsAuthenticated(false)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${
            section === 'policies'
              ? 'bg-amber-500 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <FileText size={14} className="inline mr-2" />
          Policies
        </button>
        <button
          onClick={() => setShowPasswordPrompt(true)}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all flex items-center gap-2 ${
            section === 'other'
              ? 'bg-amber-500 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          <Lock size={14} />
          Other Docs
        </button>
      </div>

      {/* Upload section */}
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
                <div className="flex gap-2">
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
                    className="btn-secondary"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCategory('')
                    }}
                    className="btn-secondary"
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
                    className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all"
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
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Password prompt modal */}
      {showPasswordPrompt && section === 'policies' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
            <div className="p-5 border-b border-stone-100">
              <h3 className="font-display font-bold text-forest-950">Unlock Other Documents</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-stone-600">
                Please enter the password to access other documents.
              </p>
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handlePasswordSubmit()
                }}
                placeholder="Enter password"
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={handlePasswordSubmit} className="btn-primary flex-1">
                Unlock
              </button>
              <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput('') }} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
