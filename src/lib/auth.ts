export type Role = 'siswa' | 'guru' | 'admin'

export type Session = {
  role: Role
  email: string
  kelas?: string
  jurusan?: string
  nama?: string
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem('session')
    if (!raw) return null
    const user = JSON.parse(raw)
    // Convert format dari backend ke format Session
    return {
      role: user.role,
      email: user.email,
      nama: user.nama,
      kelas: user.kelas,
      jurusan: user.jurusan
    }
  } catch {
    return null
  }
}

export function getCurrentUser(): Session | null {
  return getSession()
}

export function setSession(session: Session): void {
  localStorage.setItem('session', JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem('session')
  localStorage.removeItem('auth_token')
}

