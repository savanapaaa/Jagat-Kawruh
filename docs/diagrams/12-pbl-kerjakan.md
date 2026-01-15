# Activity Diagram - PBL - Kerjakan Project (Siswa)

```plantuml
@startuml PBL Kerjakan

|Siswa|
start
:Buka menu PBL;
:Pilih project;

|Sistem|
:Tampilkan 5 fase PBL;
:Tampilkan progress kelompok;

|Siswa|
:Pilih fase;
:Isi form fase;

|Sistem|
if (Valid?) then (ya)
  :Simpan submisi;
  :Update progress;
else (tidak)
  :Tampilkan error;
  |Siswa|
  detach
endif

|Siswa|
:Lihat progress;

stop

@enduml
```

## Penjelasan:

### Sequential Phases:
- Fase berikutnya **locked** sampai fase sebelumnya **approved**
- Semua anggota kelompok lihat submisi yang sama

### Progress:
- Setiap fase = 20%
- Total 100% = 4 fase dikumpulkan + dinilai

### Status Submisi:
- **Pending**: Menunggu review guru
- **Approved**: Disetujui, unlock fase berikutnya
- **Rejected**: Ditolak, bisa edit ulang
