# Activity Diagram - PBL - Review & Penilaian (Guru)

```plantuml
@startuml PBL Review

|Guru|
start
:Buka menu PBL;
:Pilih project & kelompok;

|Sistem|
:Tampilkan submisi kelompok;

|Guru|
:Review hasil pekerjaan;

if (Setuju?) then (ya)
  |Sistem|
  :Tandai approved;
  :Unlock fase berikutnya;
else (tidak)
  |Sistem|
  :Simpan penilaian;
  :Izinkan edit ulang;
endif

stop

@enduml
```

## Penjelasan:

### Workflow Review:
- Guru review submisi kelompok per fase
- Keputusan: Setujui atau Tolak
- Sistem update status dan unlock fase berikutnya

### Sequential Approval:
- Fase berikutnya terbuka setelah fase sebelumnya disetujui

---

## Diagram Lainnya (Legacy)

```mermaid
flowchart TD
    StartGuru([Guru Masuk Menu PBL]) --> ViewProjects[Tampilkan Daftar Project]
    ViewProjects --> ChoiceGuru{Pilihan Aksi}
    
    ChoiceGuru -->|Buat Project Baru| FormProject[Isi Form Project PBL]
    ChoiceGuru -->|Kelola Kelompok| SelectProject[Pilih Project]
    ChoiceGuru -->|Edit Project| EditProject[Edit Project yang Ada]
    ChoiceGuru -->|Hapus Project| DeleteProject[Hapus Project]
    
    FormProject --> InputJudul[Input: Judul, Kelas, Jurusan, Deadline]
    InputJudul --> InputFase1[Input Fase 1: Deskripsi Masalah]
    InputFase1 --> InputFase2[Input Fase 2: Tujuan & Panduan]
    InputFase2 --> InputFase3[Input Fase 3: Referensi]
    InputFase3 --> InputFase4[Input Fase 4: Kriteria Solusi]
    InputFase4 --> SubmitProject[Submit Project]
    SubmitProject --> SaveProject[Simpan ke Database]
    SaveProject --> ViewProjects
    
    SelectProject --> LoadKelompok[Load Daftar Kelompok untuk Project]
    LoadKelompok --> ChoiceKelompok{Pilihan Kelompok}
    
    ChoiceKelompok -->|Buat Kelompok Baru| InputNamaKel[Input Nama Kelompok]
    InputNamaKel --> CreateKelompok[Buat Kelompok Kosong]
    CreateKelompok --> LoadKelompok
    
    ChoiceKelompok -->|Kelola Anggota| ViewAnggota[Tampilkan Anggota Kelompok]
    ViewAnggota --> ChoiceAnggota{Pilihan}
    
    ChoiceAnggota -->|Tambah Anggota| ListSiswa[Tampilkan Daftar Siswa Tersedia]
    ListSiswa --> SelectSiswa[Pilih Siswa Multiple Select]
    SelectSiswa --> AddSiswa[Tambah ke Kelompok]
    AddSiswa --> ViewAnggota
    
    ChoiceAnggota -->|Hapus Anggota| RemoveSiswa[Hapus Siswa dari Kelompok]
    RemoveSiswa --> ViewAnggota
    
    ChoiceAnggota -->|Kembali| LoadKelompok
    
    ChoiceKelompok -->|Lihat Submisi| LoadSubmisi[Load Submisi Kelompok]
    LoadSubmisi --> ReviewFase[Review Submisi Per Fase]
    ReviewFase --> ChoiceReview{Pilihan Review}
    
    ChoiceReview -->|Approve Fase| ApproveFase[Setujui Fase]
    ApproveFase --> UnlockNext[Unlock Fase Berikutnya]
    UnlockNext --> ReviewFase
    
    ChoiceReview -->|Reject Fase| RejectFase[Tolak Fase]
    RejectFase --> ReviewFase
    
    ChoiceReview -->|Beri Nilai| InputNilai[Input Nilai & Feedback]
    InputNilai --> SaveNilai[Simpan Penilaian]
    SaveNilai --> ReviewFase
    
    ChoiceReview -->|Kembali| LoadKelompok
    
    ChoiceKelompok -->|Hapus Kelompok| DeleteKelompok[Hapus Kelompok & Submisi]
    DeleteKelompok --> LoadKelompok
    
    ChoiceKelompok -->|Kembali| ViewProjects
    
    EditProject --> FormProject
    DeleteProject --> ConfirmDelete{Konfirmasi Hapus?}
    ConfirmDelete -->|Ya| RemoveProject[Hapus Project & Semua Data]
    RemoveProject --> ViewProjects
    ConfirmDelete -->|Tidak| ViewProjects
```

## 2.2 Siswa: Kerjakan PBL Per Fase

```mermaid
flowchart TD
    StartSiswa([Siswa Masuk Menu PBL]) --> LoadProjectSiswa[Load Project untuk Kelas/Jurusan Siswa]
    LoadProjectSiswa --> ShowProjects{Ada Project?}
    
    ShowProjects -->|Tidak| ShowEmpty[Tampilkan: Belum ada project]
    ShowEmpty --> EndSiswa([Selesai])
    
    ShowProjects -->|Ya| SelectProjectSiswa[Pilih Project]
    SelectProjectSiswa --> CheckKelompok{Siswa Sudah di Kelompok?}
    
    CheckKelompok -->|Tidak| ShowWarning[Tampilkan Warning: Belum masuk kelompok]
    ShowWarning --> EndSiswa
    
    CheckKelompok -->|Ya| LoadSubmisiKelompok[Load Submisi Kelompok]
    LoadSubmisiKelompok --> ShowKelompokInfo[Tampilkan Info Kelompok & Anggota]
    ShowKelompokInfo --> ShowProgress[Tampilkan Progress Bar 0-100%]
    ShowProgress --> ShowFases[Tampilkan 5 Fase dalam Tabs]
    ShowFases --> SelectFase[Pilih Fase]
    
    SelectFase --> CheckUnlock{Fase Unlocked?}
    
    CheckUnlock -->|Locked| ShowLocked[Tampilkan: Fase sebelumnya harus selesai]
    ShowLocked --> SelectFase
    
    CheckUnlock -->|Unlocked| CheckSubmitted{Sudah Dikumpulkan?}
    
    CheckSubmitted -->|Ya| CheckApproval{Status Approval}
    
    CheckApproval -->|Approved| ShowApproved[Tampilkan: ✓ Disetujui Tidak bisa edit]
    ShowApproved --> SelectFase
    
    CheckApproval -->|Rejected| ShowRejected[Tampilkan: ✕ Ditolak Bisa edit ulang]
    ShowRejected --> EditFase[Edit & Submit Ulang]
    EditFase --> SaveSubmisi[Update Submisi di Database]
    SaveSubmisi --> ShowProgress
    
    CheckApproval -->|Pending| ShowPending[Tampilkan: Menunggu review guru]
    ShowPending --> SelectFase
    
    CheckSubmitted -->|Belum| ShowForm{Form Sesuai Fase}
    
    ShowForm -->|Fase 1| FormFase1[Input: Analisis Masalah]
    ShowForm -->|Fase 2| FormFase2[Input: Rencana Belajar]
    ShowForm -->|Fase 3| FormFase3[Input: Hasil Penyelidikan + Link Referensi]
    ShowForm -->|Fase 4| FormFase4[Input: Solusi/Produk + Link Demo]
    
    FormFase1 --> ValidateFase1{Valid?}
    FormFase2 --> ValidateFase2{Valid?}
    FormFase3 --> ValidateFase3{Valid?}
    FormFase4 --> ValidateFase4{Valid?}
    
    ValidateFase1 -->|Tidak| ShowErrorF1[Tampilkan Error]
    ShowErrorF1 --> FormFase1
    ValidateFase1 -->|Ya| SubmitFase1[Submit Fase 1]
    
    ValidateFase2 -->|Tidak| ShowErrorF2[Tampilkan Error]
    ShowErrorF2 --> FormFase2
    ValidateFase2 -->|Ya| SubmitFase2[Submit Fase 2]
    
    ValidateFase3 -->|Tidak| ShowErrorF3[Tampilkan Error]
    ShowErrorF3 --> FormFase3
    ValidateFase3 -->|Ya| SubmitFase3[Submit Fase 3]
    
    ValidateFase4 -->|Tidak| ShowErrorF4[Tampilkan Error]
    ShowErrorF4 --> FormFase4
    ValidateFase4 -->|Ya| SubmitFase4[Submit Fase 4]
    
    SubmitFase1 --> SaveSubmisi
    SubmitFase2 --> SaveSubmisi
    SubmitFase3 --> SaveSubmisi
    SubmitFase4 --> SaveSubmisi
    
    SaveSubmisi --> UpdateProgress[Update Progress +20%]
    UpdateProgress --> ShowProgress
```

## Keterangan PBL:

### Guru Side:
1. **Buat Project**: Isi 5 fase sekaligus (orientasi masalah → evaluasi)
2. **Buat Kelompok**: Nama kelompok, tambah anggota dari list siswa
3. **Review Submisi**: Per kelompok, per fase, approve/reject
4. **Penilaian**: Nilai akhir + feedback untuk kelompok

### Siswa Side:
1. **Sequential Phases**: Fase 2 baru bisa dikerjakan jika Fase 1 approved
2. **Group Work**: 1 submisi per kelompok, semua anggota lihat yang sama
3. **Progress Tracking**: 20% per fase (100% = semua fase approved + dinilai)
4. **Resubmit**: Bisa edit ulang jika ditolak guru

### 5 Fase PBL:
- **Fase 1**: Orientasi pada Masalah (analisis masalah)
- **Fase 2**: Organisasi Belajar (rencana belajar)
- **Fase 3**: Penyelidikan (hasil investigasi + referensi)
- **Fase 4**: Hasil Karya (solusi/produk + demo)
- **Fase 5**: Evaluasi (penilaian oleh guru)
