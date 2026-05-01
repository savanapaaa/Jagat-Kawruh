# Blackbox Test Checklist (Manual QA)

Dokumen ini melengkapi checklist ringkas di [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) bagian “Testing Checklist”. Fokus di sini: langkah uji manual (blackbox) yang bisa diikuti QA/User tanpa lihat kode.

## 0) Scope & Setup

**Target:** UI web Jagat Kawruh (React + Vite)

**Environment yang disarankan:**
- 1x Desktop (Chrome/Edge terbaru)
- 1x Mobile (device fisik) atau DevTools mobile emulation

**Akun uji minimal:**
- Admin (role: admin)
- Guru (role: guru)
- Siswa (role: siswa)

**Data uji minimal yang perlu tersedia di backend:**
- ≥1 Jurusan
- ≥1 Kelas untuk tiap tingkat (X, XI, XII) pada 1 Jurusan
- ≥2 Siswa pada 1 Kelas (supaya bisa cek “peserta unik”)
- ≥1 Guru

**Catatan penting untuk regresi dropdown mobile:**
- Banyak halaman sudah mengganti native `<select>` menjadi dropdown custom responsif.
- Tolak ukur: dropdown tidak “kepotong”, bisa di-scroll, bisa pilih opsi, dan menutup saat klik di luar.

---

## 1) Sanity UI & Navigasi Umum

### 1.1 Loading & Error State
**Steps**
1. Buka tiap halaman utama (Admin/Guru/Siswa) setelah login.
2. Saat data masih dimuat, amati apakah ada indikasi loading (spinner/skeleton/teks loading) atau UI tidak “freeze”.
3. Simulasikan error jaringan (opsional): matikan internet 5–10 detik lalu refresh.

**Expected**
- UI tidak blank tanpa informasi.
- Jika error, tampil pesan/indikasi error yang bisa dipahami.

### 1.2 Responsif Layout
**Steps**
1. Ubah lebar viewport: ~360px (mobile) → ~768px (tablet) → ~1280px (desktop).
2. Pastikan tidak ada komponen penting yang keluar layar atau tertutup (terutama form & tombol submit).

**Expected**
- Konten bisa di-scroll, tombol aksi tetap bisa dijangkau.

---

## 2) Auth (Semua Role)

### 2.1 Login
**Steps**
1. Buka halaman Login.
2. Login sebagai Admin → cek redirect.
3. Logout.
4. Login sebagai Guru → cek redirect.
5. Logout.
6. Login sebagai Siswa → cek redirect.

**Expected**
- Redirect menuju dashboard role masing-masing.
- Tidak ada data role lain yang kebuka.

### 2.2 Protected Routes
**Steps**
1. Setelah login sebagai Siswa, coba akses URL halaman Admin/Guru (paste URL langsung).
2. Setelah login sebagai Guru, coba akses URL halaman Admin.

**Expected**
- Ditolak/redirect sesuai mekanisme aplikasi (login/unauthorized).

### 2.3 Session persistence
**Steps**
1. Login.
2. Refresh browser.
3. Tutup tab, buka lagi aplikasinya.

**Expected**
- Session tetap valid sesuai kebijakan (jika memang ada persistence).

---

## 3) Komponen Dropdown Responsif (Regresi)

Jalankan ini di beberapa halaman yang punya dropdown (Admin: Siswa/Kelas, Guru: Kuis/Materi/PBL/Nilai, dsb.).

### 3.1 Buka/tutup dropdown
**Steps**
1. Tap/click dropdown.
2. Tap/click di luar dropdown.

**Expected**
- Menu muncul dengan z-index benar (tidak ketutup card lain).
- Menu menutup saat klik di luar.

### 3.2 Scroll dan opsi panjang
**Steps**
1. Pastikan list opsi cukup panjang (≥10 opsi) atau gunakan data yang ada.
2. Buka dropdown, scroll daftar opsi.

**Expected**
- List bisa di-scroll, tidak “nge-scroll halaman doang”.

### 3.3 Arah buka (atas/bawah)
**Steps**
1. Scroll halaman sehingga dropdown berada dekat bawah viewport.
2. Buka dropdown.

**Expected**
- Menu membuka ke atas bila ruang bawah sempit, sehingga opsi tetap terlihat.

### 3.4 Validasi pilihan
**Steps**
1. Pilih 1 opsi.
2. Pastikan label dropdown berubah sesuai pilihan.
3. Refresh halaman (opsional).

**Expected**
- Nilai dropdown berubah dan mempengaruhi filter/form sesuai konteks.

---

## 4) Admin: Jurusan

### 4.1 List jurusan
**Steps**
1. Login Admin.
2. Buka menu Jurusan.

**Expected**
- Tabel/list jurusan tampil.

### 4.2 Tambah jurusan
**Steps**
1. Klik tambah.
2. Isi nama + deskripsi (jika ada).
3. Submit.

**Expected**
- Jurusan baru muncul di list.

### 4.3 Edit & hapus jurusan
**Steps**
1. Edit salah satu jurusan → simpan.
2. Hapus jurusan (gunakan jurusan dummy).

**Expected**
- Data berubah sesuai aksi, list ter-refresh.

---

## 5) Admin: Kelas

### 5.1 List kelas
**Steps**
1. Login Admin.
2. Buka menu Kelas.

**Expected**
- List/tabel kelas tampil.

### 5.2 Tambah kelas (validasi tingkat & jurusan)
**Steps**
1. Klik tambah kelas.
2. Pilih Tingkat (X/XI/XII) via dropdown.
3. Pilih Jurusan via dropdown.
4. Isi nama kelas bila diperlukan.
5. Submit.

**Expected**
- Jika Tingkat/Jurusan kosong: submit ditolak dengan pesan yang jelas.
- Jika valid: kelas baru muncul.

### 5.3 Filter / perubahan dropdown tidak memotong UI
**Steps**
1. Ubah filter tingkat/jurusan berulang kali di mobile.

**Expected**
- Dropdown tidak clipped dan list kelas berubah sesuai filter.

---

## 6) Admin: Siswa

### 6.1 List siswa
**Steps**
1. Login Admin.
2. Buka menu Siswa.

**Expected**
- List siswa tampil.

### 6.2 Filter siswa (Jurusan/Kelas/Tingkat)
**Steps**
1. Pilih Jurusan (dropdown).
2. Pilih filter Kelas/Tingkat (jika ada).
3. Amati perubahan list.

**Expected**
- List berubah sesuai filter.
- Tidak terjadi kasus “API sukses tapi UI kosong” saat filter digunakan.

### 6.3 Tambah siswa
**Steps**
1. Klik tambah.
2. Isi data wajib (nama, NIS/NISN, kelas, dll).
3. Submit.

**Expected**
- Siswa muncul di list dan bisa ditemukan via filter.

### 6.4 Edit & hapus siswa
**Steps**
1. Edit data siswa → simpan.
2. Hapus siswa dummy.

**Expected**
- Data berubah sesuai aksi.

---

## 7) Admin: Guru (jika fitur ada)

### 7.1 CRUD guru
**Steps**
1. Login Admin.
2. Buka menu Guru.
3. Tambah → Edit → Hapus guru dummy.

**Expected**
- Data guru terkelola dengan benar.

---

## 8) Guru: Kuis

### 8.1 List kuis
**Steps**
1. Login Guru.
2. Buka menu Kuis.

**Expected**
- List kuis tampil.

### 8.2 Buat kuis
**Steps**
1. Klik buat kuis.
2. Isi judul/deskripsi.
3. Pilih Kelas via dropdown.
4. Pilih Status via dropdown.
5. Submit.

**Expected**
- Kuis baru muncul di list.

### 8.3 Buat soal kuis
**Steps**
1. Dari alur create (atau buka kuis) masuk ke halaman “Buat Soal”.
2. Tambahkan soal (opsional: dengan gambar bila didukung).
3. Pilih kunci jawaban (A–E) via dropdown.
4. Simpan.

**Expected**
- Soal tersimpan, bisa terlihat saat buka detail kuis.

### 8.4 Detail kuis & ubah status
**Steps**
1. Buka detail kuis.
2. Ubah status kuis via dropdown.

**Expected**
- Status berubah dan konsisten setelah refresh.

### 8.5 Peserta vs Attempt (regresi metrik)
**Setup**
- Pastikan ada 2 siswa pada kelas target.

**Steps**
1. Buat 1 kuis untuk kelas tersebut dan aktifkan.
2. Login sebagai Siswa A → kerjakan kuis → submit.
3. Login sebagai Siswa A lagi → kerjakan kuis yang sama 1x lagi → submit.
4. Login sebagai Siswa B → kerjakan kuis → submit.
5. Login sebagai Guru → buka list kuis.

**Expected**
- Kolom “Peserta” menghitung siswa unik: hasilnya = 2.
- Kolom “Attempt” menghitung total percobaan: hasilnya = 3.

---

## 9) Guru: Materi

### 9.1 List & buat materi
**Steps**
1. Login Guru.
2. Buka menu Materi.
3. Klik tambah.
4. Pilih Kelas via dropdown.
5. Pilih Status via dropdown.
6. Upload file (PDF) jika didukung.
7. Submit.

**Expected**
- Materi muncul di list.

### 9.2 Detail materi
**Steps**
1. Buka detail materi.
2. Ubah status via dropdown.
3. Toggle pengaturan tugas (aktif/nonaktif) jika ada.

**Expected**
- Perubahan tersimpan dan terlihat setelah refresh.

---

## 10) Guru: PBL

### 10.1 Buat project PBL
**Steps**
1. Login Guru.
2. Buka menu PBL.
3. Klik buat project.
4. Pilih Jurusan via dropdown.
5. Pilih Status project via dropdown.
6. Isi fase-fase PBL sesuai form.
7. Submit.

**Expected**
- Project muncul di list.

### 10.2 Buat kelompok & pilih ketua
**Setup**
- Pastikan ada siswa tersedia untuk kelas/jurusan terkait.

**Steps**
1. Buka project PBL.
2. Buat kelompok baru.
3. Tambahkan anggota.
4. Cek dropdown ketua kelompok.

**Expected**
- Dropdown ketua disabled sampai ada anggota.
- Setelah anggota dipilih, dropdown ketua aktif dan bisa memilih salah satu anggota.

### 10.3 Nilai submission (guru)
**Steps**
1. Pastikan ada submission dari siswa (lihat bagian Siswa → PBL Submission).
2. Guru membuka halaman project → lihat submission.
3. Isi nilai/feedback → submit.

**Expected**
- Nilai tersimpan dan terlihat oleh siswa di halaman Nilai.

---

## 11) Guru: Nilai

### 11.1 Filter nilai
**Steps**
1. Login Guru.
2. Buka menu Nilai.
3. Ubah tipe nilai (Kuis/PBL) via dropdown.
4. Ubah kelas via dropdown.

**Expected**
- List nilai berubah sesuai filter.

---

## 12) Guru: Helpdesk

### 12.1 Update status ticket
**Steps**
1. Pastikan ada ticket dari siswa.
2. Login Guru → buka Helpdesk.
3. Ubah status ticket.

**Expected**
- Status berubah dan terlihat konsisten.

---

## 13) Siswa: Kuis (Gameplay)

### 13.1 Mulai kuis
**Steps**
1. Login Siswa.
2. Buka menu Kuis.
3. Pilih kuis aktif → mulai.

**Expected**
- Halaman kuis terbuka tanpa error.

### 13.2 Fullscreen / bottom tidak kepotong (regresi)
**Steps (mobile)**
1. Saat gameplay, scroll sampai area bawah (HUD/tombol bawah).
2. Putar device portrait/landscape (opsional).

**Expected**
- Bagian bawah UI tidak “kepotong” permanen.
- Jika perlu scroll sedikit, tetap bisa mencapai semua tombol.

### 13.3 Submit jawaban
**Steps**
1. Selesaikan kuis.
2. Submit.

**Expected**
- Muncul konfirmasi/hasil.
- Nilai masuk ke halaman Nilai.

---

## 14) Siswa: Materi

### 14.1 List & detail
**Steps**
1. Login Siswa.
2. Buka menu Materi.
3. Buka detail salah satu materi.

**Expected**
- Konten/attachment bisa diakses sesuai hak akses.

---

## 15) Siswa: PBL

### 15.1 Lihat project
**Steps**
1. Login Siswa.
2. Buka menu PBL.

**Expected**
- List project sesuai jurusan/kelas siswa.

### 15.2 Submit project
**Steps**
1. Buka project yang menerima submission.
2. Upload file dan isi catatan bila ada.
3. Submit.

**Expected**
- Submission tercatat dan status berubah sesuai alur.

---

## 16) Siswa: Nilai

### 16.1 Lihat nilai
**Steps**
1. Login Siswa.
2. Buka menu Nilai.

**Expected**
- Nilai kuis dan/atau PBL tampil sesuai yang sudah dikerjakan.

---

## 17) Siswa: Notifikasi

### 17.1 Mark as read / delete
**Steps**
1. Login Siswa.
2. Buka menu Notifikasi.
3. Tandai salah satu notifikasi sebagai read.
4. Hapus notifikasi (dummy jika ada).

**Expected**
- Status read berubah.
- Notifikasi terhapus dari list.

---

## 18) Siswa: Helpdesk

### 18.1 Buat ticket
**Steps**
1. Login Siswa.
2. Buka Helpdesk.
3. Buat ticket baru.

**Expected**
- Ticket muncul di list siswa.
- Guru bisa melihat ticket tersebut (lihat bagian Guru → Helpdesk).
