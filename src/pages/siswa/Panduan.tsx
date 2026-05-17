import { useEffect, useState } from 'react'
import { panduanAPI } from '../../lib/api'

type PdfStatus = 'checking' | 'available' | 'missing' | 'unknown'

export default function SiswaPanduan() {
  const [pdfUrl, setPdfUrl] = useState('/panduan-siswa.pdf')
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('checking')

  useEffect(() => {
    let cancelled = false

    async function loadPdfUrl() {
      try {
        const response = await panduanAPI.get('siswa')
        if (cancelled) return
        const url = response.data?.pdf_url
        if (response.success && typeof url === 'string' && url.trim()) {
          setPdfUrl(url)
        }
      } catch {
        // fallback to static
      }
    }

    void loadPdfUrl()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkPdf() {
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-800">
          Panduan Siswa
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
          Panduan
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Panduan ditampilkan dalam format PDF.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">Panduan (PDF)</h2>
            <p className="mt-2 text-sm text-slate-600">Buka atau lihat dokumen panduan.</p>
          </div>

          {pdfStatus === 'available' || pdfStatus === 'unknown' ? (
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
            <iframe title="Panduan Siswa (PDF)" src={pdfUrl} className="h-[70vh] w-full" />
          </div>
        )}

        {pdfStatus === 'unknown' && (
          <div className="mt-3 text-xs text-slate-500">Tidak bisa memverifikasi tipe file. Coba buka lewat tombol unduh.</div>
        )}
      </div>
    </div>
  )
}
