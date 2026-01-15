# Activity Diagram - Kelola Jurusan (Admin)

```plantuml
@startuml Kelola Jurusan

|Admin|
start
:Buka menu Kelola Jurusan;

|Sistem|
:Tampilkan daftar jurusan;

|Admin|
if (Aksi?) then (Tambah)
  :Isi form jurusan;
  |Sistem|
  :Simpan data;
elseif (Edit)
  :Pilih & edit jurusan;
  |Sistem|
  :Update data;
else (Hapus)
  :Pilih & konfirmasi hapus;
  |Sistem|
  :Hapus data;
endif

|Admin|
:Lihat daftar jurusan;

stop

@enduml
```

## Penjelasan:

### Operasi:
1. **Tambah**: Input jurusan baru (nama wajib unique)
2. **Edit**: Ubah nama/deskripsi jurusan
3. **Hapus**: Hapus jurusan dengan cek relasi

### Validasi:
- Nama jurusan tidak boleh duplikat (case-insensitive)
- Peringatan jika jurusan masih dipakai siswa/PBL/kuis

```mermaid
flowchart TD
    StartAdmin([Admin Masuk Menu Kelola Jurusan]) --> LoadJurusan[Load Semua Data Jurusan dari IndexedDB]
    LoadJurusan --> ShowJurusan{Ada Data Jurusan?}
    
    ShowJurusan -->|Tidak| ShowEmpty[Tampilkan: Belum ada jurusan terdaftar]
    ShowJurusan -->|Ya| DisplayTable[Tampilkan Tabel Jurusan dengan: Nama, Deskripsi, Tanggal Dibuat]
    
    ShowEmpty --> ChoiceAdmin{Pilihan Aksi}
    DisplayTable --> ChoiceAdmin
    
    ChoiceAdmin -->|Tambah Jurusan| ShowFormTambah[Tampilkan Form Tambah Jurusan]
    ChoiceAdmin -->|Edit Jurusan| SelectEdit[Pilih Jurusan untuk Edit]
    ChoiceAdmin -->|Hapus Jurusan| SelectDelete[Pilih Jurusan untuk Hapus]
    ChoiceAdmin -->|Refresh| LoadJurusan
    
    ShowFormTambah --> InputNamaJurusan[Input: Nama Jurusan Singkatan: RPL, TKJ, MM, dll]
    InputNamaJurusan --> InputDeskripsi[Input: Deskripsi Lengkap Opsional]
    InputDeskripsi --> ValidateTambah{Validasi Input?}
    
    ValidateTambah -->|Nama Kosong| ShowErrorKosong[Error: Nama jurusan wajib diisi]
    ShowErrorKosong --> InputNamaJurusan
    
    ValidateTambah -->|Valid| CheckDuplikat{Cek Duplikasi Manual Case-Insensitive}
    
    CheckDuplikat -->|Sudah Ada| ShowErrorDuplikat[Error: Nama jurusan mungkin sudah ada]
    ShowErrorDuplikat --> InputNamaJurusan
    
    CheckDuplikat -->|Belum Ada| GenerateID[Generate ID: JUR-timestamp]
    GenerateID --> CreateJurusan[Buat Object Jurusan: id, nama, deskripsi, createdAt]
    CreateJurusan --> SaveJurusan[Simpan ke IndexedDB objectStore: 'jurusan']
    SaveJurusan --> ShowSuccessTambah[Alert: Jurusan berhasil ditambahkan!]
    ShowSuccessTambah --> CloseForm[Tutup Form]
    CloseForm --> LoadJurusan
    
    SelectEdit --> LoadJurusanData[Load Data Jurusan by ID]
    LoadJurusanData --> ShowFormEdit[Tampilkan Form Edit Terisi Data Lama]
    ShowFormEdit --> EditNama[Edit Nama Jurusan]
    EditNama --> EditDeskripsi[Edit Deskripsi]
    EditDeskripsi --> ValidateEdit{Validasi Edit?}
    
    ValidateEdit -->|Invalid| ShowErrorEdit[Tampilkan Error]
    ShowErrorEdit --> EditNama
    
    ValidateEdit -->|Valid| CheckDuplikatEdit{Nama Duplikat dengan Jurusan Lain?}
    CheckDuplikatEdit -->|Ya| ShowErrorDuplikat
    CheckDuplikatEdit -->|Tidak| UpdateJurusan[Update Data di IndexedDB]
    UpdateJurusan --> ShowSuccessEdit[Alert: Jurusan berhasil diupdate!]
    ShowSuccessEdit --> CloseFormEdit[Tutup Form Edit]
    CloseFormEdit --> LoadJurusan
    
    SelectDelete --> ConfirmDelete{Konfirmasi Hapus?}
    ConfirmDelete -->|Tidak| DisplayTable
    
    ConfirmDelete -->|Ya| CheckRelasi{Cek Relasi: Ada Siswa/Project PBL/Kuis?}
    
    CheckRelasi -->|Ada Relasi| ShowWarning[Warning: Jurusan dipakai oleh X siswa, Y project, Z kuis]
    ShowWarning --> ConfirmForce{Yakin tetap hapus? Data terkait akan terpengaruh}
    
    ConfirmForce -->|Tidak| DisplayTable
    ConfirmForce -->|Ya| DeleteJurusan[Hapus Jurusan dari IndexedDB]
    
    CheckRelasi -->|Tidak Ada| DeleteJurusan
    DeleteJurusan --> ShowSuccessDelete[Alert: Jurusan berhasil dihapus!]
    ShowSuccessDelete --> LoadJurusan
```

## Keterangan Kelola Jurusan:

### Data Jurusan:
```typescript
{
  id: string           // JUR-{timestamp} - auto generated
  nama: string         // Singkatan: RPL, TKJ, MM, AKL, dll
  deskripsi?: string   // Nama lengkap (optional)
  createdAt: string    // ISO timestamp
}
```

### Default Jurusan:
Saat database pertama kali dibuat (onupgradeneeded), sistem auto-insert:
```javascript
[
  { id: 'JUR-1', nama: 'RPL', deskripsi: 'Rekayasa Perangkat Lunak' },
  { id: 'JUR-2', nama: 'TKJ', deskripsi: 'Teknik Komputer dan Jaringan' },
  { id: 'JUR-3', nama: 'MM', deskripsi: 'Multimedia' },
  { id: 'JUR-4', nama: 'AKL', deskripsi: 'Akuntansi dan Keuangan Lembaga' }
]
```

### Operasi CRUD:

1. **CREATE (Tambah Jurusan)**:
   - Input nama jurusan (wajib)
   - Input deskripsi (optional)
   - Validasi: nama tidak boleh kosong
   - Cek duplikasi manual (case-insensitive):
     ```javascript
     const namaBaru = jurusan.nama.trim().toUpperCase()
     const sudahAda = semuaData.some(j => j.nama.trim().toUpperCase() === namaBaru)
     ```
   - Generate ID unik: `JUR-${Date.now()}`
   - Simpan ke IndexedDB

2. **READ (View)**:
   - Load semua jurusan dari `semuaJurusan()`
   - Tampilkan dalam tabel/list
   - Info: Nama, Deskripsi, Tanggal dibuat

3. **UPDATE (Edit)**:
   - Load data jurusan by ID
   - Form pre-filled dengan data lama
   - Bisa edit nama & deskripsi
   - Validasi sama seperti tambah
   - Cek duplikasi (kecuali dengan diri sendiri)
   - Update via `updateJurusan(id, data)`

4. **DELETE (Hapus)**:
   - Konfirmasi sebelum hapus
   - **Cek relasi** dengan:
     - Siswa (field `jurusan`)
     - Project PBL (field `jurusan`)
     - Kuis (field `jurusan`)
   - Warning jika ada relasi
   - Option: tetap hapus atau cancel
   - Hapus via `hapusJurusan(id)`

### Relasi Data:
- **Siswa**: Field `jurusan` (foreign key)
- **Project PBL**: Field `jurusan`
- **Kuis**: Field `jurusan`
- **Materi**: Field `jurusan`

**Risiko Hapus Jurusan**:
- Data siswa/PBL/kuis jadi punya jurusan ID yang tidak valid
- **Solusi**: 
  - Soft delete (tambah flag `isDeleted`)
  - Cascade update (ubah ke jurusan default)
  - Block delete jika ada relasi (recommended)

### UI Features:
- Form modal untuk tambah/edit
- Tabel sederhana (tidak perlu pagination, jurusan sedikit)
- Konfirmasi dialog untuk hapus
- Alert success/error

### IndexedDB:
```javascript
DB_NAME: 'JagatKawruhDB'
STORE_NAME: 'jurusan'
DB_VERSION: 8
Index: 'nama' (non-unique untuk manual check)
```

### Validasi:
1. **Nama**: Required, trim whitespace, case-insensitive duplicate check
2. **Deskripsi**: Optional, max 200 karakter
3. **Unique Check**: Manual loop karena case-insensitive
