# Migration Guide: IndexedDB → Laravel API

Panduan migrasi dari IndexedDB (local storage) ke Laravel Backend API.

## 📋 Checklist Migrasi

### 1. Setup Environment
- [ ] Copy `.env.example` ke `.env`
- [ ] Set `VITE_API_URL` sesuai backend URL
- [ ] Install dependencies jika perlu: `npm install`
- [ ] Test koneksi ke backend: cek `http://localhost:8000/api/auth/me`

### 2. Update Auth System

**File:** `src/lib/auth.ts`

**Before (IndexedDB):**
```typescript
import { loginUser } from './idbSiswa'
```

**After (API):**
```typescript
import { authAPI } from './api'

export async function login(email: string, password: string) {
  const response = await authAPI.login(email, password)
  if (response.success) {
    localStorage.setItem('session', JSON.stringify(response.data.user))
    return response.data.user
  }
  throw new Error(response.message || 'Login gagal')
}
```

### 3. Replace idb* imports dengan API

Ganti semua import dari `idb*.ts` dengan `api.ts`:

#### Jurusan
**Before:**
```typescript
import { semuaJurusan, tambahJurusan, updateJurusan, hapusJurusan } from '../../lib/idbJurusan'
```

**After:**
```typescript
import { jurusanAPI } from '../../lib/api'

// Usage:
const data = await jurusanAPI.getAll()
await jurusanAPI.create({ nama: 'RPL', deskripsi: '...' })
await jurusanAPI.update(id, { nama: 'RPL', deskripsi: '...' })
await jurusanAPI.delete(id)
```

#### Siswa
**Before:**
```typescript
import { semuaSiswa, tambahSiswa } from '../../lib/idbSiswa'
```

**After:**
```typescript
import { siswaAPI } from '../../lib/api'

// Usage:
const data = await siswaAPI.getAll({ kelas: 'XII' })
await siswaAPI.create({ nis: '12345', nama: 'Ahmad', ... })
```

#### Kuis
**Before:**
```typescript
import { semuaKuis, tambahKuis } from '../../lib/idbKuis'
```

**After:**
```typescript
import { kuisAPI } from '../../lib/api'

// Usage:
const data = await kuisAPI.getAll()
await kuisAPI.create({ judul: 'Kuis Algo', kelas: ['XII'], ... })
await kuisAPI.submit(kuisId, { siswa_id, jawaban, ... })
```

#### Materi
**Before:**
```typescript
import { semuaMateri, tambahMateri } from '../../lib/idbMateri'
import { saveFile, getFile } from '../../lib/idbFiles'
```

**After:**
```typescript
import { materiAPI } from '../../lib/api'

// Upload file:
await materiAPI.create({
  judul: 'Algoritma',
  kelas: ['XII'],
  status: 'Aktif',
  file: fileObject
})

// Download file:
materiAPI.download(materiId) // Opens in new tab
```

#### PBL
**Before:**
```typescript
import { semuaProjectPBL, tambahProjectPBL } from '../../lib/idbPBL'
```

**After:**
```typescript
import { pblAPI } from '../../lib/api'

// Usage:
const data = await pblAPI.getAll({ kelas: 'XII' })
await pblAPI.create({ judul: 'Sistem Kasir', ... })
await pblAPI.submitProject(projectId, { kelompok_id, file, catatan })
```

#### Notifikasi
**Before:**
```typescript
import { semuaNotifikasi, tambahNotifikasi } from '../../lib/idbNotifikasi'
```

**After:**
```typescript
import { notifikasiAPI } from '../../lib/api'

// Usage:
const data = await notifikasiAPI.getAll()
await notifikasiAPI.create({ judul: 'Info', pesan: '...', tipe: 'pengumuman' })
await notifikasiAPI.markAsRead(id)
```

#### Helpdesk
**Before:**
```typescript
import { semuaTickets, tambahTicket } from '../../lib/idbHelpdesk'
```

**After:**
```typescript
import { helpdeskAPI } from '../../lib/api'

// Usage:
const data = await helpdeskAPI.getAll({ status: 'open' })
await helpdeskAPI.create({ kategori: 'Akun', judul: '...', pesan: '...' })
await helpdeskAPI.updateStatus(id, { status: 'solved', balasan: '...' })
```

### 4. Update Data Models

Response dari API berbeda dengan IndexedDB. Update interface jika perlu:

**API Response Format:**
```typescript
{
  success: true,
  data: [...], // atau { ... } untuk single item
  message?: string
}
```

**Error Format:**
```typescript
{
  success: false,
  message: string,
  errors?: { field: [messages] }
}
```

### 5. Handle Errors

Tambahkan error handling untuk API calls:

```typescript
async function loadData() {
  try {
    const response = await jurusanAPI.getAll()
    if (response.success) {
      setJurusanList(response.data || [])
    } else {
      alert(response.message || 'Error loading data')
    }
  } catch (error: any) {
    console.error('Error:', error)
    alert(error.message || 'Terjadi kesalahan')
  }
}
```

### 6. Authentication Flow

Update flow untuk handle token:

```typescript
// Login
const response = await authAPI.login(email, password)
if (response.success) {
  // Token otomatis disimpan oleh authAPI.login
  localStorage.setItem('session', JSON.stringify(response.data.user))
  navigate('/dashboard')
}

// Logout
await authAPI.logout()
localStorage.removeItem('session')
navigate('/login')

// Check auth on mount
useEffect(() => {
  async function checkAuth() {
    try {
      const response = await authAPI.me()
      if (response.success) {
        // User is authenticated
      }
    } catch {
      // Redirect to login
      navigate('/login')
    }
  }
  checkAuth()
}, [])
```

### 7. File Upload Changes

**Materi Upload (Before):**
```typescript
// IndexedDB - save as ArrayBuffer
const arrayBuffer = await file.arrayBuffer()
const fileId = await saveFile(file.name, arrayBuffer, file.type)
```

**Materi Upload (After):**
```typescript
// API - send as FormData
await materiAPI.create({
  judul: formData.judul,
  kelas: formData.kelas,
  status: formData.status,
  file: fileObject // File object directly
})
```

**PBL Submission (Before):**
```typescript
const arrayBuffer = await file.arrayBuffer()
await submitProjectPBL({ ..., fileId })
```

**PBL Submission (After):**
```typescript
await pblAPI.submitProject(projectId, {
  kelompok_id: kelompokId,
  file: fileObject,
  catatan: formData.catatan
})
```

### 8. Remove Old Files

Setelah semua migrasi selesai, hapus file-file IndexedDB:

```bash
# Backup dulu jika perlu
git commit -m "Backup before removing IndexedDB files"

# Hapus file idb*
rm src/lib/idbJurusan.ts
rm src/lib/idbSiswa.ts
rm src/lib/idbKuis.ts
rm src/lib/idbMateri.ts
rm src/lib/idbPBL.ts
rm src/lib/idbNotifikasi.ts
rm src/lib/idbHelpdesk.ts
rm src/lib/idbFiles.ts

# Hapus reset-db.html (tidak perlu lagi)
rm public/reset-db.html
```

### 9. Testing Checklist

Setelah migrasi, test semua fitur:

- [ ] **Auth**
  - [ ] Login (guru, siswa, admin)
  - [ ] Logout
  - [ ] Session persistence
  - [ ] Protected routes

- [ ] **Jurusan**
  - [ ] List jurusan
  - [ ] Tambah jurusan
  - [ ] Edit jurusan
  - [ ] Hapus jurusan

- [ ] **Siswa**
  - [ ] List siswa
  - [ ] Tambah siswa
  - [ ] Edit siswa
  - [ ] Hapus siswa
  - [ ] Filter by kelas/jurusan
  - [ ] Import Excel (jika ada)

- [ ] **Kuis**
  - [ ] List kuis
  - [ ] Buat kuis (with images)
  - [ ] Edit kuis
  - [ ] Hapus kuis
  - [ ] Kerjakan kuis (siswa)
  - [ ] Submit jawaban
  - [ ] Lihat nilai

- [ ] **Materi**
  - [ ] List materi
  - [ ] Upload materi PDF
  - [ ] Edit materi
  - [ ] Hapus materi
  - [ ] Download PDF

- [ ] **PBL**
  - [ ] List project
  - [ ] Buat project
  - [ ] Edit project
  - [ ] Hapus project
  - [ ] Buat kelompok
  - [ ] Submit project (siswa)
  - [ ] Nilai submission (guru)

- [ ] **Nilai**
  - [ ] Lihat nilai kuis
  - [ ] Lihat nilai PBL
  - [ ] Export nilai (jika ada)

- [ ] **Notifikasi**
  - [ ] List notifikasi
  - [ ] Mark as read
  - [ ] Delete notifikasi

- [ ] **Helpdesk**
  - [ ] Buat ticket (siswa)
  - [ ] List tickets
  - [ ] Update status (guru)
  - [ ] Delete ticket

- [ ] **Profile**
  - [ ] View profile
  - [ ] Update profile
  - [ ] Upload avatar
  - [ ] Change password

### 10. Performance Optimization

Setelah migrasi berhasil:

- [ ] Add loading states untuk semua API calls
- [ ] Add retry logic untuk failed requests
- [ ] Implement caching jika perlu (React Query / SWR)
- [ ] Add pagination untuk large lists
- [ ] Optimize image uploads (compress before upload)

---

## 🚀 Quick Start

1. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env, set VITE_API_URL
   ```

2. **Start backend Laravel:**
   ```bash
   cd ../backend-laravel
   php artisan serve
   ```

3. **Start frontend:**
   ```bash
   npm run dev
   ```

4. **Test API connection:**
   - Open browser console
   - Run: `await fetch('http://localhost:8000/api/auth/me')`
   - Should return response (401 jika belum login, OK)

5. **Start migration:**
   - Begin with `Login.tsx` (auth)
   - Then `Jurusan.tsx` (simple CRUD)
   - Then `Siswa.tsx`, `Kuis.tsx`, etc.

---

## 📝 Notes

1. **CORS**: Pastikan backend sudah enable CORS untuk `http://localhost:5173`
2. **Token Expiry**: Handle token refresh jika pakai JWT
3. **File Size**: Validate file size sebelum upload (client-side)
4. **Network Errors**: Add proper error handling untuk network failures
5. **Offline Support**: Consider service worker jika perlu offline functionality

---

## 🆘 Troubleshooting

### CORS Error
```
Access to fetch at 'http://localhost:8000/api/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Fix:** Di backend Laravel, pastikan config CORS sudah benar:
```php
// config/cors.php
'allowed_origins' => ['http://localhost:5173'],
```

### 401 Unauthorized
Token tidak valid atau expired.

**Fix:** 
- Check token di localStorage
- Re-login
- Check backend token validation

### 413 Payload Too Large
File upload terlalu besar.

**Fix:** 
- Increase `upload_max_filesize` di `php.ini`
- Add client-side validation untuk file size

### Network Error
Backend tidak running atau URL salah.

**Fix:**
- Check backend `php artisan serve` running
- Check `VITE_API_URL` di `.env`
- Check network tab di browser DevTools

---

Selamat migrasi! 🎉
