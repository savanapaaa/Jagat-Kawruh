# Activity Diagram - Lihat Nilai (Guru)

## 14.1 Lihat Nilai Kuis

```plantuml
@startuml Guru Lihat Nilai Kuis

|Guru|
start
:Buka menu Nilai;
:Pilih kuis;

|Sistem|
:Load data nilai semua siswa;
:Tampilkan tabel nilai;

|Guru|
:Analisis performa siswa;

stop

@enduml
```

## Penjelasan:
- Guru lihat nilai kuis semua siswa
- Tampilan: Nama siswa, kelas, nilai, tanggal
- Auto grading: Sistem sudah koreksi otomatis

---

## 14.2 Lihat Nilai PBL

```plantuml
@startuml Guru Lihat Nilai PBL

|Guru|
start
:Buka menu PBL;
:Pilih project;

|Sistem|
:Tampilkan daftar kelompok;
:Tampilkan nilai per kelompok;

|Guru|
:Lihat rekap nilai PBL;

stop

@enduml
```

## Penjelasan:
- Guru lihat nilai PBL semua kelompok
- Tampilan: Nama kelompok, anggota, progress, nilai
- Nilai berdasarkan penilaian yang sudah diberikan
