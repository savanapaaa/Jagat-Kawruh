# Activity Diagram - Login Sistem

```plantuml
@startuml Login Sistem

|User|
start
:Buka halaman login;
:Masukkan email dan password;
:Klik tombol Login;

|Sistem|
:Terima data login;

if (Data lengkap?) then (tidak)
  :Tampilkan pesan error\n"Data harus diisi";
  |User|
  detach
endif

:Validasi kredensial;

if (Kredensial valid?) then (tidak)
  :Tampilkan pesan error\n"Email atau password salah";
  |User|
  detach
endif

:Identifikasi role pengguna;
:Buat session login;
:Redirect ke dashboard\nsesuai role;

|User|
:Akses dashboard;

stop

@enduml
```

## Versi Mermaid

```mermaid
flowchart TD
    Start([Start]) --> A1
    
    subgraph User [" User "]
        A1[Buka halaman login]
        A2[Masukkan email dan password]
        A3[Klik tombol Login]
        A8[Akses dashboard]
    end
    
    subgraph Sistem [" Sistem "]
        B1[Terima data login]
        B2{Data lengkap?}
        B3[Tampilkan pesan error]
        B4[Validasi kredensial]
        B5{Kredensial valid?}
        B6[Identifikasi role pengguna]
        B7[Buat session login]
        B8[Redirect ke dashboard sesuai role]
    end
    
    A1 --> A2 --> A3 --> B1 --> B2
    B2 -->|Tidak| B3 --> X1[ ]
    B2 -->|Ya| B4 --> B5
    B5 -->|Tidak| B3
    B5 -->|Ya| B6 --> B7 --> B8 --> A8
    A8 --> End([End])
    
    style X1 fill:none,stroke:none
```

## Penjelasan:

### Swimlane:
- **User**: Aktivitas yang dilakukan pengguna
- **Sistem**: Proses yang dilakukan sistem

### Alur Proses:
1. User membuka halaman login dan memasukkan kredensial
2. Sistem memvalidasi kelengkapan data
3. Jika tidak lengkap → tampilkan error (flow berakhir)
4. Sistem memvalidasi kredensial
5. Jika tidak valid → tampilkan error (flow berakhir)
6. Sistem identifikasi role (Admin/Guru/Siswa)
7. Sistem membuat session dan redirect ke dashboard
8. User mengakses dashboard sesuai role

### Karakteristik:
- **1 Start, 1 End** (standar UML)
- **Decision node** untuk validasi
- **Swimlane** memisahkan aktor dan sistem
- **Sederhana** tanpa detail teknis implementasi
- **Fokus** pada alur bisnis utama
