import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type ChoiceOptions = Record<ChoiceKey, string>
type KuisStatus = 'Aktif' | 'Draft' | 'Selesai'

type Question = {
  id: string
  text: string
  image?: string
  options: ChoiceOptions
  answer: ChoiceKey
}

const DEFAULT_OPTIONS: ChoiceOptions = { A: '', B: '', C: '', D: '', E: '' }

function isChoiceKey(v: unknown): v is ChoiceKey {
  return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E'
}

function createDraftQuestion(): Question {
  return {
    id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: '',
    options: { ...DEFAULT_OPTIONS },
    answer: 'A',
  }
}

export default function KuisBuatSoal() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { title: string; status: KuisStatus; numQuestions: number } | null

  // Redirect jika tidak ada state
  if (!state) {
    navigate('/guru/kuis')
    return null
  }

  const { title, status, numQuestions } = state
  const [draftQuestions, setDraftQuestions] = useState<Question[]>(() =>
    Array.from({ length: numQuestions }, () => createDraftQuestion())
  )

  const canSubmit = useMemo(() => {
    if (draftQuestions.length === 0) return false
    return draftQuestions.every((q) => {
      if (q.text.trim().length === 0) return false
      const filledAll = (Object.keys(DEFAULT_OPTIONS) as ChoiceKey[]).every((k) => q.options[k].trim().length > 0)
      if (!filledAll) return false
      return q.options[q.answer].trim().length > 0
    })
  }, [draftQuestions])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    // Kirim data kembali ke halaman utama
    navigate('/guru/kuis', {
      state: {
        newKuis: {
          title,
          status,
          questions: draftQuestions.map((q) => ({
            id: q.id,
            text: q.text.trim(),
            image: q.image,
            options: {
              A: q.options.A.trim(),
              B: q.options.B.trim(),
              C: q.options.C.trim(),
              D: q.options.D.trim(),
              E: q.options.E.trim(),
            },
            answer: q.answer,
          })),
        },
      },
    })
  }

  function handleImageUpload(questionId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB')
      return
    }

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar')
      return
    }

    // Convert ke base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setDraftQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, image: base64 } : q))
      )
    }
    reader.readAsDataURL(file)
  }

  function removeImage(questionId: string) {
    setDraftQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, image: undefined } : q))
    )
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/guru/kuis')}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">ISI SOAL KUIS</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Total {numQuestions} soal • Status: {status}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {draftQuestions.map((q, idx) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm font-extrabold text-slate-800">Soal {idx + 1}</div>
              </div>

              <div className="mt-3">
                <label className="text-sm font-semibold text-slate-700">Pertanyaan</label>
                <input
                  value={q.text}
                  onChange={(e) => {
                    const value = e.target.value
                    setDraftQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, text: value } : x)))
                  }}
                  type="text"
                  placeholder="Contoh: 2 + 3 = ..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                />
              </div>

              {/* Upload Gambar Soal */}
              <div className="mt-3">
                <label className="text-sm font-semibold text-slate-700">Gambar Soal (Opsional)</label>
                {q.image ? (
                  <div className="mt-2 space-y-2">
                    <img src={q.image} alt="Soal" className="max-h-48 rounded-xl border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(q.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      🗑️ Hapus Gambar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(q.id, e)}
                        className="hidden"
                      />
                      📷 Upload Gambar
                    </label>
                    <div className="mt-1 text-xs text-slate-500">Max 2MB</div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                  <div key={key}>
                    <label className="text-sm font-semibold text-slate-700">Pilihan {key}</label>
                    <input
                      value={q.options[key]}
                      onChange={(e) => {
                        const value = e.target.value
                        setDraftQuestions((prev) =>
                          prev.map((x) => (x.id === q.id ? { ...x, options: { ...x.options, [key]: value } } : x))
                        )
                      }}
                      type="text"
                      placeholder={`Jawaban ${key}`}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-700">Kunci jawaban</label>
                <select
                  value={q.answer}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!isChoiceKey(value)) return
                    setDraftQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, answer: value } : x)))
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
                <div className="mt-2 text-xs text-slate-500">
                  Jawaban benar: <span className="font-semibold text-slate-700">{q.answer}</span>
                  {q.options[q.answer].trim().length > 0 ? (
                    <span className="text-slate-500"> — {q.options[q.answer].trim()}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-200 bg-white pt-4">
          <button
            type="button"
            onClick={() => navigate('/guru/kuis')}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Batal
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={
              'flex-1 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm ' +
              (canSubmit
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'cursor-not-allowed bg-slate-200 text-slate-500')
            }
          >
            Simpan Kuis
          </button>
        </div>
      </form>
    </div>
  )
}
