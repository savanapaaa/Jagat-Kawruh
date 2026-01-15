export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="border-t border-slate-200" />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            © {new Date().getFullYear()} <span className="font-semibold text-slate-800">Jagat Kawruh</span>
          </div>
          <div className="text-xs text-slate-500">Media pembelajaran • Modern • Efisien</div>
        </div>
      </div>
    </footer>
  )
}
