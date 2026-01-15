# Activity Diagram - Akses Materi (Siswa)

```plantuml
@startuml Akses Materi

|Siswa|
start
:Buka menu Materi;

|Sistem|
:Filter materi sesuai\nkelas & jurusan;
:Tampilkan daftar materi;

|Siswa|
:Pilih materi;

|Sistem|
:Tampilkan konten materi;

|Siswa|
:Akses & pelajari materi;

stop

@enduml
```

## Penjelasan:

### Akses Materi:
- Sistem filter otomatis sesuai kelas/jurusan siswa
- Materi berupa PDF, Video, atau Link eksternal
- Siswa dapat mengakses dan mempelajari materi

## 4.1 Guru: Upload & Kelola Materi

```mermaid
flowchart TD
    StartGuru([Guru Masuk Menu Materi]) --> ViewMateri[Tampilkan Daftar Materi]
    ViewMateri --> ChoiceGuru{Pilihan Aksi}
    
    ChoiceGuru -->|Upload Materi Baru| FormUpload[Tampilkan Form Upload]
    ChoiceGuru -->|Edit Materi| SelectEdit[Pilih Materi Edit]
    ChoiceGuru -->|Hapus Materi| SelectDelete[Pilih Materi Hapus]
    
    FormUpload --> InputJudul[Input: Judul Materi]
    InputJudul --> InputDeskripsi[Input: Deskripsi]
    InputDeskripsi --> SelectKelas[Pilih Kelas Target]
    SelectKelas --> SelectJurusan[Pilih Jurusan Target]
    SelectJurusan --> ChoiceFile{Pilih Tipe File}
    
    ChoiceFile -->|PDF| SelectPDF[Pilih File PDF]
    ChoiceFile -->|Video| InputVideoLink[Input Link Video YouTube/Drive]
    ChoiceFile -->|Link| InputMateriLink[Input URL Materi Eksternal]
    
    SelectPDF --> ValidatePDF{File Valid?}
    ValidatePDF -->|Tidak| ShowErrorPDF[Error: File harus PDF, max 10MB]
    ShowErrorPDF --> SelectPDF
    ValidatePDF -->|Ya| ReadPDF[Baca File sebagai Base64]
    ReadPDF --> PrepareData
    
    InputVideoLink --> ValidateVideo{Link Valid?}
    ValidateVideo -->|Tidak| ShowErrorVideo[Error: Link tidak valid]
    ShowErrorVideo --> InputVideoLink
    ValidateVideo -->|Ya| PrepareData[Siapkan Data untuk Simpan]
    
    InputMateriLink --> ValidateLink{Link Valid?}
    ValidateLink -->|Tidak| ShowErrorLink[Error: URL tidak valid]
    ShowErrorLink --> InputMateriLink
    ValidateLink -->|Ya| PrepareData
    
    PrepareData --> ValidateForm{Semua Field Terisi?}
    ValidateForm -->|Tidak| ShowErrorForm[Tampilkan Error Field Kosong]
    ShowErrorForm --> FormUpload
    
    ValidateForm -->|Ya| SaveMateri[Simpan Materi ke IndexedDB]
    SaveMateri --> ShowSuccess[Tampilkan Success Alert]
    ShowSuccess --> ViewMateri
    
    SelectEdit --> LoadMateri[Load Data Materi]
    LoadMateri --> FormEdit[Tampilkan Form Edit terisi Data Lama]
    FormEdit --> UpdateData[Update Data]
    UpdateData --> SaveUpdate[Simpan Perubahan]
    SaveUpdate --> ViewMateri
    
    SelectDelete --> ConfirmDelete{Konfirmasi Hapus?}
    ConfirmDelete -->|Tidak| ViewMateri
    ConfirmDelete -->|Ya| DeleteMateri[Hapus Materi dari DB]
    DeleteMateri --> ViewMateri
```

## 4.2 Siswa: Akses Materi

```mermaid
flowchart TD
    StartSiswa([Siswa Masuk Menu Materi]) --> LoadMateriSiswa[Load Materi untuk Kelas/Jurusan Siswa]
    LoadMateriSiswa --> ShowMateriList{Ada Materi?}
    
    ShowMateriList -->|Tidak| ShowEmpty[Tampilkan: Belum ada materi]
    ShowEmpty --> EndSiswa([Selesai])
    
    ShowMateriList -->|Ya| DisplayCards[Tampilkan Kartu Materi dengan Info: Judul, Deskripsi, Guru, Tanggal, Tipe]
    DisplayCards --> ChoiceSiswa{Pilihan Siswa}
    
    ChoiceSiswa -->|Buka Materi| CheckType{Tipe Materi?}
    
    CheckType -->|PDF| ShowPDF[Tampilkan PDF dalam Modal/Iframe]
    CheckType -->|Video| OpenVideo[Buka Link Video di Tab Baru]
    CheckType -->|Link| OpenLink[Buka Link Materi di Tab Baru]
    
    ShowPDF --> ChoiceAfterView{Pilihan}
    OpenVideo --> ChoiceAfterView
    OpenLink --> ChoiceAfterView
    
    ChoiceAfterView -->|Download PDF| DownloadPDF[Download File PDF]
    DownloadPDF --> DisplayCards
    
    ChoiceAfterView -->|Tutup| DisplayCards
    
    ChoiceAfterView -->|Kembali ke List| DisplayCards
    
    ChoiceSiswa -->|Filter| FilterMateri{Filter By?}
    FilterMateri -->|Kelas| FilterKelas[Filter per Kelas]
    FilterMateri -->|Jurusan| FilterJurusan[Filter per Jurusan]
    FilterMateri -->|Search| SearchMateri[Search by Judul/Deskripsi]
    
    FilterKelas --> ApplyFilter[Terapkan Filter]
    FilterJurusan --> ApplyFilter
    SearchMateri --> ApplyFilter
    ApplyFilter --> DisplayCards
```

## Keterangan Materi:

### Guru Side:
1. **3 Tipe Materi**:
   - **PDF**: Upload file PDF (max 10MB), disimpan sebagai base64 di IndexedDB
   - **Video**: Link eksternal (YouTube, Google Drive, dll)
   - **Link**: URL eksternal (website, dokumentasi, dll)

2. **Target Kelas/Jurusan**: Materi bisa ditargetkan ke kelas & jurusan tertentu

3. **Metadata**: Judul, deskripsi, pembuat (guru), tanggal upload

### Siswa Side:
1. **Auto Filter**: Hanya tampil materi sesuai kelas/jurusan siswa
2. **View Options**:
   - PDF: Tampil dalam modal/iframe, bisa download
   - Video/Link: Buka di tab baru
3. **Search & Filter**: Cari materi by judul atau filter by kelas/jurusan

### Storage:
- **IndexedDB**: File PDF disimpan sebagai base64
- **Links**: Hanya URL disimpan, file sebenarnya di eksternal
- **Offline Support**: PDF bisa diakses offline, video/link butuh internet

### Validasi:
- PDF max 10MB
- Link harus format URL valid
- Semua field wajib diisi
