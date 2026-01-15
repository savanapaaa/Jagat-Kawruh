# API Endpoints - Jagat Kawruh

Backend Laravel untuk Learning Management System "Jagat Kawruh"

## Base URL
```
http://localhost:8000/api
```

## Authentication
Menggunakan Laravel Sanctum atau JWT. Setiap request (kecuali login/register) harus menyertakan token di header:
```
Authorization: Bearer {token}
```

---

## 1. Authentication

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "guru@smk.sch.id",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "guru@smk.sch.id",
      "nama": "Pak Budi",
      "role": "guru",
      "avatar": null
    },
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

### Register (Admin only)
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nama": "Nama User",
  "role": "siswa|guru|admin"
}
```

### Logout
```http
POST /auth/logout
```

### Get Current User
```http
GET /auth/me
```

---

## 2. Jurusan

### Get All Jurusan
```http
GET /jurusan
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "JUR-1",
      "nama": "RPL",
      "deskripsi": "Rekayasa Perangkat Lunak",
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Jurusan by ID
```http
GET /jurusan/{id}
```

### Create Jurusan (Admin/Guru)
```http
POST /jurusan
```

**Request Body:**
```json
{
  "nama": "RPL",
  "deskripsi": "Rekayasa Perangkat Lunak"
}
```

### Update Jurusan
```http
PUT /jurusan/{id}
```

**Request Body:**
```json
{
  "nama": "RPL",
  "deskripsi": "Rekayasa Perangkat Lunak (Updated)"
}
```

### Delete Jurusan
```http
DELETE /jurusan/{id}
```

---

## 3. Siswa

### Get All Siswa
```http
GET /siswa
```

**Query Parameters:**
- `kelas` (optional): Filter by kelas (X, XI, XII)
- `jurusan` (optional): Filter by jurusan ID
- `search` (optional): Search by nama or NIS

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "siswa-1",
      "nis": "12345",
      "nama": "Ahmad",
      "email": "ahmad@student.sch.id",
      "kelas": "XII",
      "jurusan_id": "JUR-1",
      "jurusan": {
        "id": "JUR-1",
        "nama": "RPL"
      },
      "avatar": null,
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Siswa by ID
```http
GET /siswa/{id}
```

### Create Siswa
```http
POST /siswa
```

**Request Body:**
```json
{
  "nis": "12345",
  "nama": "Ahmad",
  "email": "ahmad@student.sch.id",
  "password": "password123",
  "kelas": "XII",
  "jurusan_id": "JUR-1"
}
```

### Update Siswa
```http
PUT /siswa/{id}
```

### Delete Siswa
```http
DELETE /siswa/{id}
```

### Import Siswa (Bulk)
```http
POST /siswa/import
```

**Request Body (multipart/form-data):**
```
file: excel/csv file
```

---

## 4. Kuis

### Get All Kuis
```http
GET /kuis
```

**Query Parameters:**
- `kelas` (optional)
- `status` (optional): Draft, Aktif, Selesai

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "kuis-1",
      "judul": "Kuis Algoritma",
      "kelas": ["XII"],
      "batas_waktu": 30,
      "jumlah_soal": 10,
      "status": "Aktif",
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Kuis by ID (with questions)
```http
GET /kuis/{id}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "kuis-1",
    "judul": "Kuis Algoritma",
    "kelas": ["XII"],
    "batas_waktu": 30,
    "status": "Aktif",
    "soal": [
      {
        "id": "soal-1",
        "pertanyaan": "Apa itu algoritma?",
        "image": "base64_string_or_url",
        "pilihan": {
          "A": "Langkah-langkah",
          "B": "Program",
          "C": "Kode",
          "D": "Syntax",
          "E": "Compiler"
        },
        "jawaban": "A"
      }
    ]
  }
}
```

### Create Kuis
```http
POST /kuis
```

**Request Body:**
```json
{
  "judul": "Kuis Algoritma",
  "kelas": ["XII"],
  "batas_waktu": 30,
  "status": "Draft",
  "soal": [
    {
      "pertanyaan": "Apa itu algoritma?",
      "image": "base64_encoded_image_optional",
      "pilihan": {
        "A": "Langkah-langkah",
        "B": "Program",
        "C": "Kode",
        "D": "Syntax",
        "E": "Compiler"
      },
      "jawaban": "A"
    }
  ]
}
```

### Update Kuis
```http
PUT /kuis/{id}
```

### Delete Kuis
```http
DELETE /kuis/{id}
```

### Submit Kuis (Siswa)
```http
POST /kuis/{id}/submit
```

**Request Body:**
```json
{
  "siswa_id": "siswa-1",
  "jawaban": {
    "soal-1": "A",
    "soal-2": "B",
    "soal-3": "C"
  },
  "waktu_mulai": "2026-01-12T10:00:00.000Z",
  "waktu_selesai": "2026-01-12T10:15:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nilai": 80,
    "benar": 8,
    "salah": 2,
    "detail": [
      {
        "soal_id": "soal-1",
        "jawaban_siswa": "A",
        "jawaban_benar": "A",
        "benar": true
      }
    ]
  }
}
```

### Get Nilai Kuis Siswa
```http
GET /kuis/{id}/nilai
```

**Query Parameters:**
- `kelas` (optional)
- `siswa_id` (optional)

---

## 5. Materi

### Get All Materi
```http
GET /materi
```

**Query Parameters:**
- `kelas` (optional)
- `status` (optional)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "materi-1",
      "judul": "Pengenalan Algoritma",
      "kelas": ["XII"],
      "file_name": "algoritma.pdf",
      "file_size": 1024000,
      "status": "Aktif",
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Materi by ID
```http
GET /materi/{id}
```

### Create Materi (with file upload)
```http
POST /materi
```

**Request Body (multipart/form-data):**
```
judul: "Pengenalan Algoritma"
kelas: ["XII"]  // JSON array as string
status: "Aktif"
file: PDF file
```

### Update Materi
```http
PUT /materi/{id}
```

**Request Body (multipart/form-data):**
```
judul: "Updated Title"
kelas: ["XII"]
status: "Aktif"
file: PDF file (optional, only if replacing)
```

### Delete Materi
```http
DELETE /materi/{id}
```

### Download Materi File
```http
GET /materi/{id}/download
```

**Response:** File stream (application/pdf)

---

## 6. PBL (Project-Based Learning)

### Get All Projects
```http
GET /pbl
```

**Query Parameters:**
- `kelas` (optional)
- `jurusan_id` (optional)
- `status` (optional): Draft, Aktif, Selesai

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "pbl-1",
      "judul": "Sistem Kasir",
      "masalah": "Toko masih manual",
      "tujuan_pembelajaran": "Membuat sistem kasir",
      "panduan": "Ikuti langkah...",
      "referensi": "https://...",
      "kelas": "XII",
      "jurusan_id": "JUR-1",
      "status": "Aktif",
      "deadline": "2026-02-01",
      "created_by": "guru@smk.sch.id",
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Project by ID
```http
GET /pbl/{id}
```

### Create Project
```http
POST /pbl
```

**Request Body:**
```json
{
  "judul": "Sistem Kasir",
  "masalah": "Toko masih manual",
  "tujuan_pembelajaran": "Membuat sistem kasir",
  "panduan": "Ikuti langkah...",
  "referensi": "https://...",
  "kelas": "XII",
  "jurusan_id": "JUR-1",
  "status": "Draft",
  "deadline": "2026-02-01"
}
```

### Update Project
```http
PUT /pbl/{id}
```

### Delete Project
```http
DELETE /pbl/{id}
```

### Get Kelompok by Project
```http
GET /pbl/{id}/kelompok
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "kelompok-1",
      "project_id": "pbl-1",
      "nama_kelompok": "Kelompok 1",
      "anggota": ["siswa-1", "siswa-2", "siswa-3"],
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Create Kelompok
```http
POST /pbl/{id}/kelompok
```

**Request Body:**
```json
{
  "nama_kelompok": "Kelompok 1",
  "anggota": ["siswa-1", "siswa-2", "siswa-3"]
}
```

### Submit Project (Siswa)
```http
POST /pbl/{id}/submit
```

**Request Body (multipart/form-data):**
```
kelompok_id: "kelompok-1"
file: ZIP/RAR file
catatan: "Hasil project kelompok 1"
```

### Get Submissions by Project
```http
GET /pbl/{id}/submissions
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "submit-1",
      "project_id": "pbl-1",
      "kelompok_id": "kelompok-1",
      "kelompok": {
        "nama_kelompok": "Kelompok 1",
        "anggota": ["Ahmad", "Budi", "Citra"]
      },
      "file_name": "project-kelompok1.zip",
      "file_size": 5242880,
      "catatan": "Hasil project",
      "nilai": null,
      "feedback": null,
      "submitted_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Nilai Submission (Guru)
```http
PUT /pbl/submissions/{id}/nilai
```

**Request Body:**
```json
{
  "nilai": 85,
  "feedback": "Bagus, perlu improvement di UI"
}
```

---
#inibelum yaaa
## 7. Nilai

### Get Nilai Siswa
```http
GET /nilai
```

**Query Parameters:**
- `siswa_id` (required for siswa role)
- `kelas` (optional for guru)
- `type` (optional): kuis, pbl, all

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kuis": [
      {
        "id": "nilai-kuis-1",
        "kuis_id": "kuis-1",
        "kuis_judul": "Kuis Algoritma",
        "siswa_id": "siswa-1",
        "nilai": 80,
        "tanggal": "2026-01-12T10:00:00.000Z"
      }
    ],
    "pbl": [
      {
        "id": "nilai-pbl-1",
        "project_id": "pbl-1",
        "project_judul": "Sistem Kasir",
        "kelompok_id": "kelompok-1",
        "nilai": 85,
        "feedback": "Bagus",
        "tanggal": "2026-01-12T10:00:00.000Z"
      }
    ]
  }
}
```

### Get Nilai by Kelas (Guru)
```http
GET /nilai/kelas/{kelas}
```

**Response:** List semua nilai siswa di kelas tersebut

---

## 8. Notifikasi

### Get All Notifikasi
```http
GET /notifikasi
```

**Query Parameters:**
- `tipe` (optional): kuis, materi, pbl, pengumuman

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-1",
      "judul": "Kuis Baru",
      "pesan": "Ada kuis baru: Algoritma",
      "tipe": "kuis",
      "read": false,
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Create Notifikasi
```http
POST /notifikasi
```

**Request Body:**
```json
{
  "judul": "Pengumuman",
  "pesan": "Libur tanggal 17 Agustus",
  "tipe": "pengumuman"
}
```

### Mark as Read
```http
PUT /notifikasi/{id}/read
```

### Delete Notifikasi
```http
DELETE /notifikasi/{id}
```

---

## 9. Helpdesk

### Get All Tickets
```http
GET /helpdesk
```

**Query Parameters:**
- `status` (optional): open, progress, solved

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ticket-1",
      "siswa_id": "siswa-1",
      "siswa": {
        "nama": "Ahmad",
        "kelas": "XII"
      },
      "kategori": "Akun",
      "judul": "Lupa Password",
      "pesan": "Saya lupa password akun",
      "status": "open",
      "created_at": "2026-01-12T10:00:00.000Z"
    }
  ]
}
```

### Get Ticket by ID
```http
GET /helpdesk/{id}
```

### Create Ticket (Siswa)
```http
POST /helpdesk
```

**Request Body:**
```json
{
  "kategori": "Akun|Kuis|Materi|PBL|Lainnya",
  "judul": "Lupa Password",
  "pesan": "Saya lupa password akun"
}
```

### Update Ticket Status (Guru/Admin)
```http
PUT /helpdesk/{id}/status
```

**Request Body:**
```json
{
  "status": "progress|solved",
  "balasan": "Password sudah direset"
}
```

### Delete Ticket
```http
DELETE /helpdesk/{id}
```

---

## 10. Profil

### Get Profile
```http
GET /profile
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-1",
    "email": "user@example.com",
    "nama": "Nama User",
    "role": "siswa",
    "avatar": "https://...",
    "kelas": "XII",
    "jurusan_id": "JUR-1"
  }
}
```

### Update Profile
```http
PUT /profile
```

**Request Body (multipart/form-data):**
```
nama: "Updated Name"
avatar: image file (optional)
```

### Change Password
```http
PUT /profile/password
```

**Request Body:**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass123",
  "new_password_confirmation": "newpass123"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "email": ["Email sudah terdaftar"],
    "password": ["Password minimal 8 karakter"]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized. Token invalid atau expired"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Anda tidak memiliki akses ke resource ini"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource tidak ditemukan"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Terjadi kesalahan server",
  "error": "Error detail (only in development)"
}
```

---

## Notes untuk Backend Developer

1. **Authentication**: Gunakan Laravel Sanctum untuk API token
2. **File Upload**: 
   - Max size untuk PDF (materi): 10MB
   - Max size untuk image (quiz): 2MB
   - Max size untuk project submission: 50MB
3. **CORS**: Enable CORS untuk `http://localhost:5173` (development)
4. **Validation**: Semua input harus divalidasi
5. **Image Storage**: 
   - Bisa simpan base64 di DB untuk quiz images (karena kecil)
   - Untuk materi PDF dan submission files, simpan di storage
6. **Seeding**: Buat seeder untuk:
   - Default admin: admin@smk.sch.id / admin123
   - Default guru: guru@smk.sch.id / guru123
   - 4 Jurusan default: RPL, TKJ, MM, AKL
7. **Relationship Database**:
   - users (polymorphic: siswa, guru, admin)
   - jurusan
   - kuis → kuis_soal → kuis_hasil
   - materi
   - pbl_projects → pbl_kelompok → pbl_submissions
   - notifikasi
   - helpdesk_tickets
8. **Soft Deletes**: Gunakan soft deletes untuk semua tabel penting
9. **API Rate Limiting**: Batasi request untuk prevent abuse
10. **Logging**: Log semua aktivitas penting (login, submit, dll)

---

## Testing Endpoints

Gunakan **Postman** atau **Thunder Client** untuk testing.

Collection Postman bisa di-generate dari dokumentasi ini.

**Base URL Development:** `http://localhost:8000/api`

**Base URL Production:** `https://jagatakawruh.com/api` (adjust sesuai domain)
