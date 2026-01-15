# Perubahan Backend Laravel yang Diperlukan

Frontend sekarang sudah **full API**. Untuk menghilangkan error 403, backend Laravel perlu diupdate:

## 1. Routes API - Izinkan Siswa Akses Read-Only

File: `routes/api.php`

```php
Route::middleware(['auth:sanctum'])->group(function () {
    
    // ===== MATERI =====
    // Siswa boleh READ materi yang dipublikasikan
    Route::get('/materi', [MateriController::class, 'index']);
    Route::get('/materi/{id}', [MateriController::class, 'show']);
    Route::get('/materi/{id}/download', [MateriController::class, 'download']);
    
    // Create/Update/Delete hanya untuk GURU
    Route::middleware(['role:guru'])->group(function () {
        Route::post('/materi', [MateriController::class, 'store']);
        Route::put('/materi/{id}', [MateriController::class, 'update']);
        Route::delete('/materi/{id}', [MateriController::class, 'destroy']);
    });
    
    // ===== KUIS =====
    // Siswa boleh READ kuis yang aktif
    Route::get('/kuis', [KuisController::class, 'index']);
    Route::get('/kuis/{id}', [KuisController::class, 'show']);
    
    // Create/Update/Delete hanya untuk GURU
    Route::middleware(['role:guru'])->group(function () {
        Route::post('/kuis', [KuisController::class, 'store']);
        Route::put('/kuis/{id}', [KuisController::class, 'update']);
        Route::delete('/kuis/{id}', [KuisController::class, 'destroy']);
    });
    
    // Siswa boleh SUBMIT jawaban kuis
    Route::post('/kuis/{id}/submit', [KuisController::class, 'submit']);
    
    // ===== NILAI =====
    // Siswa boleh READ nilai mereka sendiri
    // Guru boleh READ semua nilai
    Route::get('/nilai', [NilaiController::class, 'index']);
    
    // ===== SISWA (Data Master) =====
    // Hanya GURU dan ADMIN
    Route::middleware(['role:guru,admin'])->group(function () {
        Route::get('/siswa', [SiswaController::class, 'index']);
        Route::post('/siswa', [SiswaController::class, 'store']);
        Route::put('/siswa/{id}', [SiswaController::class, 'update']);
        Route::delete('/siswa/{id}', [SiswaController::class, 'destroy']);
    });
    
    // ===== JURUSAN =====
    // Hanya ADMIN
    Route::middleware(['role:admin'])->group(function () {
        Route::get('/jurusan', [JurusanController::class, 'index']);
        Route::post('/jurusan', [JurusanController::class, 'store']);
        Route::put('/jurusan/{id}', [JurusanController::class, 'update']);
        Route::delete('/jurusan/{id}', [JurusanController::class, 'destroy']);
    });
    
    // ===== PROFILE =====
    // Semua role boleh akses profil mereka sendiri
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    
    // ===== HELPDESK =====
    // Semua role boleh kirim dan lihat tiket mereka
    Route::get('/helpdesk', [HelpdeskController::class, 'index']);
    Route::post('/helpdesk', [HelpdeskController::class, 'store']);
    Route::put('/helpdesk/{id}', [HelpdeskController::class, 'update']);
});
```

## 2. Controller - Filter Data Berdasarkan Role

### MateriController.php

```php
public function index(Request $request)
{
    $user = auth()->user();
    $query = Materi::query();
    
    // Siswa hanya bisa lihat yang dipublikasikan
    if ($user->role === 'siswa') {
        $query->where('status', 'Dipublikasikan');
        
        // Filter by kelas siswa jika ada
        if ($user->kelas) {
            $query->where('kelas', $user->kelas);
        }
    }
    
    // Guru bisa lihat semua (termasuk draft mereka sendiri)
    // Admin bisa lihat semua
    
    // Support filter dari request
    if ($request->has('status')) {
        $query->where('status', $request->status);
    }
    
    $materi = $query->orderBy('created_at', 'desc')->get();
    
    return response()->json([
        'success' => true,
        'data' => $materi
    ]);
}

public function store(Request $request)
{
    // Validasi input
    $validated = $request->validate([
        'judul' => 'required|string|max:255',
        'kelas' => 'required|array',
        'kelas.*' => 'string|in:VII,VIII,IX,X,XI,XII',
        'status' => 'required|in:Draft,Dipublikasikan',
        'file' => 'required|file|mimes:pdf|max:10240', // max 10MB
    ]);
    
    try {
        // Upload file
        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('materi', $fileName, 'public');
        
        // Simpan ke database
        $materi = Materi::create([
            'judul' => $validated['judul'],
            'kelas' => json_encode($validated['kelas']), // Simpan sebagai JSON
            'status' => $validated['status'],
            'file_path' => $filePath,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
            'user_id' => auth()->id(),
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil ditambahkan',
            'data' => $materi
        ], 201);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Gagal menambahkan materi: ' . $e->getMessage()
        ], 500);
    }
}

public function update(Request $request, $id)
{
    $materi = Materi::findOrFail($id);
    
    // Validasi input
    $validated = $request->validate([
        'judul' => 'sometimes|string|max:255',
        'kelas' => 'sometimes|array',
        'kelas.*' => 'string|in:VII,VIII,IX,X,XI,XII',
        'status' => 'sometimes|in:Draft,Dipublikasikan',
        'file' => 'sometimes|file|mimes:pdf|max:10240',
    ]);
    
    try {
        // Update file jika ada
        if ($request->hasFile('file')) {
            // Hapus file lama
            if ($materi->file_path && Storage::disk('public')->exists($materi->file_path)) {
                Storage::disk('public')->delete($materi->file_path);
            }
            
            $file = $request->file('file');
            $fileName = time() . '_' . $file->getClientOriginalName();
            $filePath = $file->storeAs('materi', $fileName, 'public');
            
            $validated['file_path'] = $filePath;
            $validated['file_name'] = $fileName;
            $validated['file_size'] = $file->getSize();
        }
        
        // Update kelas ke JSON jika ada
        if (isset($validated['kelas'])) {
            $validated['kelas'] = json_encode($validated['kelas']);
        }
        
        $materi->update($validated);
        
        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil diupdate',
            'data' => $materi
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Gagal mengupdate materi: ' . $e->getMessage()
        ], 500);
    }
}

public function destroy($id)
{
    try {
        $materi = Materi::findOrFail($id);
        
        // Hapus file
        if ($materi->file_path && Storage::disk('public')->exists($materi->file_path)) {
            Storage::disk('public')->delete($materi->file_path);
        }
        
        $materi->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil dihapus'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Gagal menghapus materi: ' . $e->getMessage()
        ], 500);
    }
}

public function download($id)
{
    $materi = Materi::findOrFail($id);
    
    $filePath = storage_path('app/public/' . $materi->file_path);
    
    if (!file_exists($filePath)) {
        return response()->json([
            'success' => false,
            'message' => 'File tidak ditemukan'
        ], 404);
    }
    
    return response()->download($filePath, $materi->file_name);
}
```

### KuisController.php

```php
public function index(Request $request)
{
    $user = auth()->user();
    $query = Kuis::query();
    
    // Siswa hanya bisa lihat yang aktif
    if ($user->role === 'siswa') {
        $query->where('status', 'Aktif');
        
        // Filter by kelas siswa
        if ($user->kelas) {
            $query->where('kelas', $user->kelas);
        }
    }
    
    // Support filter dari request
    if ($request->has('status')) {
        $query->where('status', $request->status);
    }
    
    $kuis = $query->orderBy('created_at', 'desc')->get();
    
    return response()->json([
        'success' => true,
        'data' => $kuis
    ]);
}

public function store(Request $request)
{
    $validated = $request->validate([
        'judul' => 'required|string|max:255',
        'kelas' => 'required|array',
        'kelas.*' => 'string|in:VII,VIII,IX,X,XI,XII',
        'batas_waktu' => 'required|integer|min:1',
        'status' => 'required|in:Aktif,Draft,Selesai',
        'soal' => 'required|array',
        'soal.*.text' => 'required|string',
        'soal.*.options' => 'required|array',
        'soal.*.answer' => 'required|string',
    ]);
    
    try {
        $kuis = Kuis::create([
            'judul' => $validated['judul'],
            'kelas' => json_encode($validated['kelas']),
            'batas_waktu' => $validated['batas_waktu'],
            'status' => $validated['status'],
            'soal' => json_encode($validated['soal']),
            'user_id' => auth()->id(),
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Kuis berhasil dibuat',
            'data' => $kuis
        ], 201);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Gagal membuat kuis: ' . $e->getMessage()
        ], 500);
    }
}
```

### NilaiController.php

```php
public function index()
{
    $user = auth()->user();
    
    if ($user->role === 'siswa') {
        // Siswa hanya bisa lihat nilai mereka sendiri
        $nilai = Nilai::where('user_id', $user->id)
            ->with('kuis:id,judul')
            ->orderBy('created_at', 'desc')
            ->get();
    } else {
        // Guru dan Admin bisa lihat semua
        $nilai = Nilai::with(['kuis:id,judul', 'user:id,nama,email'])
            ->orderBy('created_at', 'desc')
            ->get();
    }
    
    return response()->json([
        'success' => true,
        'data' => $nilai
    ]);
}
```

## 3. Middleware Role (Opsional)

Jika belum ada, buat middleware untuk role checking:

File: `app/Http/Middleware/CheckRole.php`

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }
        
        // Check if user's role is in allowed roles
        if (!in_array($user->role, $roles)) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden - Anda tidak memiliki akses'
            ], 403);
        }
        
        return $next($request);
    }
}
```

Daftarkan di `app/Http/Kernel.php`:

```php
protected $middlewareAliases = [
    // ... middleware lain
    'role' => \App\Http\Middleware\CheckRole::class,
];
```

## 4. Testing

Setelah perubahan di atas, test dengan:

1. **Login sebagai siswa**
2. **Akses endpoint:**
   - `GET /api/materi` → Harus return materi yang dipublikasikan (200 OK)
   - `GET /api/kuis` → Harus return kuis yang aktif (200 OK)
   - `GET /api/nilai` → Harus return nilai siswa tersebut (200 OK)
   - `POST /api/materi` → Harus return 403 Forbidden

3. **Login sebagai guru**
4. **Akses endpoint:**
   - `GET /api/materi` → Return semua materi (200 OK)
   - `POST /api/materi` → Bisa create (201 Created)
   - `GET /api/siswa` → Return semua siswa (200 OK)

## Rangkuman Akses

| Endpoint | Siswa | Guru | Admin |
|----------|-------|------|-------|
| GET /materi (dipublikasikan) | ✅ | ✅ | ✅ |
| POST /materi | ❌ | ✅ | ✅ |
| GET /kuis (aktif) | ✅ | ✅ | ✅ |
| POST /kuis | ❌ | ✅ | ✅ |
| GET /nilai (self) | ✅ | - | - |
| GET /nilai (all) | ❌ | ✅ | ✅ |
| GET /siswa | ❌ | ✅ | ✅ |
| GET /jurusan | ❌ | ❌ | ✅ |

---

**Setelah perubahan ini, frontend akan berfungsi penuh dengan backend tanpa error 403!**
