import { useEffect, useMemo, useRef, useState } from 'react'
import { formatApiErrorAlert, kelasAPI, nilaiAPI, pblAPI, siswaAPI } from '../../lib/api'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

type KelasOption = { id: string; nama: string; tingkat?: string }

type NilaiTypeFilter = 'all' | 'kuis' | 'pbl'

export default function TeacherNilai() {
  const [nilai, setNilai] = useState<any[]>([])
  const [rawNilai, setRawNilai] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filterKelas, setFilterKelas] = useState('')
  const [filterType, setFilterType] = useState<NilaiTypeFilter>('all')
  const [kelasNameById, setKelasNameById] = useState<Record<string, string>>({})
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([])
  const didInitialLoad = useRef(false)
  const [kelompokById, setKelompokById] = useState<Record<string, { nama_kelompok?: string; anggota?: Array<string | number> }>>({})
  const loadedKelompokProjectIds = useRef<Set<string>>(new Set())
  const [siswaMeta, setSiswaMeta] = useState<{
    byId: Record<
      string,
      { nama?: string; jurusan_id?: string; jurusan_nama?: string; kelas_id?: string; kelas_nama?: string; email?: string }
    >
    byEmail: Record<string, { nama?: string; jurusan_id?: string; jurusan_nama?: string; kelas_id?: string; kelas_nama?: string }>
  }>({ byId: {}, byEmail: {} })

  useEffect(() => {
    async function loadKelasMaster() {
      try {
        const res = await kelasAPI.getAll()
        const list: any[] = Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray((res as any)?.data?.data) ? (res as any).data.data : []
        if (!Array.isArray(list)) return
        const map: Record<string, string> = {}
        const opts: KelasOption[] = []
        for (const k of list) {
          const id = k?.id != null ? String(k.id) : ''
          const nama = k?.nama != null ? String(k.nama) : ''
          if (id && nama) map[id] = nama
          if (id && nama) opts.push({ id, nama, tingkat: k?.tingkat != null ? String(k.tingkat) : undefined })
        }
        setKelasNameById(map)
        setKelasOptions(opts.sort((a, b) => a.nama.localeCompare(b.nama)))
      } catch {
        // ignore
      }
    }

    loadKelasMaster()
  }, [])

  useEffect(() => {
    async function loadSiswaMeta() {
      try {
        const res = await siswaAPI.getAll()
        const list: any[] = Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray((res as any)?.data?.data) ? (res as any).data.data : []
        if (!Array.isArray(list) || list.length === 0) return

        const byId: Record<
          string,
          { nama?: string; jurusan_id?: string; jurusan_nama?: string; kelas_id?: string; kelas_nama?: string; email?: string }
        > = {}
        const byEmail: Record<string, { nama?: string; jurusan_id?: string; jurusan_nama?: string; kelas_id?: string; kelas_nama?: string }> = {}

        for (const s of list) {
          const id = String(s?.id ?? '')
          if (!id) continue

          const nama =
            s?.nama != null
              ? String(s.nama)
              : s?.user?.nama != null
                ? String(s.user.nama)
                : s?.name != null
                  ? String(s.name)
                  : undefined
          const jurusanId =
            s?.jurusan_id != null
              ? String(s.jurusan_id)
              : s?.jurusanId != null
                ? String(s.jurusanId)
                : s?.jurusan?.id != null
                  ? String(s.jurusan.id)
                  : undefined
          const jurusanNama =
            s?.jurusan?.nama != null
              ? String(s.jurusan.nama)
              : s?.jurusan_nama != null
                ? String(s.jurusan_nama)
                : undefined

          const kelasId =
            s?.kelas_id != null
              ? String(s.kelas_id)
              : s?.kelasId != null
                ? String(s.kelasId)
                : s?.kelas?.id != null
                  ? String(s.kelas.id)
                  : undefined

          const kelasNama =
            s?.kelas?.nama != null
              ? String(s.kelas.nama)
              : s?.kelas_nama != null
                ? String(s.kelas_nama)
                : kelasId && kelasNameById[kelasId]
                  ? kelasNameById[kelasId]
                  : s?.kelas != null && typeof s.kelas === 'string'
                    ? String(s.kelas)
                    : undefined
          const email = s?.email != null ? String(s.email) : undefined

          byId[id] = { nama, jurusan_id: jurusanId, jurusan_nama: jurusanNama, kelas_id: kelasId, kelas_nama: kelasNama, email }
          if (email) byEmail[email] = { nama, jurusan_id: jurusanId, jurusan_nama: jurusanNama, kelas_id: kelasId, kelas_nama: kelasNama }
        }

        setSiswaMeta({ byId, byEmail })
      } catch {
        // ignore: jurusan filter will be unavailable
      }
    }

    loadSiswaMeta()
  }, [kelasNameById])

  useEffect(() => {
  }, [])

  useEffect(() => {
    loadNilai().finally(() => {
      didInitialLoad.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!didInitialLoad.current) return
    loadNilai()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType])

  useEffect(() => {
    // Untuk Nilai PBL: backend biasanya hanya mengirim `kelompok_id`.
    // Kita fetch daftar kelompok per project agar bisa tampilkan nama kelompok dan kelas (via anggota).
    const projectIds = Array.from(
      new Set(
        (nilai || [])
          .map((n) => n?.project_id ?? n?.pbl_id ?? n?.projectId)
          .filter((v) => v != null)
          .map((v) => String(v))
          .filter((s) => s.length > 0)
      )
    )
    if (projectIds.length === 0) return

    const missing = projectIds.filter((pid) => !loadedKelompokProjectIds.current.has(pid))
    if (missing.length === 0) return

    let cancelled = false
    ;(async () => {
      const nextMap: Record<string, { nama_kelompok?: string; anggota?: Array<string | number> }> = {}

      for (const projectId of missing) {
        try {
          const res = await pblAPI.getKelompok(projectId)
          if (!res?.success) {
            loadedKelompokProjectIds.current.add(projectId)
            continue
          }
          const list: any[] = Array.isArray((res as any)?.data)
            ? (res as any).data
            : Array.isArray((res as any)?.data?.data)
              ? (res as any).data.data
              : []

          for (const k of list) {
            const id = k?.id != null ? String(k.id) : ''
            if (!id) continue
            nextMap[id] = {
              nama_kelompok: k?.nama_kelompok != null ? String(k.nama_kelompok) : undefined,
              anggota: Array.isArray(k?.anggota) ? (k.anggota as Array<string | number>) : undefined,
            }
          }

          loadedKelompokProjectIds.current.add(projectId)
        } catch {
          loadedKelompokProjectIds.current.add(projectId)
        }
      }

      if (cancelled) return
      if (Object.keys(nextMap).length > 0) {
        setKelompokById((prev) => ({ ...prev, ...nextMap }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [nilai])

  async function loadNilai() {
    try {
      setLoading(true)
      const useLegacyGradeEndpoint = kelasOptions.length === 0 && !!filterKelas

      const response = useLegacyGradeEndpoint
        ? await nilaiAPI.getNilaiByKelas(filterKelas)
        : await nilaiAPI.getNilai({ type: filterType })
      
      if (response.success) {
        const data: any = (response as any).data
        const list =
          Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.kuis) || Array.isArray(data?.pbl)
                ? [...(Array.isArray(data?.kuis) ? data.kuis : []), ...(Array.isArray(data?.pbl) ? data.pbl : [])]
                : []
        if (Array.isArray(list)) {
          setRawNilai(list)
          setNilai(list)
        }
      }
    } catch (error) {
      console.error('Error loading nilai:', error)
    } finally {
      setLoading(false)
    }
  }

  // Keep `rawNilai` for debugging/inspection; the displayed list is server-filtered into `nilai`.
  useMemo(() => rawNilai, [rawNilai])

  // If kelasOptions exist, filterKelas is stored as `id::nama`.
  const selectedKelasNama = useMemo(() => {
    if (!filterKelas) return ''
    if (filterKelas.includes('::')) return filterKelas.split('::').slice(1).join('::').trim()
    return filterKelas.trim()
  }, [filterKelas])

  async function handleExportExcel() {
    if (exporting) return
    try {
      setExporting(true)

      const params: { type?: 'all' | 'kuis' | 'pbl'; kelas?: string; kelas_id?: string } = {
        type: filterType,
      }

      if (filterKelas) {
        if (filterKelas.includes('::')) {
          const kelasId = filterKelas.split('::')[0]?.trim()
          if (kelasId) params.kelas_id = kelasId
        } else if (selectedKelasNama) {
          params.kelas = selectedKelasNama
        }
      }

      await nilaiAPI.downloadExport(params)
    } catch (error: any) {
      alert(formatApiErrorAlert('Gagal mengunduh Excel nilai', error))
    } finally {
      setExporting(false)
    }
  }

  const deriveRowMeta = (n: any) => {
    const siswaId =
      n?.siswa_id ??
      n?.siswaId ??
      n?.user_id ??
      n?.userId ??
      n?.siswa?.id ??
      n?.user?.id
    const email =
      n?.email_siswa ??
      n?.siswa_email ??
      n?.user_email ??
      n?.email ??
      n?.user?.email

    const metaById = siswaId != null ? siswaMeta.byId[String(siswaId)] : undefined
    const metaByEmail = email != null ? siswaMeta.byEmail[String(email)] : undefined

    const kelompokId = n?.kelompok_id ?? n?.kelompokId
    const kelompokInfo = kelompokId != null ? kelompokById[String(kelompokId)] : undefined

    const directKelasId = n?.kelas_id ?? n?.kelasId
    const kelasFromId = directKelasId != null ? kelasNameById[String(directKelasId)] : undefined

    const kelasFromAnggota = (() => {
      const anggota = kelompokInfo?.anggota
      if (!Array.isArray(anggota) || anggota.length === 0) return undefined
      const first = String(anggota[0])
      const meta = siswaMeta.byId[first] || siswaMeta.byId[first.replace(/^siswa-/, '')]
      return meta?.kelas_nama
    })()

    const rawKelas =
      kelasFromAnggota ||
      metaById?.kelas_nama ||
      metaByEmail?.kelas_nama ||
      kelasFromId ||
      n?.kelas_nama ||
      n?.kelasNama ||
      n?.kelas ||
      n?.kelas_siswa
    const kelasText = rawKelas != null ? String(rawKelas).trim() : ''

    const rawNama =
      n?.nama_siswa ||
      n?.siswa_nama ||
      n?.nama ||
      n?.siswa?.nama ||
      n?.user?.nama ||
      metaById?.nama ||
      metaByEmail?.nama ||
      kelompokInfo?.nama_kelompok
    const namaText = rawNama != null ? String(rawNama).trim() : ''

    return { siswaId, email, metaById, metaByEmail, kelompokId, kelompokInfo, kelasText, namaText }
  }

  const displayNilai = useMemo(() => {
    const list = Array.isArray(nilai) ? nilai : []
    if (!filterKelas) return list

    const gradeOnly = /^(x|xi|xii)$/i.test(selectedKelasNama)
    const want = selectedKelasNama.trim().toLowerCase()

    return list.filter((n) => {
      const { kelasText, kelompokId } = deriveRowMeta(n)
      const k = (kelasText || '').trim()

      if (!k) {
        // Jangan kosongkan tabel sementara data kelompok belum ter-fetch.
        if (kelompokId && !kelompokById[String(kelompokId)]) return true
        return false
      }

      if (gradeOnly) {
        return k.toLowerCase() === want || k.toLowerCase().startsWith(want + ' ')
      }

      return k.toLowerCase() === want
    })
  }, [nilai, filterKelas, selectedKelasNama, kelompokById, siswaMeta, kelasNameById])

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data nilai...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
            Nilai Guru
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Rekap nilai</h1>
          <p className="mt-2 text-sm text-slate-600">Nilai kuis dan PBL siswa dari backend</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <ResponsiveSelect
            value={filterType}
            onChange={(value) => setFilterType(value as NilaiTypeFilter)}
            placeholder="Semua"
            includeEmptyOption={false}
            containerClassName="w-full sm:w-36"
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'kuis', label: 'Kuis' },
              { value: 'pbl', label: 'PBL' },
            ]}
          />

          <ResponsiveSelect
            value={filterKelas}
            onChange={setFilterKelas}
            placeholder="Semua Kelas"
            emptyOptionLabel="Semua Kelas"
            containerClassName="w-full sm:w-48"
            options={
              kelasOptions.length > 0
                ? kelasOptions.map((k) => ({ value: `${k.id}::${k.nama}`, label: k.nama }))
                : [
                    { value: 'X', label: 'X' },
                    { value: 'XI', label: 'XI' },
                    { value: 'XII', label: 'XII' },
                  ]
            }
          />

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="w-full sm:w-auto rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? 'Mengunduh…' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Kelas</th>
              <th className="px-4 py-3 font-semibold">Tipe</th>
              <th className="px-4 py-3 font-semibold">Kegiatan</th>
              <th className="px-4 py-3 font-semibold">Nilai</th>
              <th className="px-4 py-3 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {displayNilai.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data nilai
                </td>
              </tr>
            ) : (
              displayNilai.map((n, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {(() => {
                      const { namaText } = deriveRowMeta(n)
                      return namaText || '-'
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(() => {
                      const { kelasText, metaById, metaByEmail } = deriveRowMeta(n)
                      if (!kelasText) return '-'

                      const jurusanNama =
                        metaById?.jurusan_nama ||
                        metaByEmail?.jurusan_nama ||
                        n?.jurusan_nama ||
                        n?.jurusanNama ||
                        n?.jurusan?.nama

                      const isGradeOnly = /^(x|xi|xii)$/i.test(kelasText)
                      if (isGradeOnly && jurusanNama) {
                        const j = String(jurusanNama).trim()
                        return j ? `${kelasText.toUpperCase()} ${j}` : kelasText.toUpperCase()
                      }

                      return kelasText
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {n.project_id || n.project_judul ? (
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">PBL</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Kuis</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {n.judul_kuis || n.kuis_judul || n.kuis || n.project_judul || n.judul || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {(() => {
                      const v = Number(n.nilai ?? n.score ?? 0)
                      return Number.isFinite(v) ? v.toFixed(2) : '0.00'
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    {(() => {
                      const iso = n.tanggal || n.created_at
                      return iso ? new Date(iso).toLocaleDateString('id-ID') : '-'
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
