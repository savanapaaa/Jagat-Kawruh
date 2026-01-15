# Activity Diagram - Lihat Nilai (Siswa)

## 13.1 Lihat Nilai Kuis

```plantuml
@startuml Siswa Lihat Nilai Kuis

|Siswa|
start
:Buka menu Nilai;
:Pilih tab Kuis;

|Sistem|
:Load daftar kuis\nyang sudah dikerjakan;
:Tampilkan tabel nilai;

|Siswa|
:Lihat nilai kuis;

stop

@enduml
```

## Penjelasan:
- Siswa hanya bisa lihat nilai kuis yang sudah dikerjakan
- Tampilan: Nama kuis, nilai, jumlah benar/salah, tanggal

---

## 13.2 Lihat Nilai PBL

```plantuml
@startuml Siswa Lihat Nilai PBL

|Siswa|
start
:Buka menu PBL;
:Pilih project;

|Sistem|
:Tampilkan progress kelompok;
:Tampilkan nilai per fase;

|Siswa|
:Lihat nilai & feedback guru;

stop

@enduml
```

## Penjelasan:
- Siswa lihat nilai PBL kelompoknya
- Tampilan: Progress (0-100%), nilai per fase, feedback guru
- Nilai tampil setelah guru beri penilaian
