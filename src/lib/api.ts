/**
 * API Client untuk Jagat Kawruh Backend (Laravel)
 * Base URL: http://localhost:8000/api
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

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
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; errors?: any }> {
  const token = getToken()
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Tambah Authorization header jika ada token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Tambah Content-Type jika bukan FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      // Handle error responses
      if (response.status === 401) {
        // Unauthorized - remove token and redirect to login
        removeAuthToken()
        window.location.href = '/login'
        throw new Error('Unauthorized - silakan login kembali')
      }
      
      if (response.status === 403) {
        // Forbidden - no access (don't log to console, handled by components)
        throw new Error(data.message || 'Forbidden')
      }
      
      throw new Error(data.message || `Error ${response.status}: ${response.statusText}`)
    }

    return data
  } catch (error: any) {
    // Only log non-403 errors to console
    if (!error.message?.includes('403') && !error.message?.includes('Forbidden')) {
      console.error('API Error:', error)
    }
    // Re-throw dengan message yang lebih jelas
    if (error.message) {
      throw error
    }
    throw new Error('Terjadi kesalahan koneksi ke server')
  }
}

// ===== AUTHENTICATION =====

export const authAPI = {
  async login(email: string, password: string) {
    const response = await apiCall<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
    })
  },
}

// ===== JURUSAN =====

export const jurusanAPI = {
  async getAll() {
    return apiCall<any[]>('/jurusan')
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
    return apiCall<any[]>(`/kelas${query ? `?${query}` : ''}`)
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
    return apiCall<any[]>(`/guru${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/guru/${id}`)
  },

  async create(data: {
    nip: string
    nama: string
    email: string
    password: string
    jurusan_id: string | number
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
    jurusan_id: string | number
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
  async getAll(params?: { kelas?: string; jurusan?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/siswa${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/siswa/${id}`)
  },

  async create(data: {
    nis: string
    nama: string
    email: string
    password: string
    kelas: string
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
    kelas: string
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
  async getAll(params?: { kelas?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/kuis${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/kuis/${id}`)
  },

  async create(data: {
    judul: string
    kelas: string[]
    batas_waktu: number
    status: string
    soal: any[]
  }) {
    return apiCall('/kuis', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: any) {
    return apiCall(`/kuis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/kuis/${id}`, { method: 'DELETE' })
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

  async create(data: { judul: string; kelas: string[]; status: string; file: File }) {
    const formData = new FormData()
    formData.append('judul', data.judul)
    // Kirim kelas sebagai array (Laravel expects kelas[])
    data.kelas.forEach(k => formData.append('kelas[]', k))
    formData.append('status', data.status)
    formData.append('file', data.file)
    
    return apiCall('/materi', {
      method: 'POST',
      body: formData,
    })
  },

  async update(id: string, data: { judul?: string; kelas?: string[]; status?: string; file?: File }) {
    const formData = new FormData()
    if (data.judul) formData.append('judul', data.judul)
    // Kirim kelas sebagai array (Laravel expects kelas[])
    if (data.kelas) data.kelas.forEach(k => formData.append('kelas[]', k))
    if (data.status) formData.append('status', data.status)
    if (data.file) formData.append('file', data.file)
    
    return apiCall(`/materi/${id}`, {
      method: 'PUT',
      body: formData,
    })
  },

  async delete(id: string) {
    return apiCall(`/materi/${id}`, { method: 'DELETE' })
  },

  async download(id: string) {
    const token = getToken()
    const url = `${API_BASE_URL}/materi/${id}/download`
    
    // Open in new tab untuk download
    window.open(`${url}?token=${token}`, '_blank')
  },
}

// ===== PBL =====

export const pblAPI = {
  async getAll(params?: { kelas?: string; jurusan_id?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/pbl${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/pbl/${id}`)
  },

  async getSintaks(id: string) {
    return apiCall<any[]>(`/pbl/${id}/sintaks`)
  },

  async createSintaks(pblId: string, data: {
    urutan: number
    nama_fase: string
    deskripsi: string
    instruksi: string
  }) {
    return apiCall(`/pbl/${pblId}/sintaks`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateSintaks(pblId: string, sintaksId: string, data: {
    urutan?: number
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

  async createKelompok(pblId: string, data: {
    nama_kelompok: string
    anggota_kelompok: string
  }) {
    return apiCall(`/pbl/${pblId}/kelompok`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateKelompok(pblId: string, kelompokId: string, data: {
    nama_kelompok?: string
    anggota_kelompok?: string
  }) {
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
    kelas: string
    jurusan_id: string
    status: string
    deadline: string
  }) {
    return apiCall('/pbl', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: any) {
    return apiCall(`/pbl/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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

  async nilaiSubmission(submissionId: string, data: { nilai: number; feedback: string }) {
    return apiCall(`/pbl/submissions/${submissionId}/nilai`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// ===== NILAI =====

export const nilaiAPI = {
  async getNilai(params?: { siswa_id?: string; kelas?: string; type?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any>(`/nilai${query ? `?${query}` : ''}`)
  },

  async getNilaiByKelas(kelas: string) {
    return apiCall<any[]>(`/nilai/kelas/${kelas}`)
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

// ===== HELPDESK =====

export const helpdeskAPI = {
  async getAll(params?: { status?: string }) {
    const query = new URLSearchParams(params as any).toString()
    return apiCall<any[]>(`/helpdesk${query ? `?${query}` : ''}`)
  },

  async getById(id: string) {
    return apiCall<any>(`/helpdesk/${id}`)
  },

  async create(data: { kategori: string; judul: string; pesan: string }) {
    return apiCall('/helpdesk', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateStatus(id: string, data: { status: string; balasan?: string }) {
    return apiCall(`/helpdesk/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiCall(`/helpdesk/${id}`, { method: 'DELETE' })
  },
}

// ===== PROFILE =====

export const profileAPI = {
  async get() {
    return apiCall<any>('/profile')
  },

  async update(data: { nama?: string; avatar?: File }) {
    const formData = new FormData()
    if (data.nama) formData.append('nama', data.nama)
    if (data.avatar) formData.append('avatar', data.avatar)
    
    return apiCall('/profile', {
      method: 'PUT',
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
  helpdesk: helpdeskAPI,
  profile: profileAPI,
}
