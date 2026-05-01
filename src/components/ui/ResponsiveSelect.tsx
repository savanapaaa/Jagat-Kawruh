import { useEffect, useRef, useState } from 'react'

export type ResponsiveSelectOption = {
  value: string
  label: string
}

type ResponsiveSelectProps = {
  value: string
  onChange: (value: string) => void
  options: ResponsiveSelectOption[]
  placeholder: string
  containerClassName?: string
  buttonClassName?: string
  menuClassName?: string
  includeEmptyOption?: boolean
  emptyOptionLabel?: string
  disabled?: boolean
}

export default function ResponsiveSelect({
  value,
  onChange,
  options,
  placeholder,
  containerClassName,
  buttonClassName,
  menuClassName,
  includeEmptyOption = true,
  emptyOptionLabel,
  disabled = false,
}: ResponsiveSelectProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    setOpenUp(spaceBelow < 240 && spaceAbove > spaceBelow)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${containerClassName || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm outline-none focus:border-amber-400 ${buttonClassName || ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && !disabled && (
        <div
          className={`absolute left-0 right-0 z-[120] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${menuClassName || ''}`}
          role="listbox"
        >
          {includeEmptyOption && (
            <button
              type="button"
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 ${value === '' ? 'bg-amber-100 text-amber-800' : 'text-slate-700'}`}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {emptyOptionLabel || placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 ${value === opt.value ? 'bg-amber-100 text-amber-800' : 'text-slate-700'}`}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
