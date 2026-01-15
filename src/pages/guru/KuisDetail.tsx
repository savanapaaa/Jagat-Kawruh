import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { kuisAPI } from '../../lib/api'

type KuisStatus = 'Aktif' | 'Draft' | 'Selesai'
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type ChoiceOptions = Record<ChoiceKey, string>

type Question = {
  id: string
  text?: string
  pertanyaan?: string
  image?: string
  options?: ChoiceOptions
  pilihan?: ChoiceOptions
  answer?: ChoiceKey
  jawaban?: ChoiceKey
}

type KuisItem = {
  id: string
  judul: string
  status: KuisStatus
  peserta?: number  // Optional - backend might not return this
  soal: Question[]
}

export default function KuisDetail() {
  const navigate = useNavigate()
  const { quizId } = useParams()
  const [quiz, setQuiz] = useState<KuisItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionInProgress = useRef(false)
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    image: '',
    options: { A: '', B: '', C: '', D: '', E: '' },
    answer: 'A' as ChoiceKey
  })

  useEffect(() => {
    if (!quizId) {
      navigate('/guru/kuis')
      return
    }

    async function fetchKuis() {
      try {
        const response = await kuisAPI.getById(quizId!)
        console.log('API Response:', response)
        
        if (response.success && response.data) {
          console.log('Quiz data:', response.data)
          setQuiz(response.data)
        } else {
          alert('Kuis tidak ditemukan')
          navigate('/guru/kuis')
        }
      } catch (error) {
        console.error('Error loading kuis:', error)
        alert('Gagal memuat detail kuis')
        navigate('/guru/kuis')
      } finally {
        setLoading(false)
      }
    }

    fetchKuis()
  }, [quizId, navigate])

  async function handleStatusChange(newStatus: KuisStatus) {
    if (!quiz) return
    
    try {
      const response = await kuisAPI.update(quiz.id, { status: newStatus })
      if (response.success) {
        setQuiz({ ...quiz, status: newStatus })
        alert('Status kuis berhasil diubah!')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Gagal mengubah status kuis')
    }
  }

  async function handleAddQuestion() {
    if (!quiz || isSubmitting || submissionInProgress.current) return
    
    // Validasi
    if (!newQuestion.text.trim()) {
      alert('Pertanyaan tidak boleh kosong')
      return
    }
    if (!newQuestion.options.A || !newQuestion.options.B || !newQuestion.options.C || !newQuestion.options.D) {
      alert('Pilihan A, B, C, D wajib diisi')
      return
    }

    setIsSubmitting(true)
    submissionInProgress.current = true
    
    try {
      const questionToAdd: Question = {
        id: crypto.randomUUID(),
        text: newQuestion.text,
        ...(newQuestion.image && { image: newQuestion.image }),
        options: newQuestion.options,
        answer: newQuestion.answer
      }

      const updatedSoal = [...(quiz.soal || []), questionToAdd]
      
      // Kirim ke backend
      console.log('Sending soal to backend:', updatedSoal)
      const response = await kuisAPI.update(quiz.id, { soal: updatedSoal })
      console.log('Update response:', response)
      
      // Fetch ulang dari backend untuk memastikan data tersimpan
      const refreshedData = await kuisAPI.getById(quiz.id)
      console.log('Refreshed data from backend:', refreshedData)
      
      if (refreshedData.success && refreshedData.data) {
        setQuiz(refreshedData.data)
      }
      
      // Reset form
      setNewQuestion({
        text: '',
        image: '',
        options: { A: '', B: '', C: '', D: '', E: '' },
        answer: 'A'
      })
      setShowAddForm(false)
      
      alert('Soal berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding question:', error)
      alert('Gagal menambahkan soal')
    } finally {
      setIsSubmitting(false)
      setTimeout(() => { submissionInProgress.current = false }, 100)
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!quiz) return
    if (!confirm('Hapus soal ini?')) return

    try {
      const updatedSoal = quiz.soal.filter(q => q.id !== questionId)
      await kuisAPI.update(quiz.id, { soal: updatedSoal })
      
      // Fetch ulang dari backend
      const refreshedData = await kuisAPI.getById(quiz.id)
      if (refreshedData.success && refreshedData.data) {
        setQuiz(refreshedData.data)
      }
      
      alert('Soal berhasil dihapus!')
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Gagal menghapus soal')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat detail kuis...</p>
      </div>
    )
  }

  if (!quiz) return null

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      {/* Header dengan tombol kembali */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/guru/kuis')}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-wide text-slate-500">DETAIL KUIS</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{quiz.judul}</h1>
        </div>
        <div
          className={
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ' +
            (quiz.status === 'Aktif'
              ? 'bg-amber-100 text-amber-800'
              : quiz.status === 'Selesai'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-700')
          }
        >
          {quiz.status}
        </div>
      </div>

      {/* Info Kuis */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Peserta</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-800">{quiz.peserta || 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Soal</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-800">{quiz.soal?.length || 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Ubah Status</div>
          <select
            value={quiz.status}
            onChange={(e) => handleStatusChange(e.target.value as KuisStatus)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
          >
            <option value="Draft">Draft</option>
            <option value="Aktif">Aktif</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>
      </div>

      {/* Daftar Soal */}
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-extrabold text-slate-800">Daftar Soal</div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {showAddForm ? 'Batal' : '+ Tambah Soal'}
          </button>
        </div>

        {/* Form Tambah Soal */}
        {showAddForm && (
          <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
            <div className="mb-4 text-lg font-bold text-slate-800">Tambah Soal Baru</div>
            
            {/* Pertanyaan */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Pertanyaan *</label>
              <textarea
                value={newQuestion.text}
                onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-amber-500"
                rows={3}
                placeholder="Tulis pertanyaan di sini..."
              />
            </div>

            {/* Upload Gambar (opsional) */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Upload Gambar (opsional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Validasi ukuran (max 2MB)
                    if (file.size > 2 * 1024 * 1024) {
                      alert('Ukuran gambar maksimal 2MB')
                      e.target.value = ''
                      return
                    }
                    
                    // Convert ke base64
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setNewQuestion({ ...newQuestion, image: reader.result as string })
                    }
                    reader.readAsDataURL(file)
                  } else {
                    setNewQuestion({ ...newQuestion, image: '' })
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-amber-500"
              />
              {newQuestion.image && (
                <div className="mt-3">
                  <img 
                    src={newQuestion.image} 
                    alt="Preview" 
                    className="max-h-40 rounded-lg border border-slate-200" 
                  />
                  <button
                    type="button"
                    onClick={() => setNewQuestion({ ...newQuestion, image: '' })}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    Hapus gambar
                  </button>
                </div>
              )}
            </div>

            {/* Pilihan Jawaban */}
            <div className="mb-4 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Pilihan Jawaban *</label>
              {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-8 font-semibold text-slate-600">{key}.</span>
                  <input
                    type="text"
                    value={newQuestion.options[key]}
                    onChange={(e) => setNewQuestion({
                      ...newQuestion,
                      options: { ...newQuestion.options, [key]: e.target.value }
                    })}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-amber-500"
                    placeholder={`Pilihan ${key}${key === 'E' ? ' (opsional)' : ''}`}
                  />
                </div>
              ))}
            </div>

            {/* Jawaban Benar */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Jawaban Benar *</label>
              <select
                value={newQuestion.answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value as ChoiceKey })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-amber-500"
              >
                {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>

            {/* Tombol Simpan */}
            <button
              onClick={handleAddQuestion}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-amber-500 px-6 py-3 font-bold text-white hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Soal'}
            </button>
          </div>
        )}

        {/* Daftar Soal yang Sudah Ada */}
        {!quiz.soal || quiz.soal.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Belum ada pertanyaan.
          </div>
        ) : (
          <div className="space-y-4">
            {quiz.soal.map((q, idx) => {
              const questionText = q.text || q.pertanyaan || 'Soal tidak memiliki teks'
              const choices = q.options || q.pilihan
              const correctAnswer = q.answer || q.jawaban
              
              return (
              <div key={q.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-2 flex items-start justify-between">
                  <div className="font-semibold text-slate-800">
                    Soal {idx + 1}: {questionText}
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    Hapus
                  </button>
                </div>

                {/* Gambar Soal */}
                {q.image && (
                  <div className="mt-3">
                    <img src={q.image} alt={`Soal ${idx + 1}`} className="max-h-64 rounded-xl border border-slate-200" />
                  </div>
                )}

                {choices && correctAnswer ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                      <div key={key} className="flex gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                        <span className="font-semibold text-slate-500">{key}.</span>
                        <span>{choices[key]}</span>
                      </div>
                    ))}
                    <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm">
                      <span className="font-semibold text-amber-800">Jawaban Benar:</span>{' '}
                      <span className="font-semibold text-slate-700">{correctAnswer}</span>
                      <span className="text-slate-600"> — {choices[correctAnswer]}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500 mb-3">(Soal lama: belum ada pilihan)</div>
                    <button
                      onClick={() => {
                        alert('Fitur edit soal lama akan segera hadir. Untuk saat ini, silakan hapus soal ini dan buat ulang dengan pilihan jawaban.')
                      }}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                      Tambah Pilihan Jawaban
                    </button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
