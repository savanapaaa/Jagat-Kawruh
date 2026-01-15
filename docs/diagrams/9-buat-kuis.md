# Activity Diagram - Buat Kuis (Guru)

```plantuml
@startuml Buat Kuis

|Guru|
start
:Buka menu Kuis;
:Klik Buat Kuis;
:Isi informasi kuis\n(judul, kelas, jurusan, durasi);
:Isi soal-soal kuis\n(pertanyaan, opsi, jawaban);

|Sistem|
:Simpan kuis;

|Guru|
:Lihat kuis;

stop

@enduml
```

## Penjelasan:

### 2-Step Wizard:
1. **Step 1**: Info kuis (judul, target, durasi, jumlah soal)
2. **Step 2**: Isi soal (form dinamis sesuai jumlah)

### Validasi:
- Semua field wajib diisi
- Setiap soal: pertanyaan + 4 opsi + jawaban benar
- Auto-scroll ke soal berikutnya setelah valid
