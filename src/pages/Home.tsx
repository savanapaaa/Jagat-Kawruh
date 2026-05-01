import Footer from '../components/Footer'

type Feature = { title: string; description: string }

type Step = { number: string; title: string; description: string }

const FEATURES: Feature[] = [
  {
    title: 'Materi (PDF/Video/Link)',
    description: 'Akses materi sesuai kelas/jurusan Anda. Materi bisa berupa PDF, video, atau link, dan dapat diunduh untuk akses offline.',
  },
  {
    title: 'Kuis Timer + Auto Grading',
    description: 'Kerjakan kuis dengan timer (sekali kesempatan). Setelah submit, nilai dihitung otomatis dan hasilnya langsung bisa dilihat.',
  },
  {
    title: 'PBL 5 Fase (Kelompok)',
    description: 'Kerjakan project PBL dalam 5 fase bersama kelompok. Fase berikutnya terbuka setelah fase sebelumnya selesai dan disetujui.',
  },
  {
    title: 'Nilai Kuis & PBL',
    description: 'Pantau nilai kuis dan hasil PBL, lengkap dengan progres pembelajaran agar Anda tahu apa yang perlu ditingkatkan.',
  },
  {
    title: 'Notifikasi Pembelajaran',
    description: 'Dapatkan notifikasi terkait aktivitas belajar agar Anda tidak ketinggalan informasi penting.',
  },
]

const HOW_IT_WORKS: Step[] = [
  {
    number: '01',
    title: 'Masuk',
    description: 'Masuk dengan email dan password. Sistem akan mengarahkan Anda ke dasbor siswa.',
  },
  {
    number: '02',
    title: 'Akses Materi',
    description: 'Buka menu Materi untuk melihat materi yang tersedia sesuai kelas/jurusan Anda, lalu baca atau unduh bila diperlukan.',
  },
  {
    number: '03',
    title: 'Kerjakan Kuis',
    description: 'Mulai kuis, kerjakan dengan timer, dan submit jawaban. Nilai akan dihitung otomatis setelah dikumpulkan.',
  },
  {
    number: '04',
    title: 'Kerjakan PBL per Fase',
    description: 'Masuk ke menu PBL dan isi tugas per fase bersama kelompok. Progress akan bertambah seiring fase yang diselesaikan.',
  },
  {
    number: '05',
    title: 'Lihat Nilai & Progres',
    description: 'Pantau nilai kuis dan status PBL, serta progres belajar Anda untuk mengetahui perkembangan secara berkala.',
  },
]

function Navbar() {
  return (
    <header className="sticky top-0 z-[60] border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex w-full items-center justify-between px-3 py-4 sm:px-6 lg:px-8">
        <a href="#home" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Jagat Kawruh"
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">JAGAT KAWRUH</div>
            <div className="text-[11px] text-slate-600">Media pembelajaran</div>
          </div>
        </a>

        <a
          href="/login"
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
        >
          Masuk
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -right-24 top-10 h-[560px] w-[560px] rounded-full bg-amber-100/60" />
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-amber-100/40" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-3 py-16 sm:px-4 lg:grid-cols-2 lg:items-center lg:py-20">
        <div>
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
            Platform Pembelajaran Modern
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="text-slate-800">Belajar Lebih Mudah,</span>
            <br />
            <span className="text-amber-600">Hasil Lebih Baik</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
            Platform media pembelajaran yang menghubungkan siswa dan guru dalam satu ekosistem digital yang
            modern dan efisien.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="#cara-kerja"
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              Mulai Belajar
            </a>
            <a
              href="#fitur"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Pelajari Lebih Lanjut
            </a>
          </div>
        </div>

        <div className="relative lg:justify-self-end">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100" />
              <div>
                <div className="text-sm font-semibold text-slate-800">Platform Pembelajaran</div>
                <div className="text-xs text-slate-500">Ringkas • Interaktif • Terarah</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:py-5">
              <div className="overflow-hidden rounded-xl bg-white">
                <img
                  src="/hero-school.jpg"
                  alt="Ilustrasi anak sekolah"
                  className="block w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />

                <div className="hidden h-56 w-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="fitur" className="scroll-mt-24">
      <div className="border-t border-slate-200" />
      <div className="mx-auto w-full max-w-6xl px-3 py-16 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Fitur</h2>
            <p className="mt-2 text-sm text-slate-600">Fitur sederhana yang paling kamu butuhkan untuk belajar.</p>
          </div>
          <a href="#cara-kerja" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
            Lihat cara kerja →
          </a>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <div key={feature.title} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-sm font-bold text-amber-700">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-800">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-24">
      <div className="border-t border-slate-200" />
      <div className="mx-auto w-full max-w-6xl px-3 py-16 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Cara Kerja</h2>
          <p className="text-sm text-slate-500">Langkah mudah untuk memulai pembelajaran digital bersama kami</p>
        </div>

        <div className="mt-12">
          <div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="relative">
              <div className="absolute left-5 top-0 h-full w-px bg-amber-200" />

              <div className="grid gap-8">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.number} className="relative pl-16">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-sm font-extrabold text-white shadow-sm">
                      {step.number}
                    </div>
                    <div className="pt-1">
                      <div className="text-lg font-bold text-slate-800">{step.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoginCta() {
  return (
    <section>
      <div className="border-t border-slate-200" />
      <div className="mx-auto w-full max-w-6xl px-3 py-12 sm:px-4">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-800">Siap mulai?</div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">
                Masuk untuk melanjutkan pembelajaran
              </div>
            </div>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              Masuk
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div id="home" className="flex min-h-screen flex-col bg-amber-50/40 text-slate-900">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <LoginCta />
      </main>
      <Footer />
    </div>
  )
}
