# Activity Diagram - Manajemen Profil

## Deskripsi
Fitur untuk semua role (Admin, Guru, Siswa) mengelola profil dan keamanan akun mereka.

```plantuml
@startuml Manajemen Profil

|User|
start
:Buka menu Profil;

|Sistem|
:Load data profil dari API;
:Tampilkan informasi profil\n(Nama, Email, Role);

|User|
if (Aksi?) then (Edit Profil)
  :Klik tombol Edit Profil;
  |Sistem|
  :Tampilkan form edit;
  |User|
  :Ubah nama;
  :Klik Simpan;
  |Sistem|
  :Validasi data;
  :Update profil via API;
  :Tampilkan notifikasi sukses;
elseif (Ganti Password) then
  :Klik Ganti Password;
  |Sistem|
  :Tampilkan form ganti password;
  |User|
  :Input password lama;
  :Input password baru;
  :Input konfirmasi password;
  :Klik Simpan;
  |Sistem|
  if (Password baru = Konfirmasi?) then (Ya)
    if (Password min 6 karakter?) then (Ya)
      :Update password via API;
      :Tampilkan notifikasi sukses;
    else (Tidak)
      :Error: Password minimal 6 karakter;
    endif
  else (Tidak)
    :Error: Konfirmasi password tidak cocok;
  endif
else (Lihat Saja)
  :Tampilkan data profil;
endif

|User|
:Selesai;

stop

@enduml
```

## Flowchart Detail (Mermaid)

```mermaid
flowchart TD
    Start([User Buka Menu Profil]) --> LoadProfile[Load Data Profil dari API]
    LoadProfile --> ShowProfile[Tampilkan Informasi Profil]
    ShowProfile --> Choice{Pilihan Aksi}
    
    %% Edit Profil
    Choice -->|Edit Profil| ClickEdit[Klik Tombol Edit]
    ClickEdit --> ShowEditForm[Tampilkan Form Edit]
    ShowEditForm --> InputNama[Input: Nama Lengkap]
    InputNama --> ClickSave[Klik Simpan]
    ClickSave --> ValidateNama{Nama Valid?}
    ValidateNama -->|Kosong| ErrorNama[Error: Nama wajib diisi]
    ErrorNama --> InputNama
    ValidateNama -->|Valid| CallAPIUpdate[PUT /api/profile]
    CallAPIUpdate --> SuccessUpdate[Alert: Profil berhasil diubah]
    SuccessUpdate --> ReloadPage[Reload halaman]
    ReloadPage --> LoadProfile
    
    %% Ganti Password
    Choice -->|Ganti Password| ClickPassword[Klik Ganti Password]
    ClickPassword --> ShowPasswordForm[Tampilkan Form Password]
    ShowPasswordForm --> InputOldPass[Input: Password Lama]
    InputOldPass --> InputNewPass[Input: Password Baru]
    InputNewPass --> InputConfirm[Input: Konfirmasi Password]
    InputConfirm --> ClickSavePass[Klik Simpan Password]
    ClickSavePass --> ValidateMatch{Password Baru = Konfirmasi?}
    
    ValidateMatch -->|Tidak| ErrorMatch[Error: Konfirmasi tidak cocok]
    ErrorMatch --> InputConfirm
    
    ValidateMatch -->|Ya| ValidateLength{Min 6 Karakter?}
    ValidateLength -->|Tidak| ErrorLength[Error: Password min 6 karakter]
    ErrorLength --> InputNewPass
    
    ValidateLength -->|Ya| CallAPIPassword[PUT /api/profile/password]
    CallAPIPassword --> CheckOldPass{Password Lama Benar?}
    CheckOldPass -->|Tidak| ErrorOldPass[Error: Password lama salah]
    ErrorOldPass --> InputOldPass
    CheckOldPass -->|Ya| SuccessPassword[Alert: Password berhasil diubah]
    SuccessPassword --> ClearForm[Kosongkan form password]
    ClearForm --> ShowProfile
    
    %% Lihat Saja
    Choice -->|Selesai| End([Selesai])
```

## Penjelasan

### Aktor
- **User**: Admin, Guru, atau Siswa (semua role memiliki akses)

### Fitur Utama
1. **Lihat Profil**: Menampilkan nama, email, dan role user
2. **Edit Profil**: Mengubah nama lengkap
3. **Ganti Password**: Mengubah password dengan validasi

### Validasi
| Field | Validasi |
|-------|----------|
| Nama | Wajib diisi |
| Password Lama | Harus cocok dengan password saat ini |
| Password Baru | Minimal 6 karakter |
| Konfirmasi | Harus sama dengan password baru |

### API Endpoints
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/profile` | Ambil data profil |
| PUT | `/api/profile` | Update nama profil |
| PUT | `/api/profile/password` | Ganti password |

### Catatan Keamanan
- Password lama harus diverifikasi sebelum mengubah password
- Email tidak bisa diubah oleh user (hanya admin)
- Session tetap aktif setelah ganti password
