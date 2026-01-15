# Activity Diagram - Kelola Materi (Guru)

```plantuml
@startuml Kelola Materi

|Guru|
start
:Buka menu Materi;
:Klik Upload Materi;
:Isi informasi materi\n(judul, kelas, jurusan);
:Upload konten\n(PDF/Video/Link);

|Sistem|
:Simpan materi;

|Guru|
:Lihat daftar materi;

stop

@enduml
```

## Penjelasan:

### Tipe Materi:
1. **PDF**: Upload file (max 10MB), disimpan base64
2. **Video**: Link eksternal (YouTube, Drive)
3. **Link**: URL materi eksternal

### Target:
- Pilih kelas (X/XI/XII)
- Pilih jurusan
- Siswa hanya lihat materi sesuai kelas/jurusannya
