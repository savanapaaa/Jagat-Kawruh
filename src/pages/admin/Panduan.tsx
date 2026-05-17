import { useEffect, useMemo, useState } from 'react'
import { formatApiErrorAlert, panduanAPI, type PanduanRole } from '../../lib/api'

type PdfStatus = 'checking' | 'available' | 'missing' | 'unknown'

type RoleConfig = {
  role: PanduanRole
  label: string
  badgeClassName: string
  defaultStaticUrl: string
}

function PanduanRoleCard({ config }: { config: RoleConfig }) {
  const [pdfUrl, setPdfUrl] = useState<string>(config.defaultStaticUrl)
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('checking')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadPdfUrl() {
    setNotice(null)
    try {
      const response = await panduanAPI.get(config.role)
      if (response.success) {
        const url = response.data?.pdf_url
        if (typeof url === 'string' && url.trim()) {
          setPdfUrl(url)
          return
        }
      }
      setPdfUrl(config.defaultStaticUrl)
    } catch {
      setPdfUrl(config.defaultStaticUrl)
    }
  }

  useEffect(() => {
    void loadPdfUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkPdf() {
      setPdfStatus('checking')
      try {
        const response = await fetch(pdfUrl, { method: 'HEAD', cache: 'no-store' })
        const ct = response.headers.get('content-type') || ''
        if (cancelled) return

        if (!response.ok) {
          setPdfStatus('missing')
          return
        }

        if (ct.toLowerCase().includes('application/pdf')) {
          setPdfStatus('available')
          return
        }

        setPdfStatus('missing')
      } catch {
        if (cancelled) return
        setPdfStatus('unknown')
      }
    }

    void checkPdf()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setNotice(null)

    try {
      await panduanAPI.upload(config.role, selectedFile)
      setSelectedFile(null)
      await loadPdfUrl()
      setNotice('PDF berhasil diperbarui.')
    } catch (error: any) {
      setNotice(formatApiErrorAlert('Gagal mengunggah PDF.', error))
    } finally {
      setUploading(false)
    }
  }

  const canOpen = pdfStatus === 'available' || pdfStatus === 'unknown'

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className={['inline-flex rounded-full px-4 py-2 text-xs font-semibold', config.badgeClassName].join(' ')}>
            {config.label}
          </div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-800">Panduan (PDF)</h2>
          <p className="mt-2 text-sm text-slate-600">Unggah file PDF untuk role ini.</p>
        </div>

        {canOpen ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 sm:w-auto"
          >
            Buka / Unduh PDF
          </a>
        ) : (
          <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 sm:w-auto">
            Buka / Unduh PDF
          </span>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {uploading ? 'Mengunggah...' : 'Simpan'}
          </button>
        </div>
        {notice ? <div className="mt-3 whitespace-pre-line text-sm text-slate-700">{notice}</div> : null}
      </div>

      {pdfStatus === 'checking' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Memeriksa file panduan...
        </div>
      )}

      {pdfStatus === 'missing' && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          PDF panduan belum tersedia.
        </div>
      )}

      {(pdfStatus === 'available' || pdfStatus === 'unknown') && (
        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <iframe title={`${config.label} (PDF)`} src={pdfUrl} className="h-[70vh] w-full" />
        </div>
      )}

      {pdfStatus === 'unknown' && (
        <div className="mt-3 text-xs text-slate-500">Tidak bisa memverifikasi tipe file. Coba buka lewat tombol unduh.</div>
      )}
    </div>
  )
}

export default function AdminPanduan() {
  const configs = useMemo<RoleConfig[]>(
    () => [
      {
        role: 'admin',
        label: 'Panduan Admin',
        badgeClassName: 'bg-blue-100 text-blue-800',
        defaultStaticUrl: '/panduan-admin.pdf',
      },
      {
        role: 'guru',
        label: 'Panduan Guru',
        badgeClassName: 'bg-amber-100 text-amber-800',
        defaultStaticUrl: '/panduan-guru.pdf',
      },
      {
        role: 'siswa',
        label: 'Panduan Siswa',
        badgeClassName: 'bg-emerald-100 text-emerald-800',
        defaultStaticUrl: '/panduan-siswa.pdf',
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-blue-800">Panduan</div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
          Manajemen Panduan
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Admin dapat mengunggah panduan PDF untuk tiap role.
        </p>
      </div>

      {configs.map((config) => (
        <PanduanRoleCard key={config.role} config={config} />
      ))}
    </div>
  )
}
