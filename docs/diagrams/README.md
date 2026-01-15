# Activity Diagrams - Jagat Kawruh

Dokumentasi activity diagram untuk sistem pembelajaran Jagat Kawruh.

## 📋 Daftar Diagram

### Umum
1. **[Login & Authentication](1-login-authentication.md)**
   - Proses login untuk 3 role: Admin, Guru, Siswa
   - Validasi email & password
   - Role-based redirect

### Admin Features
2. **[Dashboard Admin](7-dashboard-admin.md)**
   - Statistik & overview data
   - Quick actions & navigation
   - Charts & visualization

3. **[Kelola Siswa](5-kelola-siswa.md)**
   - CRUD siswa lengkap
   - Validasi & relasi data
   - Filter & search

4. **[Kelola Jurusan](6-kelola-jurusan.md)**
   - CRUD jurusan
   - Cek relasi dengan siswa/PBL/kuis
   - Duplicate check case-insensitive

### Guru Features
5. **[Kelola Materi](8-kelola-materi.md)**
   - Upload materi (PDF/Video/Link)
   - Target kelas & jurusan
   - Validasi file & URL

6. **[Buat Kuis](9-buat-kuis.md)**
   - Form informasi kuis
   - Isi soal-soal (pertanyaan, opsi, jawaban)
   - Auto grading system

7. **[Lihat Nilai - Guru](14-guru-lihat-nilai.md)**
   - Lihat nilai kuis semua siswa
   - Lihat nilai PBL per kelompok
   - Analisis performa

8. **[PBL - Buat Project](11-pbl-buat-project.md)**
   - Buat project dengan 5 fase PBL
   - Buat kelompok & assign siswa
   - Kelola anggota kelompok

9. **[PBL - Review & Penilaian](2-pbl-workflow.md)**
   - Review submisi kelompok
   - Approve/Reject dengan feedback
   - Sequential approval system

### Siswa Features
10. **[Melihat Materi](4-materi-workflow.md)**
    - Filter otomatis by kelas/jurusan
    - Akses PDF/Video/Link
    - Download materi offline

11. **[Mengerjakan Kuis](10-kerjakan-kuis.md)**
    - Timer countdown
    - Auto submit & grading
    - One-time attempt

12. **[Lihat Nilai - Siswa](13-siswa-lihat-nilai.md)**
    - Lihat nilai kuis sendiri
    - Lihat nilai PBL kelompok
    - Progress tracking

13. **[PBL - Kerjakan Project](12-pbl-kerjakan.md)**
    - Pilih fase & isi form
    - Sequential phases
    - Group submission

## 📖 Cara Membaca Diagram

### Format: PlantUML & Mermaid
Diagram menggunakan 2 format:
- **PlantUML** - Standar UML yang lebih formal (untuk dokumentasi TA)
- **Mermaid** - Visual modern dengan swimlane (lebih mudah dibaca)

### PlantUML - Render di VS Code
1. Install extension: **"PlantUML"**
2. Install Java JRE (required untuk PlantUML)
3. Buka file .md, tekan **Alt+D** untuk preview
4. Atau online: [PlantUML Web Server](http://www.plantuml.com/plantuml/)

### Mermaid - Render di VS Code
1. Install extension: **"Markdown Preview Mermaid Support"**
2. Buka file .md, tekan **Ctrl+Shift+V**
3. Atau online: [Mermaid Live Editor](https://mermaid.live/)

### Simbol Activity Diagram (UML)

**PlantUML:**
```
start/stop        → Bulat hitam (start/end)
:Activity;        → Rectangle rounded (aktivitas)
if-then-else      → Diamond (decision)
|Swimlane|        → Kolom aktor/sistem
```

**Mermaid:**
```
([Start])         → Circle (start/end)
[Activity]        → Rectangle (aktivitas)
{Decision?}       → Diamond (keputusan)
subgraph          → Swimlane kolom
```

## 🎯 Penggunaan

### Untuk Dokumentasi TA/Skripsi:
1. Buka file diagram di VS Code
2. Preview dengan Mermaid extension
3. Screenshot untuk dimasukkan ke dokumen
4. Atau copy kode Mermaid ke tools diagram favorit Anda

### Untuk Export PNG/SVG:
1. Buka [Mermaid Live Editor](https://mermaid.live/)
2. Copy-paste kode Mermaid dari file .md
3. Klik "Download PNG" atau "Download SVG"
4. Atau gunakan VS Code extension dengan fitur export

### Untuk Presentasi:
- File .md bisa dibuka langsung di GitHub (auto-render)
- Atau convert ke PowerPoint dengan copy-paste diagram image

## 🔄 Update Diagram

Jika ada perubahan logic/flow di aplikasi, update diagram dengan:
1. Edit file .md yang sesuai
2. Ubah kode Mermaid syntax
3. Preview untuk cek hasil
4. Commit & push ke repository

## 📚 Referensi

- [Mermaid Documentation](https://mermaid.js.org/)
- [Flowchart Syntax](https://mermaid.js.org/syntax/flowchart.html)
- [Activity Diagram Best Practices](https://www.visual-paradigm.com/guide/uml-unified-modeling-language/what-is-activity-diagram/)

---

**Catatan**: Diagram ini dibuat berdasarkan implementasi actual di codebase. Pastikan sinkron jika ada perubahan fitur!
