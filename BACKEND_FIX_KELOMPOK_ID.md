# Fix Backend: Kelompok ID Matching Issue

## Masalah
Siswa yang sudah terdaftar di kelompok tidak bisa akses PBL karena format ID tidak cocok:
- Data kelompok menyimpan: `["siswa-11"]` (string)
- Backend query pakai: `$user->id` = `11` (integer)
- `whereJsonContains('anggota', 11)` tidak match dengan `["siswa-11"]`

## Solusi Backend

### File: `app/Http/Controllers/PblProgressController.php`

Ganti query kelompok dari:
```php
$kelompok = PblKelompok::where('pbl_id', $pblId)
    ->whereJsonContains('anggota', $user->id)
    ->first();
```

Menjadi:
```php
// Coba match dengan berbagai format ID
$userId = $user->id;
$kelompok = PblKelompok::where('pbl_id', $pblId)
    ->where(function($query) use ($userId) {
        // Try integer ID
        $query->whereJsonContains('anggota', $userId)
            // Try string ID with prefix
            ->orWhereJsonContains('anggota', "siswa-{$userId}")
            // Try string numeric
            ->orWhereJsonContains('anggota', (string)$userId);
    })
    ->first();
```

### File: `app/Http/Controllers/PblKelompokController.php` (jika ada method untuk get progress)

Terapkan fix yang sama untuk semua query yang cek membership kelompok.

### File: `app/Http/Controllers/PblSubmissionController.php`

Jika ada method `submitProject` yang juga cek kelompok, terapkan fix yang sama:

```php
public function submit(Request $request, $pblId)
{
    $user = auth()->user();
    $userId = $user->id;
    
    $kelompok = PblKelompok::where('pbl_id', $pblId)
        ->where(function($query) use ($userId) {
            $query->whereJsonContains('anggota', $userId)
                ->orWhereJsonContains('anggota', "siswa-{$userId}")
                ->orWhereJsonContains('anggota', (string)$userId);
        })
        ->first();
        
    if (!$kelompok) {
        return response()->json([
            'success' => false,
            'message' => 'Anda belum terdaftar di kelompok manapun untuk project ini'
        ], 403);
    }
    
    // ... rest of the code
}
```

## Testing

Setelah fix backend, test dengan:

1. Login sebagai siswa yang sudah terdaftar di kelompok
2. Buka halaman PBL
3. Pilih project yang kelompoknya ada
4. Error 403 seharusnya hilang
5. Progress bar dan form tahapan seharusnya muncul

## Alternative: Fix Data (Not Recommended)

Jika tidak bisa update backend, bisa update data kelompok di database:

```sql
-- Ubah format anggota dari ["siswa-11"] menjadi [11]
UPDATE pbl_kelompok 
SET anggota = JSON_ARRAY(11)  -- sesuaikan dengan ID siswa yang benar
WHERE id = 'kelompok-1';

-- Atau jika banyak:
-- 1. Export data kelompok
-- 2. Replace "siswa-" dengan "" di semua anggota
-- 3. Convert string ke integer
-- 4. Import kembali
```

**Note**: Cara ini tidak disarankan karena:
- Harus update manual semua data yang ada
- Frontend masih akan simpan format "siswa-X" untuk kelompok baru
- Problem akan muncul lagi di masa depan

## Recommended Action

**FIX BACKEND** dengan query yang flexible seperti yang dijelaskan di atas.
