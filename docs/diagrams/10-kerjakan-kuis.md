# Activity Diagram - Kerjakan Kuis (Siswa)

```plantuml
@startuml Kerjakan Kuis

|Siswa|
start
:Buka menu Kuis;
:Pilih kuis;

|Sistem|
:Mulai timer;
:Tampilkan soal;

|Siswa|
:Kerjakan soal;
:Submit jawaban;

|Sistem|
:Koreksi otomatis;
:Hitung nilai;
:Simpan hasil;
:Tampilkan nilai;

stop

@enduml
```

## Penjelasan:

### Fitur:
- **Filter Otomatis**: Kuis sesuai kelas/jurusan siswa
- **One-Time**: Sekali kerjakan, tidak bisa ulang
- **Timer**: Auto-submit jika waktu habis
- **Auto Grading**: Sistem koreksi otomatis

### Perhitungan Nilai:
```
Nilai = (Jumlah Benar / Total Soal) × 100
```
