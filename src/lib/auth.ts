export type Role = 'siswa' | 'guru' | 'admin'

export type Session = {
  id?: string
  role: Role
  email: string
  kelas?: string
  kelas_id?: string
  jurusan?: string
  nama?: string
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem('session')
    if (!raw) return null
    const user = JSON.parse(raw)

    const idRaw = user.id ?? user.user?.id ?? user.siswa?.id ?? user.profile?.id
    const id = idRaw != null ? String(idRaw) : undefined

    const kelasIdRaw = user.kelas_id ?? user.kelas?.id ?? user.kelas_relation?.id
    const kelasId = kelasIdRaw != null ? String(kelasIdRaw) : undefined

    const kelasName =
      (typeof user.kelas === 'string' && user.kelas) ||
      (typeof user.kelas_relation?.nama === 'string' && user.kelas_relation.nama) ||
      (typeof user.kelas?.nama === 'string' && user.kelas.nama) ||
      (typeof user.kelas?.tingkat === 'string' && user.kelas.tingkat) ||
      undefined

    const jurusanName =
      (typeof user.jurusan === 'string' && user.jurusan) ||
      (typeof user.jurusan_name === 'string' && user.jurusan_name) ||
      (typeof user.jurusan_relation?.nama === 'string' && user.jurusan_relation.nama) ||
      (typeof user.jurusan?.nama === 'string' && user.jurusan.nama) ||
      (typeof user.jurusan?.name === 'string' && user.jurusan.name) ||
      undefined

    // Convert format dari backend ke format Session
    return {
      id,
      role: user.role,
      email: user.email,
      nama: user.nama ?? user.name,
      kelas: kelasName,
      kelas_id: kelasId,
      jurusan: jurusanName
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

export function patchSession(patch: Partial<Session>): void {
  const current = getSession()
  if (!current) return
  setSession({ ...current, ...patch })
}

export function clearSession(): void {
  localStorage.removeItem('session')
  localStorage.removeItem('auth_token')
}

