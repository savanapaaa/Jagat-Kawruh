# Activity Diagram - Kelola Siswa (Admin)

```plantuml
@startuml Kelola Siswa

|Admin|
start
:Buka menu Kelola Siswa;

|Sistem|
:Tampilkan daftar siswa;

|Admin|
if (Aksi?) then (Tambah)
  :Isi form data siswa;
  |Sistem|
  :Simpan data;
elseif (Edit)
  :Pilih & edit data siswa;
  |Sistem|
  :Update data;
else (Hapus)
  :Pilih & konfirmasi hapus;
  |Sistem|
  :Hapus data;
endif

|Admin|
:Lihat daftar siswa;

stop

@enduml
```

## Penjelasan:

### Swimlane:
- **Admin**: Aktivitas administrator
- **Sistem**: Proses sistem

### Operasi CRUD:
1. **Tambah**: Input data siswa baru dengan validasi
2. **Edit**: Ubah data siswa yang sudah ada
3. **Hapus**: Hapus siswa dengan konfirmasi

### Validasi:
- Email format dan unique
- Password minimum 6 karakter
- Semua field wajib diisi
- Kelas dan jurusan dari dropdown

```mermaid
flowchart TD
    StartAdmin([Admin Masuk Menu Kelola Siswa]) --> LoadSiswa[Load Semua Data Siswa]
    LoadSiswa --> ShowTable[Tampilkan Tabel Siswa]
    ShowTable --> ChoiceAdmin{Pilihan Aksi}
    
    ChoiceAdmin -->|Tambah Siswa| FormTambah[Tampilkan Form Tambah]
    ChoiceAdmin -->|Edit Siswa| SelectEdit[Pilih Siswa Edit]
    ChoiceAdmin -->|Hapus Siswa| SelectDelete[Pilih Siswa Hapus]
    ChoiceAdmin -->|Filter/Search| FilterData[Filter/Search Siswa]
    
    FormTambah --> InputEmail[Input: Email]
    InputEmail --> InputPassword[Input: Password]
    InputPassword --> InputNama[Input: Nama Lengkap]
    InputNama --> InputKelas[Pilih Kelas X/XI/XII]
    InputKelas --> InputJurusan[Pilih Jurusan]
    InputJurusan --> ValidateTambah{Validasi Data?}
    
    ValidateTambah -->|Email Invalid| ShowErrorEmail[Error: Format email salah]
    ShowErrorEmail --> InputEmail
    
    ValidateTambah -->|Email Sudah Ada| ShowErrorDuplikat[Error: Email sudah terdaftar]
    ShowErrorDuplikat --> InputEmail
    
    ValidateTambah -->|Password Kurang 6 Karakter| ShowErrorPass[Error: Password min 6 karakter]
    ShowErrorPass --> InputPassword
    
    ValidateTambah -->|Field Kosong| ShowErrorKosong[Error: Semua field wajib diisi]
    ShowErrorKosong --> FormTambah
    
    ValidateTambah -->|Valid| CheckEmailUnique{Email Unique?}
    CheckEmailUnique -->|Tidak| ShowErrorDuplikat
    CheckEmailUnique -->|Ya| SaveSiswa[Simpan Siswa ke IndexedDB]
    SaveSiswa --> ShowSuccessTambah[Alert: Siswa berhasil ditambahkan]
    ShowSuccessTambah --> LoadSiswa
    
    SelectEdit --> LoadSiswaData[Load Data Siswa]
    LoadSiswaData --> FormEdit[Tampilkan Form Edit terisi Data Lama]
    FormEdit --> EditData[Edit Nama/Kelas/Jurusan/Password]
    EditData --> ValidateEdit{Validasi Data Edit?}
    
    ValidateEdit -->|Invalid| ShowErrorEdit[Tampilkan Error]
    ShowErrorEdit --> EditData
    
    ValidateEdit -->|Valid| UpdateSiswa[Update Data di IndexedDB]
    UpdateSiswa --> ShowSuccessEdit[Alert: Data siswa berhasil diupdate]
    ShowSuccessEdit --> LoadSiswa
    
    SelectDelete --> ConfirmDelete{Konfirmasi Hapus?}
    ConfirmDelete -->|Tidak| ShowTable
    ConfirmDelete -->|Ya| CheckRelasi{Cek Relasi Data}
    
    CheckRelasi -->|Ada Nilai/Submisi| ShowWarning[Warning: Siswa punya data nilai/PBL]
    ShowWarning --> ConfirmForce{Tetap Hapus?}
    ConfirmForce -->|Tidak| ShowTable
    ConfirmForce -->|Ya| DeleteRelated[Hapus Data Terkait]
    
    CheckRelasi -->|Tidak Ada| DeleteSiswa[Hapus Siswa dari DB]
    DeleteRelated --> DeleteSiswa
    DeleteSiswa --> ShowSuccessDelete[Alert: Siswa berhasil dihapus]
    ShowSuccessDelete --> LoadSiswa
    
    FilterData --> ChoiceFilter{Filter By?}
    ChoiceFilter -->|Kelas| FilterKelas[Filter Siswa per Kelas]
    ChoiceFilter -->|Jurusan| FilterJurusan[Filter Siswa per Jurusan]
    ChoiceFilter -->|Search| SearchSiswa[Search by Nama/Email]
    
    FilterKelas --> ApplyFilter[Terapkan Filter]
    FilterJurusan --> ApplyFilter
    SearchSiswa --> ApplyFilter
    ApplyFilter --> ShowFiltered[Tampilkan Hasil Filter]
    ShowFiltered --> ChoiceAdmin
```

## Keterangan Kelola Siswa:

### Data Siswa:
```typescript
{
  email: string        // Unique, untuk login
  password: string     // Hash/plain untuk autentikasi
  nama: string         // Nama lengkap siswa
  kelas: 'X' | 'XI' | 'XII'
  jurusan: string      // ID jurusan (foreign key)
  createdAt: string    // Timestamp
}
```

### Operasi CRUD:

1. **CREATE (Tambah Siswa)**:
   - Validasi format email
   - Cek email unique (tidak duplikat)
   - Password minimum 6 karakter
   - Kelas dari dropdown (X/XI/XII)
   - Jurusan dari dropdown (load dari tabel jurusan)

2. **READ (View & Filter)**:
   - Tampilkan semua siswa dalam tabel
   - Filter by kelas atau jurusan
   - Search by nama atau email
   - Info: Email, Nama, Kelas, Jurusan, Tanggal Daftar

3. **UPDATE (Edit)**:
   - Bisa edit semua field kecuali email (karena unique key)
   - Validasi sama seperti tambah
   - Update langsung ke IndexedDB

4. **DELETE (Hapus)**:
   - Konfirmasi sebelum hapus
   - Warning jika siswa punya data nilai/PBL/submisi
   - Option: hapus cascade (termasuk data terkait) atau cancel

### Relasi Data:
- **Jurusan**: Foreign key ke tabel jurusan
- **Nilai Kuis**: 1 siswa bisa punya banyak nilai
- **PBL Submisi**: Siswa bisa jadi anggota kelompok PBL
- **Perlu cascade delete** atau **soft delete** untuk integritas data

### UI Features:
- Tabel dengan pagination (jika banyak data)
- Sort by kolom (nama, kelas, jurusan, tanggal)
- Bulk actions (hapus multiple siswa)
- Export data (CSV/Excel) - optional
