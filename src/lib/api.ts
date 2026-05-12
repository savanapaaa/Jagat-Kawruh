/**
 * API Client untuk Jagat Kawruh Backend (Laravel)
 * Base URL: http://localhost:8000/api
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export function formatApiErrorAlert(baseMessage: string, error: any): string {
  const base = String(baseMessage || 'Terjadi kesalahan').trim()

  let errorsObj: any = null
  let rowErrorsObj: any = null
  if (error && typeof error === 'object') {
    const errAny = error as any
    if (errAny.errors && typeof errAny.errors === 'object') {
      errorsObj = errAny.errors
    } else if (errAny.payload && typeof errAny.payload === 'object' && errAny.payload.errors && typeof errAny.payload.errors === 'object') {
      errorsObj = errAny.payload.errors
    }

    if (Array.isArray(errAny.row_errors)) {
      rowErrorsObj = errAny.row_errors
    } else if (errAny.payload && typeof errAny.payload === 'object' && Array.isArray(errAny.payload.row_errors)) {
      rowErrorsObj = errAny.payload.row_errors
    }
  }

  const humanizeField = (field: string): string => {
    const key = String(field || '').trim()
    if (!key) return 'Field'
    const map: Record<string, string> = {
      email: 'Email',
      nis: 'NIS',
      nip: 'NIP',
      nama: 'Nama',
      name: 'Nama',
      password: 'Password',
      kelas_id: 'Kelas',
      jurusan_id: 'Jurusan',
      kelas_ids: 'Kelas',
      jurusan: 'Jurusan',
      kelas: 'Kelas',
      status: 'Status',
      judul: 'Judul',
    }
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const translateValidationMessage = (message: string): string => {
    const msg = String(message ?? '').trim()
    if (!msg) return ''

    // Common Laravel (EN) validation messages → ID
    if (/has already been taken\.?$/i.test(msg)) return 'sudah digunakan.'
    if (/field is required\.?$/i.test(msg) || /is required\.?$/i.test(msg)) return 'wajib diisi.'
    const minChars = msg.match(/must be at least (\d+) characters\.?$/i)
    if (minChars) return `minimal ${minChars[1]} karakter.`
    if (/must be a number\.?$/i.test(msg)) return 'harus berupa angka.'
    if (/must be an integer\.?$/i.test(msg)) return 'harus berupa angka bulat.'
    if (/must be a valid email address\.?$/i.test(msg)) return 'harus berupa email yang valid.'
    if (/^the selected .* is invalid\.?$/i.test(msg) || /selected .* is invalid\.?$/i.test(msg)) return 'pilihan tidak valid.'

    // If message repeats field name (e.g. "The email field ..."), strip common prefix.
    const stripped = msg.replace(/^the\s+/i, '').replace(/\s+field\s+/i, ' ')
    return stripped
  }

  const normalizeErrorLines = (): string[] => {
    const lines: string[] = []

    if (errorsObj && typeof errorsObj === 'object') {
      for (const [field, value] of Object.entries(errorsObj as Record<string, any>)) {
        const label = humanizeField(field)
        if (Array.isArray(value)) {
          for (const msg of value) {
            const s = translateValidationMessage(msg)
            if (s) lines.push(`${label}: ${s}`)
          }
        } else if (value != null) {
          const s = translateValidationMessage(value)
          if (s) lines.push(`${label}: ${s}`)
        }
      }
    }

    if (Array.isArray(rowErrorsObj)) {
      for (const item of rowErrorsObj) {
        if (!item || typeof item !== 'object') continue
        const row = Number((item as any).row ?? (item as any).row_number ?? (item as any).line)
        const rowLabel = Number.isFinite(row) && row > 0 ? `Baris ${row}` : 'Baris import'
        const fieldValue = (item as any).column ?? (item as any).field ?? (item as any).key
        const fieldLabel = fieldValue ? humanizeField(String(fieldValue)) : 'Field'
        const messageValue = (item as any).message ?? (item as any).error ?? (item as any).errors

        if (Array.isArray(messageValue)) {
          for (const msg of messageValue) {
            const s = translateValidationMessage(msg)
            if (s) lines.push(`${rowLabel} - ${fieldLabel}: ${s}`)
          }
        } else if (messageValue && typeof messageValue === 'object') {
          for (const [field, value] of Object.entries(messageValue as Record<string, any>)) {
            const label = humanizeField(field)
            if (Array.isArray(value)) {
              for (const msg of value) {
                const s = translateValidationMessage(msg)
                if (s) lines.push(`${rowLabel} - ${label}: ${s}`)
              }
            } else if (value != null) {
              const s = translateValidationMessage(value)
              if (s) lines.push(`${rowLabel} - ${label}: ${s}`)
            }
          }
        } else if (messageValue != null) {
          const s = translateValidationMessage(messageValue)
          if (s) lines.push(`${rowLabel} - ${fieldLabel}: ${s}`)
        }
      }
    }

    return lines.slice(0, 8)
  }

  const detailLines = normalizeErrorLines()
  const rawMessage = error?.message ? String(error.message).trim() : ''

  if (detailLines.length > 0) {
    return `${base}\n\nPeriksa:\n- ${detailLines.join('\n- ')}\n\nSilakan coba lagi.`
  }

  if (rawMessage && rawMessage.toLowerCase() !== base.toLowerCase()) {
    return `${base}\n\nDetail: ${rawMessage}\n\nSilakan coba lagi.`
  }

  return `${base} Silakan coba lagi.`
}

// Helper untuk get token dari localStorage
function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

// Helper untuk set token
export function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token)
}

// Helper untuk remove token
export function removeAuthToken() {
  localStorage.removeItem('auth_token')
}

// Generic API call helper
type ApiCallOptions = RequestInit & {
  skipAuth?: boolean
}

async function apiCall<T>(
  endpoint: string,
  options: ApiCallOptions = {}
): Promise<{ success: boolean; data?: T; message?: string; errors?: any }> {
  const { skipAuth, ...fetchOptions } = options
  const token = getToken()
  const method = String(fetchOptions.method ?? 'GET').toUpperCase()
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Tambah Authorization header jika ada token
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Tambah Content-Type jika bukan FormData
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  // Avoid stale reads (especially for /profile) when browser/proxy caches GETs.
  const cache: RequestCache | undefined =
    fetchOptions.cache ?? (method === 'GET' ? 'no-store' : undefined)

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      ...(cache ? { cache } : null),
    })

    // Backend may occasionally return non-JSON bodies (e.g., HTML error pages for 413).
    // Parse defensively and keep raw text as a fallback message.
    const rawText = await response.text()
    let data: any = null
    if (rawText && rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText)
      } catch {
        data = { success: false, message: rawText }
      }
    } else {
      data = { success: response.ok }
    }

    if (!response.ok) {
      // Handle error responses
      if (response.status === 401) {
        // Unauthorized - remove token and redirect to login
        removeAuthToken()
        window.location.href = '/login'
        throw new Error('Unauthorized - silakan login kembali')
      }

      if (response.status === 413) {
        const err: any = new Error('Ukuran file terlalu besar. Silakan gunakan file yang lebih kecil atau pakai link video.')
        err.status = response.status
        err.payload = data
        throw err
      }

      const err: any = new Error(data.message || `Error ${response.status}: ${response.statusText}`)
      err.status = response.status
      if (data && typeof data === 'object') {
        err.errors = (data as any).errors || (data as any).row_errors || (data as any).rowErrors
        err.payload = data
      }
      throw err
    }

    return data
  } catch (error: any) {
    // Only log non-403 errors to console
    if (error.status !== 403) {
      console.error('API Error:', error)
    }
    // Re-throw dengan message yang lebih jelas
    if (error.message) {
      throw error
    }
    throw new Error('Terjadi kesalahan koneksi ke server')
  }
}

function toQueryString(params?: Record<string, any>): string {
  if (!params) return ''
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    const s = String(value).trim()
    if (s.length === 0) continue
    normalized[key] = s
  }
  const query = new URLSearchParams(normalized).toString()
  return query ? `?${query}` : ''
}

// ===== AUTHENTICATION =====

export const authAPI = {
  async login(email: string, password: string) {
    const response = await apiCall<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    })
    
    if (response.success && response.data?.token) {
      setAuthToken(response.data.token)
    }
    
    return response
  },

  async logout() {
    try {
      await apiCall('/auth/logout', { method: 'POST' })
    } finally {
      removeAuthToken()
    }
  },

  async me() {
    return apiCall<any>('/auth/me')
  },

  async register(data: { email: string; password: string; nama: string; role: string }) {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    })
  },
}

// ===== JURUSAN =====

export const jurusanAPI = {
  async getAll() {
    return apiCall<any>('/jurusan')
  },

  async getById(id: string) {
    return apiCall<any>(`/jurusan/${id}`)
  },

  async create(data: { nama: string; deskripsi: string }) {
    return apiCall('/jurusan', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: { nama: string; deskripsi: string }) {
    return apiCall(`/jurusan/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/jurusan/${id}`, { method: 'DELETE' })
  },
}

// ===== KELAS =====

export const kelasAPI = {
  async getAll(params?: { tingkat?: string; jurusan?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any>(`/kelas${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/kelas/${id}`)
  },

  async create(data: {
    nama: string
    tingkat: string
    jurusan_id: string
  }) {
    return apiCall('/kelas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<{
    nama: string
    tingkat: string
    jurusan_id: string
  }>) {
    return apiCall(`/kelas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/kelas/${id}`, { method: 'DELETE' })
  },
}

// ===== GURU =====

export const guruAPI = {
  async getAll(params?: { per_page?: number; search?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any>(`/guru${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/guru/${id}`)
  },

  async create(data: {
    nip: string
    nama: string
    email: string
    password: string
    kelas_diampu?: number[]
  }) {
    return apiCall('/guru', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<{
    nip: string
    nama: string
    email: string
    password?: string
    kelas_diampu?: number[]
  }>) {
    return apiCall(`/guru/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/guru/${id}`, { method: 'DELETE' })
  },
}

// ===== SISWA =====

export const siswaAPI = {
  async getAll(params?: { kelas_id?: string; kelas?: string; jurusan_id?: string; jurusan?: string; search?: string }) {
    // Backend baru pakai `kelas_id`/`jurusan_id`, backend lama pakai `kelas`/`jurusan`.
    const normalized: Record<string, string> = {}
    const kelasId = params?.kelas_id ?? params?.kelas
    const jurusanId = params?.jurusan_id ?? params?.jurusan

    if (kelasId != null && String(kelasId).trim().length > 0) normalized.kelas_id = String(kelasId)
    if (jurusanId != null && String(jurusanId).trim().length > 0) normalized.jurusan_id = String(jurusanId)
    if (params?.search != null && String(params.search).trim().length > 0) normalized.search = String(params.search)

    const query = new URLSearchParams(normalized).toString()
    return apiCall<any>(`/siswa${query ? `?${query}` : ''}`)
  },

  async me() {
    return apiCall<any>('/siswa/me')
  },

  async getById(id: string) {
    return apiCall<any>(`/siswa/${id}`)
  },

  async create(data: {
    nis: string
    nama: string
    email: string
    password: string
    kelas_id: string
    jurusan_id: string
  }) {
    return apiCall('/siswa', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<{
    nis: string
    nama: string
    email: string
    kelas_id: string
    jurusan_id: string
  }>) {
    return apiCall(`/siswa/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/siswa/${id}`, { method: 'DELETE' })
  },

  async import(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiCall('/siswa/import', {
      method: 'POST',
      body: formData,
    })
  },
}

// ===== KUIS =====

export const kuisAPI = {
  coerceIdArray(ids: Array<string | number> | undefined): Array<string | number> {
    if (!Array.isArray(ids)) return []
    return ids
      .map((v) => {
        if (typeof v === 'number') return v
        const s = String(v).trim()
        if (/^\d+$/.test(s)) return Number(s)
        return s
      })
      .filter((v) => (typeof v === 'number' ? Number.isFinite(v) : String(v).trim().length > 0))
  },

  async getAll(params?: { kelas?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/kuis${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/kuis/${id}`)
  },

  
  // Backend expects: { pertanyaan, image?, pilihan: {A..E}, jawaban }
  // Frontend editors often use: { text, image?, options: {A..E}, answer }
  normalizeSoal(soal: any[]): any[] {
    return (Array.isArray(soal) ? soal : [])
      .filter(Boolean)
      .map((q: any) => {
        const pertanyaan = String(q?.pertanyaan ?? q?.text ?? '').trim()
        const pilihan = q?.pilihan ?? q?.options
        const jawaban = String(q?.jawaban ?? q?.answer ?? '').trim()
        const image = q?.image

        const out: any = {
          pertanyaan,
          pilihan,
          jawaban,
        }
        if (image) out.image = image
        return out
      })
  },

  async create(data: {
    judul: string
    kelas_ids: Array<string | number>
    batas_waktu: number
    status: string
    soal: any[]
    total_soal?: number
    jumlah_soal?: number
    draft_soal_count?: number
  }) {
    const normalizedSoal = kuisAPI.normalizeSoal(data.soal)
    return apiCall('/kuis', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        kelas_ids: kuisAPI.coerceIdArray(data.kelas_ids),
        // Compatibility: some backends use `soal`, others use `questions`.
        soal: normalizedSoal,
        questions: normalizedSoal,
      }),
    })
  },

  async update(id: string, data: any) {
    const payload: any = { ...data }
    const hasSoal = Array.isArray(payload.soal)
    const hasQuestions = Array.isArray(payload.questions)
    if (hasSoal) payload.soal = kuisAPI.normalizeSoal(payload.soal)
    if (hasQuestions) payload.questions = kuisAPI.normalizeSoal(payload.questions)

    // Keep both in sync if one of them was provided.
    if (hasSoal && !hasQuestions) payload.questions = payload.soal
    if (hasQuestions && !hasSoal) payload.soal = payload.questions

    if (Array.isArray(payload.kelas_ids)) {
      payload.kelas_ids = kuisAPI.coerceIdArray(payload.kelas_ids)
    }
    return apiCall(`/kuis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async importSoal(kuisId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)

    return apiCall<any>(`/kuis/${kuisId}/import-soal`, {
      method: 'POST',
      body: formData,
    })
  },

  async delete(id: string) {
    return apiCall(`/kuis/${id}`, { method: 'DELETE' })
  },

  // ===== Attempt System (anti-cheat) =====

  /**
   * Check a single answer (if backend supports it).
   * POST /kuis/{kuisId}/attempts/{attemptId}/check
   * Body: { soal_id, jawaban }
   * Returns: { benar: boolean, jawaban_benar: string }
   */
  async checkAnswer(
    kuisId: string,
    attemptId: string,
    token: string,
    soalId: string,
    jawaban: string
  ) {
    return apiCall<{ benar: boolean; jawaban_benar?: string }>(
      `/kuis/${kuisId}/attempts/${attemptId}/check`,
      {
        method: 'POST',
        headers: { 'X-Attempt-Token': token },
        body: JSON.stringify({ soal_id: soalId, jawaban }),
      }
    )
  },

  async startAttempt(kuisId: string) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/start`, { method: 'POST' })
  },

  async listAttempts(kuisId: string) {
    return apiCall<any>(`/kuis/${kuisId}/attempts`)
  },

  async getAttemptDetail(kuisId: string, attemptId: string) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/${attemptId}`)
  },

  async approveRetake(kuisId: string, attemptId: string) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/${attemptId}/approve-retake`, {
      method: 'POST',
    })
  },

  async getAttemptQuestions(kuisId: string, attemptId: string, token: string) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/${attemptId}/questions`, {
      headers: {
        'X-Attempt-Token': token,
      },
    })
  },

  async autosaveAnswers(
    kuisId: string,
    attemptId: string,
    token: string,
    data: { answers: Record<string, string> }
  ) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/${attemptId}/answers`, {
      method: 'PUT',
      headers: {
        'X-Attempt-Token': token,
      },
      body: JSON.stringify(data),
    })
  },

  async submitAttempt(
    kuisId: string,
    attemptId: string,
    token: string,
    data?: { answers?: Record<string, string>; waktu_selesai?: string }
  ) {
    return apiCall<any>(`/kuis/${kuisId}/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'X-Attempt-Token': token,
      },
      body: JSON.stringify(data ?? {}),
    })
  },

  async submit(id: string, data: {
    siswa_id: string
    jawaban: Record<string, string>
    waktu_mulai: string
    waktu_selesai: string
  }) {
    return apiCall(`/kuis/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getNilai(id: string, params?: { kelas?: string; siswa_id?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/kuis/${id}/nilai${query ? `?${query}` : ''}`)
  },
}

// ===== MATERI =====

export const materiAPI = {
  async getAll(params?: { kelas?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/materi${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/materi/${id}`)
  },

  async create(data: {
    judul: string
    kelas_ids: Array<string | number>
    status: string
    file?: File
    tugas_enabled?: boolean
    pesan_pembelajaran?: string
    link_video?: string
  }) {
    const formData = new FormData()
    formData.append('judul', data.judul)
    // Backend now supports full many-to-many: send kelas_ids[] only
    data.kelas_ids.forEach((k) => {
      formData.append('kelas_ids[]', String(k))
    })
    formData.append('status', data.status)
    if (data.file) formData.append('file', data.file)
    if (typeof data.pesan_pembelajaran === 'string') {
      formData.append('pesan_pembelajaran', data.pesan_pembelajaran)
    }
    if (typeof data.link_video === 'string' && data.link_video.trim().length > 0) {
      formData.append('link_video', data.link_video.trim())
    }
    if (typeof data.tugas_enabled === 'boolean') {
      formData.append('tugas_enabled', data.tugas_enabled ? '1' : '0')
    }
    
    return apiCall('/materi', {
      method: 'POST',
      body: formData,
    })
  },

  async update(
    id: string,
    data: {
      judul?: string
      kelas_ids?: Array<string | number>
      status?: string
      file?: File
      tugas_enabled?: boolean
      pesan_pembelajaran?: string
      link_video?: string
    }
  ) {
    const formData = new FormData()
    // Laravel/PHP commonly does not parse multipart/form-data bodies for PUT requests.
    // Use method spoofing to ensure fields are received server-side.
    formData.append('_method', 'PUT')
    if (data.judul) formData.append('judul', data.judul)
    // Backend now supports full many-to-many: send kelas_ids[] only
    if (data.kelas_ids) {
      data.kelas_ids.forEach((k) => {
        formData.append('kelas_ids[]', String(k))
      })
    }
    if (data.status) formData.append('status', data.status)
    if (data.file) formData.append('file', data.file)
    if (typeof data.pesan_pembelajaran === 'string') {
      formData.append('pesan_pembelajaran', data.pesan_pembelajaran)
    }
    if (typeof data.link_video === 'string') {
      // Allow clearing link by sending empty string
      formData.append('link_video', data.link_video.trim())
    }
    if (typeof data.tugas_enabled === 'boolean') {
      formData.append('tugas_enabled', data.tugas_enabled ? '1' : '0')
    }
    
    return apiCall(`/materi/${id}`, {
      method: 'POST',
      body: formData,
    })
  },

  async delete(id: string) {
    return apiCall(`/materi/${id}`, { method: 'DELETE' })
  },

  async download(id: string) {
    const { blob, filename } = await this.fetchBlob(id)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  },

  async open(id: string) {
    // Open a tab synchronously to avoid popup blockers, then set URL when blob is ready
    const newTab = window.open('', '_blank')
    const { blob } = await this.fetchBlob(id)
    const objectUrl = URL.createObjectURL(blob)

    if (newTab) {
      // Best effort: navigate new tab to the PDF blob
      newTab.location.href = objectUrl
    } else {
      // Fallback if popup blocked: navigate current tab
      window.location.href = objectUrl
    }

    // Don't revoke immediately; the PDF viewer may still be reading it.
    // Revoke after a short delay.
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 60_000)
  },

  async fetchBlob(id: string): Promise<{ blob: Blob; filename: string }> {
    const token = getToken()
    const url = `${API_BASE_URL}/materi/${id}/download`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      let message = `Gagal memuat file (HTTP ${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        // ignore
      }
      const err: any = new Error(message)
      err.status = res.status
      throw err
    }

    const blob = await res.blob()

    // Try to derive a filename from Content-Disposition
    const cd = res.headers.get('content-disposition') || ''
    const match = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
    let filename = `materi-${id}.pdf`
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1])
      } catch {
        filename = match[1]
      }
    }

    return { blob, filename }
  },

  async submitTugas(
    materiId: string,
    data: {
      file: File
      catatan?: string
    }
  ) {
    const formData = new FormData()
    formData.append('file', data.file)
    if (typeof data.catatan === 'string' && data.catatan.trim().length > 0) {
      formData.append('catatan', data.catatan.trim())
    }

    return apiCall<any>(`/materi/${materiId}/submit`, {
      method: 'POST',
      body: formData,
    })
  },

  async getMySubmission(materiId: string) {
    return apiCall<any>(`/materi/${materiId}/submission`)
  },

  async getSubmissions(materiId: string) {
    return apiCall<any>(`/materi/${materiId}/submissions`)
  },

  async nilaiSubmission(submissionId: string, data: { nilai: number; feedback?: string }) {
    const payload: Record<string, unknown> = { nilai: data.nilai }
    if (typeof data.feedback === 'string') payload.feedback = data.feedback
    return apiCall<any>(`/materi/submissions/${submissionId}/nilai`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async fetchSubmissionBlob(submissionId: string): Promise<{ blob: Blob; filename: string }> {
    const token = getToken()
    const url = `${API_BASE_URL}/materi/submissions/${submissionId}/download`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      let message = `Gagal mengunduh file (HTTP ${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        // ignore
      }
      const err: any = new Error(message)
      err.status = res.status
      throw err
    }

    const blob = await res.blob()

    const cd = res.headers.get('content-disposition') || ''
    const match = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
    let filename = `submission-${submissionId}`
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1])
      } catch {
        filename = match[1]
      }
    }

    return { blob, filename }
  },

  async downloadSubmission(submissionId: string) {
    const { blob, filename } = await this.fetchSubmissionBlob(submissionId)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  },
}

// ===== PBL =====

export const pblAPI = {
  async getAll(params?: { kelas_id?: string; kelas?: string; jurusan_id?: string; status?: string }) {
    // Backend terbaru pakai `kelas_id` untuk filter.
    // Backward-compat: masih terima `kelas` lalu dipetakan ke `kelas_id`.
    const normalized: Record<string, string> = {}
    const kelasId = params?.kelas_id ?? params?.kelas
    if (kelasId != null && String(kelasId).trim().length > 0) normalized.kelas_id = String(kelasId)
    if (params?.jurusan_id != null && String(params.jurusan_id).trim().length > 0) normalized.jurusan_id = String(params.jurusan_id)
    if (params?.status != null && String(params.status).trim().length > 0) normalized.status = String(params.status)

    const query = new URLSearchParams(normalized).toString()
    return apiCall<unknown>(`/pbl${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/pbl/${id}`)
  },

  async getSintaks(id: string) {
    return apiCall<any[]>(`/pbl/${id}/sintaks`)
  },

  async createSintaks(pblId: string, data: {
    urutan: number
    judul?: string
    nama_fase?: string
    deskripsi?: string
    instruksi: string
  }) {
    return apiCall(`/pbl/${pblId}/sintaks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateSintaks(pblId: string, sintaksId: string, data: {
    urutan?: number
    judul?: string
    nama_fase?: string
    deskripsi?: string
    instruksi?: string
  }) {
    return apiCall(`/pbl/${pblId}/sintaks/${sintaksId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteSintaks(pblId: string, sintaksId: string) {
    return apiCall(`/pbl/${pblId}/sintaks/${sintaksId}`, {
      method: 'DELETE',
    })
  },

  async getKelompok(pblId: string) {
    return apiCall<any[]>(`/pbl/${pblId}/kelompok`)
  },

  async createKelompok(
    pblId: string,
    data: {
      nama_kelompok: string
      studi_kasus?: string
      // New backend contract
      anggota?: Array<string | number>
      // Legacy fallback (text)
      anggota_kelompok?: string
      // Transitional: some clients send this
      anggota_ids?: Array<string | number>
    }
  ) {
    return apiCall(`/pbl/${pblId}/kelompok`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateKelompok(
    pblId: string,
    kelompokId: string,
    data: {
      nama_kelompok?: string
      studi_kasus?: string
      anggota?: Array<string | number>
      anggota_kelompok?: string
      anggota_ids?: Array<string | number>
    }
  ) {
    return apiCall(`/pbl/${pblId}/kelompok/${kelompokId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteKelompok(pblId: string, kelompokId: string) {
    return apiCall(`/pbl/${pblId}/kelompok/${kelompokId}`, {
      method: 'DELETE',
    })
  },

  async create(data: {
    judul: string
    masalah: string
    tujuan_pembelajaran: string
    panduan: string
    referensi?: string
    // Backend terbaru: many-to-many
    kelas_ids?: Array<string | number>
    // Legacy fallback
    kelas?: string
    jurusan_id: string
    status: string
    deadline: string
  }) {
    const payload: Record<string, unknown> = { ...data }
    if (Array.isArray(payload.kelas_ids)) {
      payload.kelas_ids = kuisAPI.coerceIdArray(payload.kelas_ids as Array<string | number>)
    }
    // Keep legacy `kelas` if caller provides it (some backends still validate it).
    if (typeof payload.kelas === 'string' && payload.kelas.trim().length === 0) {
      delete payload.kelas
    }
    return apiCall('/pbl', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: string, data: any) {
    const payload: Record<string, unknown> = { ...(data as Record<string, unknown>) }
    if (Array.isArray(payload.kelas_ids)) {
      payload.kelas_ids = kuisAPI.coerceIdArray(payload.kelas_ids as Array<string | number>)
    }
    if (typeof payload.kelas === 'string' && payload.kelas.trim().length === 0) {
      delete payload.kelas
    }
    return apiCall(`/pbl/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async delete(id: string) {
    return apiCall(`/pbl/${id}`, { method: 'DELETE' })
  },

  async submitProject(projectId: string, data: { kelompok_id: string; file: File; catatan: string }) {
    const formData = new FormData()
    formData.append('kelompok_id', data.kelompok_id)
    formData.append('file', data.file)
    formData.append('catatan', data.catatan)
    
    return apiCall(`/pbl/${projectId}/submit`, {
      method: 'POST',
      body: formData,
    })
  },

  async getSubmissions(projectId: string) {
    return apiCall<any[]>(`/pbl/${projectId}/submissions`)
  },

  async getLeaderboard(projectId: string) {
    return apiCall<any[]>(`/pbl/${projectId}/leaderboard`)
  },

  async nilaiSubmission(submissionId: string, data: { nilai: number; feedback: string }) {
    return apiCall(`/pbl/submissions/${submissionId}/nilai`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async fetchSubmissionBlob(submissionId: string): Promise<{ blob: Blob; filename: string }> {
    const token = getToken()
    const url = `${API_BASE_URL}/pbl/submissions/${submissionId}/download`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      let message = `Gagal mengunduh file (HTTP ${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        // ignore
      }
      const err: any = new Error(message)
      err.status = res.status
      throw err
    }

    const blob = await res.blob()

    const cd = res.headers.get('content-disposition') || ''
    const match = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
    let filename = `pbl-submission-${submissionId}`
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1])
      } catch {
        filename = match[1]
      }
    }

    return { blob, filename }
  },

  async downloadSubmission(submissionId: string) {
    const { blob, filename } = await this.fetchSubmissionBlob(submissionId)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  },

  /**
   * Guru: override nilai PBL per anggota (individu) dalam 1 kelompok.
   * Backend legacy belum tentu punya endpoint ini; panggilan dari FE sebaiknya best-effort.
   */
  async setNilaiIndividuKelompok(
    pblId: string,
    kelompokId: string,
    data: {
      items: Array<{ siswa_id: string; nilai: number }>
      catatan?: string
    }
  ) {
    return apiCall(`/pbl/${pblId}/kelompok/${kelompokId}/nilai-individu`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  /**
   * Guru: ambil override nilai individu untuk 1 kelompok.
   * Best-effort: jika endpoint belum ada (404), caller harus ignore.
   */
  async getNilaiIndividuKelompok(pblId: string, kelompokId: string) {
    return apiCall<
      Array<{
        siswa_id: string
        nilai: number
        updated_at?: string
      }>
    >(`/pbl/${pblId}/kelompok/${kelompokId}/nilai-individu`)
  },

  // ===== PBL PROGRESS PER SINTAKS =====

  /**
   * Get all progress per sintaks untuk project
   * Response: { pbl_id, kelompok_id, total_sintaks, completed_sintaks, completion_percentage, progress: [...] }
   * 
   * @param kelompokId - Optional, untuk guru melihat progress kelompok tertentu
   */
  async getProgress(pblId: string, kelompokId?: string) {
    const query = kelompokId ? `?kelompok_id=${kelompokId}` : ''
    return apiCall<{
      pbl_id: string
      kelompok_id: string
      total_sintaks: number
      completed_sintaks: number
      completion_percentage: number
      progress: Array<{
        sintaks_id: string
        nama_fase?: string
        judul?: string
        urutan: number
        catatan: string | null
        file_path: string | null
        completed: boolean
        submitted_at: string | null
      }>
    }>(`/pbl/${pblId}/progress${query}`)
  },

  /**
   * Get progress untuk sintaks spesifik
   */
  async getSintaksProgress(pblId: string, sintaksId: string) {
    return apiCall<{
      id: string
      sintaks_id: string
      kelompok_id: string
      catatan: string
      file_path: string | null
      submitted_at: string
    }>(`/pbl/${pblId}/sintaks/${sintaksId}/progress`)
  },

  /**
   * Submit/update progress untuk sintaks
   */
  async submitProgress(pblId: string, sintaksId: string, data: { catatan: string; file?: File | null }) {
    const formData = new FormData()
    formData.append('catatan', data.catatan)
    if (data.file) {
      formData.append('file', data.file)
    }
    
    return apiCall(`/pbl/${pblId}/sintaks/${sintaksId}/progress`, {
      method: 'POST',
      body: formData,
    })
  },

  /**
   * Delete progress untuk sintaks
   */
  async deleteProgress(pblId: string, sintaksId: string) {
    return apiCall(`/pbl/${pblId}/sintaks/${sintaksId}/progress`, {
      method: 'DELETE',
    })
  },

  // ===== PBL JOBDESK (ROLE) PER ANGGOTA =====

  async getJobdesk(pblId: string, kelompokId: string) {
    return apiCall<{
      pbl_id: string
      kelompok_id: string
      jobdesk: Array<{ siswa_id: string; role: string }>
    }>(`/pbl/${pblId}/kelompok/${kelompokId}/jobdesk`)
  },

  async setJobdesk(
    pblId: string,
    kelompokId: string,
    data: {
      jobdesk: Array<{ siswa_id: string; role: string }>
    }
  ) {
    return apiCall(`/pbl/${pblId}/kelompok/${kelompokId}/jobdesk`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // ===== PBL KONTRIBUSI INDIVIDU PER SINTAKS =====

  /**
   * Siswa: ambil kontribusi dirinya untuk 1 sintaks (backend auto-detect kelompok dari auth).
   */
  async getMyKontribusi(pblId: string, sintaksId: string) {
    return apiCall<
      | {
          id: string
          pbl_id: string
          kelompok_id: string
          sintaks_id: string
          sintaks_urutan?: number
          siswa_id: string
          catatan: string
          file_path: string | null
          submitted_at: string | null
        }
      | null
    >(`/pbl/${pblId}/sintaks/${sintaksId}/kontribusi`)
  },

  /**
   * Siswa: submit/update kontribusi dirinya untuk 1 sintaks (catatan + file).
   */
  async submitMyKontribusi(pblId: string, sintaksId: string, data: { catatan: string; file?: File | null }) {
    const formData = new FormData()
    formData.append('catatan', data.catatan)
    if (data.file) formData.append('file', data.file)

    return apiCall(`/pbl/${pblId}/sintaks/${sintaksId}/kontribusi`, {
      method: 'POST',
      body: formData,
    })
  },

  /**
   * Guru: ambil seluruh kontribusi individu untuk 1 kelompok (opsional filter sintaks).
   */
  async getKelompokKontribusi(pblId: string, kelompokId: string, params?: { sintaks_id?: string }) {
    const query = params?.sintaks_id ? `?sintaks_id=${encodeURIComponent(String(params.sintaks_id))}` : ''
    return apiCall<
      Array<{
        id: string
        pbl_id?: string
        kelompok_id: string
        sintaks_id: string
        sintaks_urutan?: number
        siswa_id: string
        catatan: string
        file_path: string | null
        submitted_at: string | null
      }>
    >(`/pbl/${pblId}/kelompok/${kelompokId}/kontribusi${query}`)
  },
}

// ===== NILAI =====

export const nilaiAPI = {
  async getNilai(params?: { siswa_id?: string; kelas?: string; type?: string }) {
    return apiCall<any>(`/nilai${toQueryString(params as any)}`)
  },

  async getNilaiByKelas(kelas: string) {
    return apiCall<any>(`/nilai/kelas/${kelas}`)
  },

  async fetchExportBlob(params?: { type?: 'all' | 'kuis' | 'pbl' | 'materi'; siswa_id?: string; kelas?: string; kelas_id?: string }): Promise<{ blob: Blob; filename: string }> {
    const token = getToken()
    const url = `${API_BASE_URL}/nilai/export${toQueryString(params as any)}`

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      if (res.status === 401) {
        removeAuthToken()
        window.location.href = '/login'
        const err: any = new Error('Unauthorized - silakan login kembali')
        err.status = 401
        throw err
      }

      let message = `Gagal mengunduh Excel (HTTP ${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = String(data.message)
      } catch {
        // ignore
      }
      const err: any = new Error(message)
      err.status = res.status
      throw err
    }

    const blob = await res.blob()

    // Try to derive filename from Content-Disposition
    const cd = res.headers.get('content-disposition') || ''
    const match = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)

    const type = params?.type ?? 'all'
    const date = new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const suffix = `${yyyy}${mm}${dd}`

    let filename = `nilai-${type}-${suffix}.xlsx`
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1])
      } catch {
        filename = match[1]
      }
    }

    return { blob, filename }
  },

  async downloadExport(params?: { type?: 'all' | 'kuis' | 'pbl' | 'materi'; siswa_id?: string; kelas?: string; kelas_id?: string }) {
    const { blob, filename } = await this.fetchExportBlob(params)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  },
}

// ===== NOTIFIKASI =====

export const notifikasiAPI = {
  async getAll(params?: { tipe?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/notifikasi${query ? `?${query}` : ''}`)
  },

  async create(data: { judul: string; pesan: string; tipe: string }) {
    return apiCall('/notifikasi', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async markAsRead(id: string) {
    return apiCall(`/notifikasi/${id}/read`, { method: 'PUT' })
  },

  async delete(id: string) {
    return apiCall(`/notifikasi/${id}`, { method: 'DELETE' })
  },
}

// ===== PROFILE =====

export const profileAPI = {
  async get() {
    return apiCall<any>('/profile')
  },

  async update(data: { nama?: string; email?: string; avatar?: File }) {
    const formData = new FormData()
    // Laravel/PHP commonly does not parse multipart/form-data bodies for PUT requests.
    // Use method spoofing to ensure fields/files are received server-side.
    formData.append('_method', 'PUT')
    if (data.nama) {
      // Some backends use `nama` (ID), others use `name` (EN).
      formData.append('nama', data.nama)
      formData.append('name', data.nama)
    }
    if (data.avatar) formData.append('avatar', data.avatar)
    if (typeof data.email === 'string') {
      const trimmed = data.email.trim()
      if (trimmed) formData.append('email', trimmed)
    }
    
    return apiCall('/profile', {
      method: 'POST',
      body: formData,
    })
  },

  async changePassword(data: {
    current_password: string
    new_password: string
    new_password_confirmation: string
  }) {
    return apiCall('/profile/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

export default {
  auth: authAPI,
  jurusan: jurusanAPI,
  siswa: siswaAPI,
  kuis: kuisAPI,
  materi: materiAPI,
  pbl: pblAPI,
  nilai: nilaiAPI,
  notifikasi: notifikasiAPI,
  profile: profileAPI,
}
