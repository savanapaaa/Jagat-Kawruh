# Activity Diagram - Lihat Nilai Kuis (Guru)

```plantuml
@startuml Nilai Kuis

|Guru|
start
:Buka menu Kuis;
:Pilih kuis;

|Sistem|
:Load data nilai siswa;
:Tampilkan tabel nilai;

|Guru|
:Lihat hasil kuis siswa;

stop

@enduml
```

## Penjelasan:

### Data Nilai:
- Nama siswa, kelas, nilai
- Jumlah benar dari total soal

### Auto Grading:
- Sistem koreksi otomatis saat siswa submit
- Guru hanya melihat hasil

## 3.1 Guru: Buat Kuis (2-Step Wizard)

```mermaid
flowchart TD
    StartGuru([Guru Masuk Menu Kuis]) --> ViewKuis[Tampilkan Daftar Kuis]
    ViewKuis --> ChoiceGuru{Pilihan Aksi}
    
    ChoiceGuru -->|Buat Kuis Baru| Step1[STEP 1: Informasi Kuis]
    ChoiceGuru -->|Lihat Nilai| SelectKuis[Pilih Kuis]
    ChoiceGuru -->|Hapus Kuis| DeleteKuis[Hapus Kuis]
    
    Step1 --> InputInfo[Input: Judul, Kelas, Jurusan, Waktu]
    InputInfo --> InputJumlahSoal[Input: Jumlah Soal]
    InputJumlahSoal --> ValidateStep1{Validasi?}
    
    ValidateStep1 -->|Gagal| ShowError1[Tampilkan Error]
    ShowError1 --> InputInfo
    
    ValidateStep1 -->|Valid| NavigateToStep2[Navigate ke /guru/kuis/buat-soal]
    NavigateToStep2 --> Step2[STEP 2: Isi Soal]
    
    Step2 --> ReceiveState[Terima State dari Step 1]
    ReceiveState --> GenerateForms[Generate Form Sesuai Jumlah Soal]
    GenerateForms --> LoopSoal[Untuk Setiap Soal]
    
    LoopSoal --> InputSoal[Input: Pertanyaan, Opsi A-D, Jawaban Benar]
    InputSoal --> ValidateSoal{Soal Valid?}
    
    ValidateSoal -->|Tidak| HighlightError[Highlight Field Error]
    HighlightError --> InputSoal
    
    ValidateSoal -->|Ya| NextSoal{Ada Soal Lagi?}
    NextSoal -->|Ya| LoopSoal
    NextSoal -->|Tidak| SubmitKuis[Submit Semua Data]
    
    SubmitKuis --> SaveToDB[Gabung Data Step 1 & 2 Simpan ke Database]
    SaveToDB --> ShowSuccess[Tampilkan Success Alert]
    ShowSuccess --> NavigateBack[Navigate kembali ke /guru/kuis]
    NavigateBack --> ViewKuis
    
    SelectKuis --> LoadNilai[Load Nilai Siswa untuk Kuis]
    LoadNilai --> ShowNilai[Tampilkan Tabel Nilai]
    ShowNilai --> ViewKuis
    
    DeleteKuis --> ConfirmDelete{Konfirmasi?}
    ConfirmDelete -->|Ya| RemoveKuis[Hapus Kuis dari DB]
    RemoveKuis --> ViewKuis
    ConfirmDelete -->|Tidak| ViewKuis
```

## 3.2 Siswa: Kerjakan Kuis

```mermaid
flowchart TD
    StartSiswa([Siswa Masuk Menu Kuis]) --> LoadKuisSiswa[Load Kuis untuk Kelas/Jurusan Siswa]
    LoadKuisSiswa --> ShowKuisList{Ada Kuis?}
    
    ShowKuisList -->|Tidak| ShowEmpty[Tampilkan: Belum ada kuis]
    ShowEmpty --> EndSiswa([Selesai])
    
    ShowKuisList -->|Ya| DisplayKuis[Tampilkan Daftar Kuis]
    DisplayKuis --> ChoiceSiswa{Pilihan}
    
    ChoiceSiswa -->|Mulai Kuis| CheckSudahKerjakan{Sudah Dikerjakan?}
    
    CheckSudahKerjakan -->|Ya| ShowNilaiSiswa[Tampilkan Nilai & Jawaban]
    ShowNilaiSiswa --> EndSiswa
    
    CheckSudahKerjakan -->|Tidak| ConfirmStart{Konfirmasi Mulai?}
    ConfirmStart -->|Tidak| DisplayKuis
    ConfirmStart -->|Ya| StartTimer[Mulai Timer Countdown]
    
    StartTimer --> ShowSoalPertama[Tampilkan Soal #1]
    ShowSoalPertama --> LoopJawab[Untuk Setiap Soal]
    
    LoopJawab --> ShowSoal[Tampilkan Soal & Opsi A-D]
    ShowSoal --> WaitJawaban[Siswa Pilih Jawaban]
    WaitJawaban --> CheckTime{Waktu Habis?}
    
    CheckTime -->|Ya| AutoSubmit[Auto Submit Kuis]
    AutoSubmit --> HitungNilai[Hitung Nilai]
    
    CheckTime -->|Tidak| RecordJawaban[Simpan Jawaban Sementara]
    RecordJawaban --> ChoiceNext{Pilihan Siswa}
    
    ChoiceNext -->|Next Soal| NextSoal{Ada Soal Lagi?}
    NextSoal -->|Ya| LoopJawab
    NextSoal -->|Tidak| ShowReview[Tampilkan Review Semua Jawaban]
    
    ChoiceNext -->|Submit Kuis| ConfirmSubmit{Yakin Submit?}
    ConfirmSubmit -->|Tidak| ShowSoal
    ConfirmSubmit -->|Ya| HitungNilai
    
    ShowReview --> ChoiceReview{Pilihan}
    ChoiceReview -->|Edit Jawaban| BackToSoal[Kembali ke Soal]
    BackToSoal --> LoopJawab
    ChoiceReview -->|Submit| ConfirmSubmit
    
    HitungNilai --> LoopKoreksi[Untuk Setiap Soal]
    LoopKoreksi --> CekJawaban{Jawaban Benar?}
    CekJawaban -->|Ya| AddPoin[Tambah Poin]
    CekJawaban -->|Tidak| SkipPoin[Skip Tidak ada poin]
    AddPoin --> NextCheck{Ada Soal Lagi?}
    SkipPoin --> NextCheck
    NextCheck -->|Ya| LoopKoreksi
    NextCheck -->|Tidak| CalcScore[Nilai = Benar/Total × 100]
    
    CalcScore --> SaveNilai[Simpan Nilai & Detail Jawaban ke DB]
    SaveNilai --> ShowHasil[Tampilkan Hasil: Nilai, Benar/Salah]
    ShowHasil --> EndSiswa
```

## Keterangan Kuis:

### Guru Side (2-Step Wizard):
1. **Step 1 - Info Kuis**: 
   - Judul, Kelas, Jurusan, Durasi (menit), Jumlah soal
   - Validasi sebelum lanjut ke step 2
   
2. **Step 2 - Isi Soal**:
   - Navigate ke halaman baru (/guru/kuis/buat-soal)
   - State passing via React Router navigate
   - Form dinamis sesuai jumlah soal
   - Validasi per soal (pertanyaan, 4 opsi, jawaban benar harus dipilih)
   - Auto scroll ke soal berikutnya setelah valid

### Siswa Side:
1. **Filter Otomatis**: Hanya tampil kuis sesuai kelas/jurusan siswa
2. **One-Time Attempt**: Sekali dikerjakan, tidak bisa ulang
3. **Timer Countdown**: Otomatis submit jika waktu habis
4. **Auto Grading**: Sistem langsung koreksi & hitung nilai
5. **Review Jawaban**: Siswa bisa lihat jawaban benar/salah setelah submit

### Perhitungan Nilai:
```
Nilai = (Jumlah Jawaban Benar / Total Soal) × 100
```

Contoh: 8 benar dari 10 soal = 80
