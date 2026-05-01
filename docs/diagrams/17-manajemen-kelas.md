# Activity Diagram - Manajemen Kelas (Admin)

## Deskripsi
Fitur untuk Admin mengelola data kelas termasuk CRUD dengan relasi ke jurusan.

```plantuml
@startuml Manajemen Kelas

|Admin|
start
:Buka menu Kelola Kelas;

|Sistem|
:Load data kelas dari API;
:Load data jurusan;
:Tampilkan tabel kelas\n(sorted by tingkat);

|Admin|
if (Aksi?) then (Tambah)
  :Klik Tambah Kelas;
  |Sistem|
  :Tampilkan form tambah;
  |Admin|
  :Input Nama Kelas;
  :Pilih Tingkat (X/XI/XII);
  :Pilih Jurusan;
  :Klik Simpan;
  |Sistem|
  :Validasi data;
  :Simpan kelas via API;
  :Tampilkan notifikasi sukses;
elseif (Edit) then
  :Pilih kelas dari tabel;
  :Klik Edit;
  |Sistem|
  :Tampilkan form dengan data kelas;
  |Admin|
  :Ubah data yang diperlukan;
  :Klik Simpan;
  |Sistem|
  :Update kelas via API;
  :Tampilkan notifikasi sukses;
else (Hapus)
  :Pilih kelas dari tabel;
  :Klik Hapus;
  |Sistem|
  :Cek relasi dengan siswa/guru;
  if (Ada siswa/guru terkait?) then (Ya)
    :Tampilkan warning\n"Kelas masih memiliki siswa/guru";
  else (Tidak)
    :Tampilkan konfirmasi;
    |Admin|
    :Konfirmasi hapus;
    |Sistem|
    :Hapus kelas via API;
    :Tampilkan notifikasi sukses;
  endif
endif

|Sistem|
:Reload daftar kelas;

|Admin|
stop

@enduml
```

## Flowchart Detail (Mermaid)

```mermaid
flowchart TD
    Start([Admin Buka Menu Kelola Kelas]) --> LoadData[Load Data Kelas & Jurusan]
    LoadData --> SortData[Sort Kelas by Tingkat]
    SortData --> ShowTable[Tampilkan Tabel Kelas]
    ShowTable --> Choice{Pilihan Aksi}
    
    %% TAMBAH KELAS
    Choice -->|Tambah Kelas| ClickAdd[Klik Tombol Tambah Kelas]
    ClickAdd --> ShowAddForm[Tampilkan Form Tambah]
    ShowAddForm --> InputNama[Input: Nama Kelas - contoh: RPL 1]
    InputNama --> SelectTingkat[Pilih Tingkat: X / XI / XII]
    SelectTingkat --> SelectJurusan[Pilih Jurusan]
    SelectJurusan --> ClickSave[Klik Simpan]
    ClickSave --> ValidateAdd{Validasi Data}
    
    ValidateAdd -->|Nama Kosong| ErrorNama[Error: Nama kelas wajib diisi]
    ErrorNama --> InputNama
    
    ValidateAdd -->|Tingkat Tidak Dipilih| ErrorTingkat[Error: Pilih tingkat kelas]
    ErrorTingkat --> SelectTingkat
    
    ValidateAdd -->|Jurusan Tidak Dipilih| ErrorJurusan[Error: Pilih jurusan]
    ErrorJurusan --> SelectJurusan
    
    ValidateAdd -->|Duplikat Nama+Tingkat+Jurusan| ErrorDuplikat[Error: Kelas sudah ada]
    ErrorDuplikat --> InputNama
    
    ValidateAdd -->|Valid| CallAPICreate[POST /api/kelas]
    CallAPICreate --> SuccessAdd[Alert: Kelas berhasil ditambahkan]
    SuccessAdd --> CloseForm[Tutup Form]
    CloseForm --> LoadData
    
    %% EDIT KELAS
    Choice -->|Edit Kelas| SelectEdit[Pilih Kelas dari Tabel]
    SelectEdit --> ClickEdit[Klik Tombol Edit]
    ClickEdit --> LoadKelasData[Load Data Kelas ke Form]
    LoadKelasData --> ShowEditForm[Tampilkan Form Edit]
    ShowEditForm --> EditFields[Edit: Nama, Tingkat, Jurusan]
    EditFields --> ClickUpdate[Klik Simpan]
    ClickUpdate --> ValidateEdit{Validasi Data Edit}
    
    ValidateEdit -->|Invalid| ErrorEdit[Tampilkan Error]
    ErrorEdit --> EditFields
    
    ValidateEdit -->|Valid| CallAPIUpdate[PUT /api/kelas/:id]
    CallAPIUpdate --> SuccessEdit[Alert: Data kelas berhasil diupdate]
    SuccessEdit --> CloseForm
    
    %% HAPUS KELAS
    Choice -->|Hapus Kelas| SelectDelete[Pilih Kelas dari Tabel]
    SelectDelete --> ClickDelete[Klik Tombol Hapus]
    ClickDelete --> CheckRelation{Cek Relasi}
    
    CheckRelation -->|Ada Siswa Terdaftar| WarningRelation[Warning: Kelas memiliki siswa terdaftar]
    WarningRelation --> ShowTable
    
    CheckRelation -->|Ada Guru Mengampu| WarningGuru[Warning: Kelas diampu guru]
    WarningGuru --> ForceDelete{Tetap Hapus?}
    ForceDelete -->|Tidak| ShowTable
    ForceDelete -->|Ya| CallAPIDelete
    
    CheckRelation -->|Tidak Ada Relasi| ShowConfirm[Tampilkan Dialog Konfirmasi]
    ShowConfirm --> ConfirmChoice{Konfirmasi?}
    
    ConfirmChoice -->|Batal| ShowTable
    ConfirmChoice -->|Ya, Hapus| CallAPIDelete[DELETE /api/kelas/:id]
    CallAPIDelete --> SuccessDelete[Alert: Kelas berhasil dihapus]
    SuccessDelete --> LoadData
    
    %% FILTER
    Choice -->|Filter by Tingkat| SelectFilter[Pilih Tingkat X/XI/XII]
    SelectFilter --> FilterData[Filter Tabel]
    FilterData --> ShowTable
    
    Choice -->|Selesai| End([Selesai])
```

## Penjelasan

### Aktor
- **Admin**: Satu-satunya role yang bisa mengelola data kelas

### Fitur Utama
1. **Lihat Daftar Kelas**: Tabel dengan Nama, Tingkat, Jurusan
2. **Tambah Kelas**: Form input kelas baru
3. **Edit Kelas**: Ubah data kelas yang sudah ada
4. **Hapus Kelas**: Hapus kelas dengan cek relasi
5. **Filter by Tingkat**: Filter tampilan berdasarkan tingkat

### Data Form
| Field | Tipe | Validasi | Wajib |
|-------|------|----------|-------|
| Nama | Text | Unique per tingkat+jurusan | ✅ |
| Tingkat | Dropdown | X, XI, XII, VII, VIII, IX | ✅ |
| Jurusan | Dropdown | From jurusan table | ✅ |

### Tingkat yang Tersedia
- **SMA/SMK**: X, XI, XII
- **SMP**: VII, VIII, IX

### Contoh Nama Kelas
| Tingkat | Jurusan | Nama | Hasil Display |
|---------|---------|------|---------------|
| X | RPL | 1 | X RPL 1 |
| XI | TKJ | 2 | XI TKJ 2 |
| XII | MM | 1 | XII MM 1 |

### API Endpoints
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/kelas` | Ambil semua kelas |
| POST | `/api/kelas` | Tambah kelas baru |
| PUT | `/api/kelas/:id` | Update data kelas |
| DELETE | `/api/kelas/:id` | Hapus kelas |

### Relasi Data
```
Kelas
├── Jurusan (belongs to)
│   └── id, nama
├── Siswa (has many)
│   └── Daftar siswa di kelas ini
└── Guru (many to many via kelas_diampu)
    └── Guru yang mengampu kelas ini
```

### Validasi Hapus
1. **Cek siswa**: Jika ada siswa di kelas, tampilkan warning
2. **Cek guru**: Jika ada guru mengampu, tampilkan warning (bisa force delete)
3. **Tidak ada relasi**: Langsung tampilkan konfirmasi hapus

### Sorting Default
Tabel di-sort berdasarkan:
1. Tingkat (X → XI → XII)
2. Nama kelas (ascending)
