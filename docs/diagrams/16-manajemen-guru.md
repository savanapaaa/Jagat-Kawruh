# Activity Diagram - Manajemen Guru (Admin)

## Deskripsi
Fitur untuk Admin mengelola data guru termasuk CRUD dan assignment kelas yang diampu.

```plantuml
@startuml Manajemen Guru

|Admin|
start
:Buka menu Kelola Guru;

|Sistem|
:Load data guru dari API;
:Load data jurusan;
:Load data kelas;
:Tampilkan tabel guru;

|Admin|
if (Aksi?) then (Tambah)
  :Klik Tambah Guru;
  |Sistem|
  :Tampilkan form tambah;
  |Admin|
  :Input NIP, Nama, Email;
  :Input Password;
  :Pilih Kelas Diampu (multiple);
  :Klik Simpan;
  |Sistem|
  :Validasi data;
  :Simpan guru via API;
  :Tampilkan notifikasi sukses;
elseif (Edit) then
  :Pilih guru dari tabel;
  :Klik Edit;
  |Sistem|
  :Tampilkan form dengan data guru;
  |Admin|
  :Ubah data yang diperlukan;
  :Klik Simpan;
  |Sistem|
  :Update guru via API;
  :Tampilkan notifikasi sukses;
else (Hapus)
  :Pilih guru dari tabel;
  :Klik Hapus;
  |Sistem|
  :Tampilkan konfirmasi;
  |Admin|
  :Konfirmasi hapus;
  |Sistem|
  :Hapus guru via API;
  :Tampilkan notifikasi sukses;
endif

|Sistem|
:Reload daftar guru;

|Admin|
stop

@enduml
```

## Flowchart Detail (Mermaid)

```mermaid
flowchart TD
    Start([Admin Buka Menu Kelola Guru]) --> LoadData[Load Data Guru, Jurusan, Kelas]
    LoadData --> ShowTable[Tampilkan Tabel Guru]
    ShowTable --> Choice{Pilihan Aksi}
    
    %% TAMBAH GURU
    Choice -->|Tambah Guru| ClickAdd[Klik Tombol Tambah Guru]
    ClickAdd --> ShowAddForm[Tampilkan Form Tambah]
    ShowAddForm --> InputNIP[Input: NIP]
    InputNIP --> InputNama[Input: Nama Lengkap]
    InputNama --> InputEmail[Input: Email]
    InputEmail --> InputPassword[Input: Password]
    InputPassword --> SelectKelas[Pilih Kelas Diampu - Multiple Select]
    SelectKelas --> ClickSave[Klik Simpan]
    ClickSave --> ValidateAdd{Validasi Data}
    
    ValidateAdd -->|NIP Kosong| ErrorNIP[Error: NIP wajib diisi]
    ErrorNIP --> InputNIP
    
    ValidateAdd -->|Email Invalid| ErrorEmail[Error: Format email salah]
    ErrorEmail --> InputEmail
    
    ValidateAdd -->|Email Sudah Ada| ErrorDuplikat[Error: Email sudah terdaftar]
    ErrorDuplikat --> InputEmail
    
    ValidateAdd -->|Password < 6| ErrorPass[Error: Password min 6 karakter]
    ErrorPass --> InputPassword
    
    ValidateAdd -->|Valid| CallAPICreate[POST /api/guru]
    CallAPICreate --> SuccessAdd[Alert: Guru berhasil ditambahkan]
    SuccessAdd --> CloseForm[Tutup Form]
    CloseForm --> LoadData
    
    %% EDIT GURU
    Choice -->|Edit Guru| SelectEdit[Pilih Guru dari Tabel]
    SelectEdit --> ClickEdit[Klik Tombol Edit]
    ClickEdit --> LoadGuruData[Load Data Guru ke Form]
    LoadGuruData --> ShowEditForm[Tampilkan Form Edit]
    ShowEditForm --> EditFields[Edit: NIP, Nama, Email, Kelas Diampu]
    EditFields --> OptionalPassword[Password Opsional - Kosongkan jika tidak diubah]
    OptionalPassword --> ClickUpdate[Klik Simpan]
    ClickUpdate --> ValidateEdit{Validasi Data Edit}
    
    ValidateEdit -->|Invalid| ErrorEdit[Tampilkan Error]
    ErrorEdit --> EditFields
    
    ValidateEdit -->|Valid| CallAPIUpdate[PUT /api/guru/:id]
    CallAPIUpdate --> SuccessEdit[Alert: Data guru berhasil diupdate]
    SuccessEdit --> CloseForm
    
    %% HAPUS GURU
    Choice -->|Hapus Guru| SelectDelete[Pilih Guru dari Tabel]
    SelectDelete --> ClickDelete[Klik Tombol Hapus]
    ClickDelete --> ShowConfirm[Tampilkan Dialog Konfirmasi]
    ShowConfirm --> ConfirmChoice{Konfirmasi?}
    
    ConfirmChoice -->|Batal| ShowTable
    ConfirmChoice -->|Ya, Hapus| CallAPIDelete[DELETE /api/guru/:id]
    CallAPIDelete --> SuccessDelete[Alert: Guru berhasil dihapus]
    SuccessDelete --> LoadData
    
    %% FILTER/SEARCH
    Choice -->|Search| InputSearch[Input Kata Kunci]
    InputSearch --> FilterData[Filter Tabel Guru]
    FilterData --> ShowTable
    
    Choice -->|Selesai| End([Selesai])
```

## Penjelasan

### Aktor
- **Admin**: Satu-satunya role yang bisa mengelola data guru

### Fitur Utama
1. **Lihat Daftar Guru**: Tabel dengan NIP, Nama, Email, Kelas Diampu
2. **Tambah Guru**: Form input data guru baru
3. **Edit Guru**: Ubah data guru yang sudah ada
4. **Hapus Guru**: Hapus guru dengan konfirmasi
5. **Search/Filter**: Cari guru berdasarkan nama/NIP

### Data Form
| Field | Tipe | Validasi | Wajib |
|-------|------|----------|-------|
| NIP | Text | Unique | ✅ |
| Nama | Text | - | ✅ |
| Email | Email | Format valid, Unique | ✅ |
| Password | Password | Min 6 karakter | ✅ (Tambah) / Opsional (Edit) |
| Kelas Diampu | Multi-select | - | ❌ |

### Kelas Diampu
- Guru bisa mengampu **multiple kelas**
- Ditampilkan sebagai checkbox atau multi-select
- Contoh: X RPL 1, X RPL 2, XI RPL 1

### API Endpoints
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/guru` | Ambil semua guru |
| POST | `/api/guru` | Tambah guru baru |
| PUT | `/api/guru/:id` | Update data guru |
| DELETE | `/api/guru/:id` | Hapus guru |

### Relasi Data
```
Guru
├── Jurusan (belongs to)
└── Kelas Diampu (many to many)
    ├── X RPL 1
    ├── X RPL 2
    └── XI RPL 1
```

### Catatan
- Email guru akan menjadi username untuk login
- Password default bisa diset oleh admin, guru bisa ganti sendiri via profil
- Ketika guru dihapus, data materi/kuis yang dibuat tetap ada (soft reference)
