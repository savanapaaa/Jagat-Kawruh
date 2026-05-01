import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { authAPI, kuisAPI } from '../../lib/api'
import { gameState } from '../../lib/gameState'
import { gameAudio } from '../../lib/gameAudio'
import { getSession } from '../../lib/auth'
import { tambahNotifikasi } from '../../lib/idbNotifikasi'
import type { WayangCharacter, Achievement, GameSession } from '../../lib/gameState'
import { WayangPicker } from '../../components/quiz/WayangPicker'
import { GameHUD } from '../../components/quiz/GameHUD'
import { AchievementPopup } from '../../components/quiz/AchievementPopup'
import { GameBoard } from '../../components/quiz/GameBoard'
import { Icon } from '../../components/ui/Icon'

type TeacherQuizStatus = 'Aktif' | 'Draft' | 'Selesai' | string
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type ChoiceOptions = Record<ChoiceKey, string>

type TeacherQuizQuestion = {
  id: string
  text?: string
  pertanyaan?: string
  image?: string
  options?: ChoiceOptions | string[]
  pilihan?: ChoiceOptions | string[]
  answer?: ChoiceKey
  jawaban?: ChoiceKey
  urutan?: number
}

type TeacherQuizItem = {
  id: string
  judul: string
  status: TeacherQuizStatus
  peserta?: number
  soal?: TeacherQuizQuestion[]
  batas_waktu?: number
}

type NormalizedQuestion = {
  id: string
  text: string
  image?: string
  options: ChoiceOptions
  answer?: ChoiceKey
}

type SubmitResult = {
  nilai?: number
  score?: number
  benar?: number
  total_soal?: number
  total?: number
}

type LocalStudentScore = {
  id: string
  kuis_id?: string
  judul_kuis?: string
  tanggal?: string
  nilai?: number
  score?: number
  benar?: number
  total_soal?: number
  email?: string
}

type StoredAttempt = {
  attemptId: string
  token: string
  endsAt?: string
  answers?: Record<string, ChoiceKey>
}

function isActiveQuizStatus(status: any): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'aktif' || s === 'published'
}

/**
 * Parse pilihan from either:
 * - Object: { A: "text", B: "text", ... }
 * - Array:  ["A. text", "B. text", ...] or ["text1", "text2", ...]
 */
function parseOptions(raw: unknown): ChoiceOptions | null {
  if (!raw) return null

  // Case 1: Already an object with A/B/C/D/E keys
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (
      typeof obj.A === 'string' &&
      typeof obj.B === 'string' &&
      typeof obj.C === 'string' &&
      typeof obj.D === 'string' &&
      typeof obj.E === 'string'
    ) {
      return {
        A: String(obj.A),
        B: String(obj.B),
        C: String(obj.C),
        D: String(obj.D),
        E: String(obj.E),
      }
    }
    return null
  }

  // Case 2: Array of strings like ["A. Bahasa pemrograman", "B. Markup language", ...]
  if (Array.isArray(raw)) {
    const keys: ChoiceKey[] = ['A', 'B', 'C', 'D', 'E']
    const result: Record<string, string> = {}

    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      const item = String(raw[i] ?? '')
      // Try to strip "A. ", "B) ", "A: " prefix
      const match = item.match(/^([A-E])[.):\s]+\s*(.*)/i)
      if (match) {
        const key = match[1].toUpperCase() as ChoiceKey
        result[key] = match[2].trim()
      } else {
        // No prefix — assign by position
        result[keys[i]] = item.trim()
      }
    }

    // Ensure all 5 keys exist
    for (const k of keys) {
      if (typeof result[k] !== 'string') result[k] = '-'
    }

    return result as ChoiceOptions
  }

  return null
}

function normalizeQuestion(q: TeacherQuizQuestion): NormalizedQuestion | null {
  const text = (typeof q.text === 'string' && q.text.trim()) || (typeof q.pertanyaan === 'string' && q.pertanyaan.trim()) || ''
  const options = parseOptions(q.options) || parseOptions(q.pilihan)
  if (!q.id || !text || !options) return null

  const correctAnswer = (q.answer || q.jawaban) as ChoiceKey | undefined
  return {
    id: String(q.id),
    text,
    image: q.image ?? undefined,
    options,
    answer: correctAnswer,
  }
}

function pickNumber(v: any): number | undefined {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : undefined
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizeSubmitResult(data: any): SubmitResult | null {
  if (!data || typeof data !== 'object') return null

  // Some backends wrap payload as { data: {...} }
  const payload: any = data && typeof (data as any).data === 'object' ? (data as any).data : data

  let nilai = pickNumber(payload?.nilai ?? payload?.nilai_akhir)
  const score = pickNumber(payload?.score ?? payload?.skor)
  const benar = pickNumber(payload?.benar ?? payload?.correct ?? payload?.correct_count)
  const total_soal = pickNumber(payload?.total_soal ?? payload?.total_questions ?? payload?.jumlah_soal)
  const total = pickNumber(payload?.total ?? payload?.totalSoal)

  const denom = (total_soal ?? total)
  const derivedNilai = benar != null && denom != null && denom > 0 ? round2((benar / denom) * 100) : null

  // Fallback: compute nilai from correct answers.
  if (nilai == null && derivedNilai != null) {
    nilai = derivedNilai
  }

  // Some backends return nilai=0 even when correct answers exist,
  // while the real grade is calculated/stored elsewhere.
  // Prefer derived score when it is clearly more informative.
  if (nilai === 0 && derivedNilai != null && derivedNilai > 0) {
    nilai = derivedNilai
  }

  if (nilai == null && score == null && benar == null && total_soal == null && total == null) return null
  return { nilai, score, benar, total_soal, total }
}

function safeParseJson<T>(raw: string | null): T | null {
  try {
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function pickString(v: any): string {
  return v == null ? '' : String(v)
}

function loadLocalStudentScores(): LocalStudentScore[] {
  try {
    const raw = localStorage.getItem('jk_student_scores')
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LocalStudentScore[]) : []
  } catch {
    return []
  }
}

// Character bonuses for each wayang
function getCharacterBonuses(character: WayangCharacter): {
  bonusHp: number
  bonusHint: number
  bonusShield: number
  trapDamageReduction: number
  description: string
} {
  switch (character) {
    case 'arjuna':
      return { bonusHp: 20, bonusHint: 0, bonusShield: 0, trapDamageReduction: 0, description: '+20 HP Maksimal' }
    case 'bima':
      return { bonusHp: 0, bonusHint: 0, bonusShield: 0, trapDamageReduction: 0.5, description: 'Damage jebakan -50%' }
    case 'gatotkaca':
      return { bonusHp: 0, bonusHint: 0, bonusShield: 1, trapDamageReduction: 0, description: '+1 Shield Ekstra' }
    case 'srikandi':
      return { bonusHp: 0, bonusHint: 1, bonusShield: 0, trapDamageReduction: 0, description: '+1 Hint Ekstra' }
    case 'semar':
      return { bonusHp: 10, bonusHint: 0, bonusShield: 0, trapDamageReduction: 0.25, description: '+10 HP & jebakan -25%' }
    default:
      return { bonusHp: 0, bonusHint: 0, bonusShield: 0, trapDamageReduction: 0, description: '' }
  }
}

export default function KuisMulai() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quizId: quizIdParam } = useParams()

  const session = useMemo(() => getSession(), [])

  const kuisIdRaw = useMemo(() => String(quizIdParam ?? '').trim(), [quizIdParam])
  const kuisIdAltNumeric = useMemo(() => {
    const raw = String(quizIdParam ?? '').trim()
    const m = raw.match(/(\d+)$/)
    return m ? m[1] : ''
  }, [quizIdParam])

  const [effectiveKuisId, setEffectiveKuisId] = useState<string>('')
  useEffect(() => {
    // Prefer the raw ID from the route (e.g. 'kuis-28').
    // We'll retry with the alternate numeric suffix if backend expects it.
    setEffectiveKuisId(kuisIdRaw || kuisIdAltNumeric || '')
  }, [kuisIdRaw, kuisIdAltNumeric])

  const [quiz, setQuiz] = useState<TeacherQuizItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [siswaId, setSiswaId] = useState<string>('')
  const [hasStarted, setHasStarted] = useState(false)
  const [focusMode, setFocusMode] = useState(true)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [isTimeUp, setIsTimeUp] = useState(false)

  const [attemptId, setAttemptId] = useState<string>('')
  const [attemptToken, setAttemptToken] = useState<string>('')
  const [attemptEndsAt, setAttemptEndsAt] = useState<string>('')
  const [rawQuestions, setRawQuestions] = useState<TeacherQuizQuestion[]>([])

  const autosaveInFlight = useRef(false)
  const lastSavedRef = useRef<string>('')
  const focusRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Backend attempt system can gate GET /kuis/{id} (returns 404 for siswa).
    // So we bootstrap quiz metadata from navigation state (list page) or fallback.
    const state: any = (location as any)?.state
    const stateQuiz: any = state?.quiz

    if (!effectiveKuisId) {
      setQuiz(null)
      setLoading(false)
      return
    }

    const judul = typeof stateQuiz?.judul === 'string' && stateQuiz.judul.trim() ? stateQuiz.judul.trim() : 'Kuis'
    const status = (stateQuiz?.status as any) ?? 'Aktif'
    const batas = stateQuiz?.batas_waktu

    setQuiz({
      id: String(stateQuiz?.id ?? effectiveKuisId),
      judul,
      status,
      batas_waktu: batas != null ? Number(batas) : undefined,
    })
    setLoading(false)
  }, [effectiveKuisId, location])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await authAPI.me()
        const userData = (me.data?.user || me.data) as any
        const siswaIdRaw = userData?.id ?? userData?.siswa_id
        const id = siswaIdRaw != null ? String(siswaIdRaw) : ''
        if (!cancelled) setSiswaId(id)
      } catch {
        if (!cancelled) setSiswaId('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Store answer keys separately (from full quiz data or attempt response)
  const [answerKeys, setAnswerKeys] = useState<Record<string, ChoiceKey>>({})

  const questions = useMemo(() => {
    if (!Array.isArray(rawQuestions)) return []
    const normalized = rawQuestions.map((q: any) => normalizeQuestion(q)).filter(Boolean) as NormalizedQuestion[]
    
    // Merge answer keys from fallback if questions don't already have them
    if (Object.keys(answerKeys).length > 0) {
      return normalized.map(q => ({
        ...q,
        answer: q.answer || answerKeys[q.id] || undefined,
      }))
    }
    
    return normalized
  }, [rawQuestions, answerKeys])

  const total = questions.length

  const [answers, setAnswers] = useState<Record<string, ChoiceKey>>({})
  const [error, setError] = useState<string | null>(null)

  // Game state
  const [showCharacterPicker, setShowCharacterPicker] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<WayangCharacter>('arjuna')
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([])
  const [showAchievements, setShowAchievements] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(gameAudio.isEnabled())
  
  // Pagination state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [, setTentativeScore] = useState(0)
  const [showScoreAnimation, setShowScoreAnimation] = useState(false)
  
  // Adventure mode state
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [modalQuestionIndex, setModalQuestionIndex] = useState(0)
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(-1)
  const [checkpointQuestions, setCheckpointQuestions] = useState<number[]>([])
  const [checkpointProgress, setCheckpointProgress] = useState(0) // Which question in checkpoint (0-based)
  
  // Feedback state
  const [feedbackState, setFeedbackState] = useState<{
    isCorrect: boolean
    correctAnswer: ChoiceKey | null
    selectedAnswer: ChoiceKey | null
  } | null>(null)
  
  // Game over state
  const [isGameOver, setIsGameOver] = useState(false)
  
  // Shield active (from power-up)
  const [shieldActive, setShieldActive] = useState(false)
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false)
  
  // Coins collected
  const [coinsCollected, setCoinsCollected] = useState(0)

  function persistLocalNilai(result: SubmitResult | null) {
    const scoreValue = result?.nilai ?? result?.score
    if (scoreValue == null) return

    const nowIso = new Date().toISOString()
    const record: LocalStudentScore = {
      id: attemptId || `${effectiveKuisId || 'kuis'}:${nowIso}`,
      kuis_id: effectiveKuisId || undefined,
      judul_kuis: quiz?.judul || undefined,
      tanggal: nowIso,
      nilai: result?.nilai,
      score: result?.score ?? scoreValue,
      benar: result?.benar,
      total_soal: result?.total_soal ?? result?.total,
      email: session?.email,
    }

    const list = loadLocalStudentScores()
    const idx = list.findIndex((x) => String((x as any)?.id ?? '') === record.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record }
    } else {
      list.unshift(record)
    }

    try {
      localStorage.setItem('jk_student_scores', JSON.stringify(list.slice(0, 100)))
    } catch {
      // ignore quota
    }
  }

  const durationMinutes = useMemo(() => {
    const v = Number((quiz as any)?.batas_waktu)
    return Number.isFinite(v) && v > 0 ? v : 30
  }, [quiz])

  const attemptStorageKey = useMemo(() => {
    if (!effectiveKuisId || !siswaId) return ''
    return `jk_quiz_attempt:${siswaId}:${effectiveKuisId}`
  }, [effectiveKuisId, siswaId])

  async function fetchAttemptQuestions(nextAttemptId: string, nextToken: string) {
    if (!effectiveKuisId) return
    const qRes = await kuisAPI.getAttemptQuestions(effectiveKuisId, nextAttemptId, nextToken)
    const data: any = (qRes as any)?.data
    const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data?.soal
    if (!Array.isArray(list)) {
      setRawQuestions([])
      return
    }
    setRawQuestions(list)
    
    // Use remaining_seconds from response to set timer if we don't have endsAt yet
    const remSec = pickNumber(data?.remaining_seconds)
    if (remSec != null && remSec > 0 && !attemptEndsAt) {
      const endsAt = new Date(Date.now() + remSec * 1000).toISOString()
      setAttemptEndsAt(endsAt)
    }
    
    // Check if answer keys are already in the response
    const hasAnswers = list.some((q: any) => q?.jawaban || q?.answer)
    if (hasAnswers) {
      // Build answer key map from attempt questions
      const keys: Record<string, ChoiceKey> = {}
      list.forEach((q: any) => {
        const id = String(q?.id ?? '')
        const ans = (q?.answer || q?.jawaban) as ChoiceKey | undefined
        if (id && ans) keys[id] = ans
      })
      setAnswerKeys(keys)
    } else {
      // Fallback: try to fetch full quiz data to get answer keys
      await fetchAnswerKeysFromQuiz()
    }
  }

  async function fetchAnswerKeysFromQuiz() {
    if (!effectiveKuisId) return
    try {
      const quizRes = await kuisAPI.getById(effectiveKuisId)
      const quizData: any = (quizRes as any)?.data ?? quizRes
      const soal = Array.isArray(quizData?.soal) ? quizData.soal 
        : Array.isArray(quizData?.data?.soal) ? quizData.data.soal
        : Array.isArray(quizData?.questions) ? quizData.questions
        : null
      
      if (!Array.isArray(soal)) return
      
      const keys: Record<string, ChoiceKey> = {}
      soal.forEach((q: any) => {
        const id = String(q?.id ?? '')
        const ans = (q?.jawaban || q?.answer) as ChoiceKey | undefined
        if (id && ans) keys[id] = ans
      })
      
      if (Object.keys(keys).length > 0) {
        setAnswerKeys(keys)
      }
    } catch {
      // If we can't get answer keys, game will still work but without feedback
      console.warn('Could not fetch answer keys for quiz feedback')
    }
  }

  async function startOrResumeAttempt() {
    if (!effectiveKuisId) return
    setError(null)
    
    // Initialize game session
    const profile = gameState.getProfile(siswaId || undefined)
    setSelectedCharacter(profile.selectedCharacter)
    const session = gameState.startSession(effectiveKuisId)
    
    // Apply character bonuses
    const charBonuses = getCharacterBonuses(profile.selectedCharacter)
    session.maxHp = session.maxHp + (charBonuses.bonusHp || 0)
    session.hp = session.maxHp
    session.powerUps.hint += (charBonuses.bonusHint || 0)
    session.powerUps.shield += (charBonuses.bonusShield || 0)
    gameState.updateSession(effectiveKuisId, session)
    setGameSession(session)
    
    // Show tutorial on first play
    const tutorialKey = 'jk_game_tutorial_seen'
    if (!localStorage.getItem(tutorialKey)) {
      setShowTutorial(true)
      localStorage.setItem(tutorialKey, 'true')
    }
    
    try {
      const res = await kuisAPI.startAttempt(effectiveKuisId)
      const data: any = (res as any)?.data ?? res

      const nextAttemptId = pickString(data?.attempt_id ?? data?.attemptId ?? data?.id)
      const nextToken = pickString(data?.token ?? data?.attempt_token ?? data?.attemptToken)
      const endsAt = pickString(data?.ends_at ?? data?.endsAt)

      if (!nextAttemptId || !nextToken) {
        throw new Error('Attempt token tidak ditemukan dari backend')
      }

      setAttemptId(nextAttemptId)
      setAttemptToken(nextToken)
      setAttemptEndsAt(endsAt)
      setHasStarted(true)
      setFocusMode(true)

      if (attemptStorageKey) {
        const stored: StoredAttempt = {
          attemptId: nextAttemptId,
          token: nextToken,
          endsAt: endsAt || undefined,
          answers,
        }
        localStorage.setItem(attemptStorageKey, JSON.stringify(stored))
      }

      await fetchAttemptQuestions(nextAttemptId, nextToken)
      gameAudio.playClick()
    } catch (e: any) {
      // Compatibility: retry once using alternate id representation.
      // This fixes cases where backend normalizes IDs differently for attempts/questions.
      const alternateId =
        effectiveKuisId === kuisIdRaw ? kuisIdAltNumeric : kuisIdRaw

      if (
        (e?.status === 400 || e?.status === 404 || e?.status === 500) &&
        alternateId &&
        alternateId !== effectiveKuisId
      ) {
        try {
          setEffectiveKuisId(alternateId)
          const res = await kuisAPI.startAttempt(alternateId)
          const data: any = (res as any)?.data ?? res

          const nextAttemptId = pickString(data?.attempt_id ?? data?.attemptId ?? data?.id)
          const nextToken = pickString(data?.token ?? data?.attempt_token ?? data?.attemptToken)
          const endsAt = pickString(data?.ends_at ?? data?.endsAt)

          if (!nextAttemptId || !nextToken) {
            throw new Error('Attempt token tidak ditemukan dari backend')
          }

          setAttemptId(nextAttemptId)
          setAttemptToken(nextToken)
          setAttemptEndsAt(endsAt)
          setHasStarted(true)
          setFocusMode(true)

          if (siswaId) {
            // Persist under the resolved quiz id
            const key = `jk_quiz_attempt:${siswaId}:${alternateId}`
            const stored: StoredAttempt = {
              attemptId: nextAttemptId,
              token: nextToken,
              endsAt: endsAt || undefined,
              answers,
            }
            localStorage.setItem(key, JSON.stringify(stored))
          }

          setQuiz((prev) => (prev ? { ...prev, id: alternateId } : prev))
          await fetchAttemptQuestions(nextAttemptId, nextToken)
          return
        } catch {
          // fall through to normal error handling
        }
      }
      if (attemptStorageKey) localStorage.removeItem(attemptStorageKey)
      setAttemptId('')
      setAttemptToken('')
      setAttemptEndsAt('')
      setHasStarted(false)
      setRawQuestions([])
      const friendly =
        e?.status === 404
          ? 'Kuis tidak tersedia untuk akun kamu (mungkin bukan untuk kelas kamu / belum aktif / sudah ditutup).'
          : e?.status === 400
            ? (e?.message && String(e.message).trim()
              ? `${String(e.message).trim()} (Minta guru menambahkan soal dulu, lalu coba lagi.)`
              : 'Kuis belum siap dikerjakan. (Minta guru menambahkan soal dulu.)')
          : e?.message || 'Gagal memulai attempt'
      setError(friendly)
    }
  }

  // Ensure HUD game session is restored when resuming an attempt (e.g., after refresh/back).
  useEffect(() => {
    if (!effectiveKuisId) return
    if (submitted) return
    if (!attemptId || !attemptToken) return
    if (gameSession) return

    try {
      const profile = gameState.getProfile(siswaId || undefined)
      setSelectedCharacter(profile.selectedCharacter)

      const existing = gameState.getSession(effectiveKuisId)
      if (existing) {
        setGameSession(existing)
        return
      }

      // If for some reason session is missing, recreate a minimal one (keeps UX consistent).
      const recreated = gameState.startSession(effectiveKuisId)
      const charBonuses = getCharacterBonuses(profile.selectedCharacter)
      const maxHp = recreated.maxHp + (charBonuses.bonusHp || 0)
      const next: GameSession = {
        ...recreated,
        maxHp,
        hp: maxHp,
        powerUps: {
          ...recreated.powerUps,
          hint: recreated.powerUps.hint + (charBonuses.bonusHint || 0),
          shield: recreated.powerUps.shield + (charBonuses.bonusShield || 0),
        },
      }
      gameState.updateSession(effectiveKuisId, next)
      setGameSession(next)
    } catch {
      // best-effort only
    }
  }, [effectiveKuisId, attemptId, attemptToken, submitted, gameSession, siswaId])

  // Auto-resume when we already have attempt token in local storage.
  useEffect(() => {
    if (!effectiveKuisId || !attemptStorageKey) return
    if (submitted) return
    if (!attemptId || !attemptToken) return

    let cancelled = false
    ;(async () => {
      try {
        const detailRes = await kuisAPI.getAttemptDetail(effectiveKuisId, attemptId)
        const detail: any = (detailRes as any)?.data ?? detailRes
        const status = pickString(detail?.status).toLowerCase()
        const endsAt = pickString(detail?.ends_at ?? detail?.endsAt)
        if (!cancelled) {
          if (endsAt) setAttemptEndsAt(endsAt)
          if (status && (status === 'submitted' || status === 'selesai' || status === 'expired')) {
            localStorage.removeItem(attemptStorageKey)
            setHasStarted(false)
            setRawQuestions([])
            return
          }
          setHasStarted(true)
          setFocusMode(true)
        }
        await fetchAttemptQuestions(attemptId, attemptToken)
      } catch {
        // ignore: user can start manually
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveKuisId, attemptId, attemptToken])

  useEffect(() => {
    if (!attemptStorageKey) return
    // Restore attempt on refresh/back.
    const stored = safeParseJson<StoredAttempt>(localStorage.getItem(attemptStorageKey))
    if (stored?.attemptId && stored?.token) {
      setAttemptId(String(stored.attemptId))
      setAttemptToken(String(stored.token))
      if (stored.endsAt) setAttemptEndsAt(String(stored.endsAt))
      if (stored.answers && typeof stored.answers === 'object') {
        setAnswers(stored.answers)
        lastSavedRef.current = JSON.stringify(stored.answers)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptStorageKey])

  // Persist answers locally so refresh/back doesn't reset selections.
  useEffect(() => {
    if (!attemptStorageKey) return
    if (!attemptId || !attemptToken) return
    const stored = safeParseJson<StoredAttempt>(localStorage.getItem(attemptStorageKey))
    if (!stored?.attemptId || !stored?.token) return
    const next: StoredAttempt = {
      ...stored,
      attemptId: stored.attemptId,
      token: stored.token,
      endsAt: stored.endsAt,
      answers,
    }
    try {
      localStorage.setItem(attemptStorageKey, JSON.stringify(next))
    } catch {
      // ignore quota
    }
  }, [attemptStorageKey, attemptId, attemptToken, answers])

  async function forfeitAndExit() {
    // End the attempt so the student can't redo by leaving/re-entering.
    if (!effectiveKuisId) {
      navigate('/siswa/kuis')
      return
    }
    if (!attemptId || !attemptToken) {
      navigate('/siswa/kuis')
      return
    }

    setSubmitLoading(true)
    try {
      await kuisAPI.submitAttempt(effectiveKuisId, attemptId, attemptToken, {
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])),
        waktu_selesai: new Date().toISOString(),
      })
    } catch {
      // Even if submit fails, we still let user exit; backend timer continues anyway.
    } finally {
      if (attemptStorageKey) localStorage.removeItem(attemptStorageKey)
      setSubmitLoading(false)
      navigate('/siswa/kuis')
    }
  }

  const focusActive = hasStarted && !submitted && focusMode

  // Lock page scroll while focus (fullscreen) mode is active.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const LOCK_ATTR = 'data-jk-kuis-scroll-lock'

    // If we're not in focus mode, ensure any previous lock from this page is released.
    if (!focusActive) {
      if (html.getAttribute(LOCK_ATTR) === '1') {
        const prevHtmlOverflow = html.getAttribute('data-jk-prev-html-overflow') ?? ''
        const prevBodyOverflow = body.getAttribute('data-jk-prev-body-overflow') ?? ''
        const prevBodyOverscroll = body.getAttribute('data-jk-prev-body-overscroll') ?? ''

        html.style.overflow = prevHtmlOverflow
        body.style.overflow = prevBodyOverflow
        body.style.overscrollBehavior = prevBodyOverscroll

        html.removeAttribute(LOCK_ATTR)
        html.removeAttribute('data-jk-prev-html-overflow')
        body.removeAttribute('data-jk-prev-body-overflow')
        body.removeAttribute('data-jk-prev-body-overscroll')
      }
      return
    }

    // Avoid double-lock; only lock once.
    if (html.getAttribute(LOCK_ATTR) === '1') return

    html.setAttribute(LOCK_ATTR, '1')
    html.setAttribute('data-jk-prev-html-overflow', html.style.overflow || '')
    body.setAttribute('data-jk-prev-body-overflow', body.style.overflow || '')
    body.setAttribute('data-jk-prev-body-overscroll', body.style.overscrollBehavior || '')

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    return () => {
      if (html.getAttribute(LOCK_ATTR) !== '1') return
      const prevHtmlOverflow = html.getAttribute('data-jk-prev-html-overflow') ?? ''
      const prevBodyOverflow = body.getAttribute('data-jk-prev-body-overflow') ?? ''
      const prevBodyOverscroll = body.getAttribute('data-jk-prev-body-overscroll') ?? ''

      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.overscrollBehavior = prevBodyOverscroll

      html.removeAttribute(LOCK_ATTR)
      html.removeAttribute('data-jk-prev-html-overflow')
      body.removeAttribute('data-jk-prev-body-overflow')
      body.removeAttribute('data-jk-prev-body-overscroll')
    }
  }, [focusActive])

  // Note: We intentionally avoid native browser fullscreen.

  async function notifyQuizSubmitted(result: SubmitResult | null | undefined) {
    try {
      const session = getSession()
      const email = session?.email ? String(session.email).trim() : ''
      if (!email) return

      const judul = quiz?.judul?.trim() || 'Kuis'
      const nilai = result?.nilai ?? result?.score
      const nilaiText = typeof nilai === 'number' && Number.isFinite(nilai) ? ` Nilai: ${Math.round(nilai)}.` : ''

      await tambahNotifikasi({
        judul: 'Kuis selesai',
        pesan: `Kuis "${judul}" sudah dikumpulkan.${nilaiText}`,
        tipe: 'kuis',
        targetSiswa: email,
      })
      window.dispatchEvent(new CustomEvent('notifikasi:changed'))
    } catch {
      // ignore: notification is best-effort
    }
  }

  useEffect(() => {
    if (submitted) setFocusMode(false)
  }, [submitted])


  useEffect(() => {
    if (!hasStarted || submitted) {
      setRemainingSeconds(null)
      setIsTimeUp(false)
      return
    }

    const endsMs = attemptEndsAt ? Date.parse(attemptEndsAt) : NaN
    const hasServerEnds = Number.isFinite(endsMs)

    const tick = () => {
      const remaining = hasServerEnds
        ? Math.floor((endsMs - Date.now()) / 1000)
        : Math.floor(durationMinutes * 60)
      setRemainingSeconds(remaining)
      if (remaining <= 0) setIsTimeUp(true)
    }

    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [hasStarted, submitted, attemptEndsAt, durationMinutes])

  useEffect(() => {
    if (!hasStarted || submitted) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome requires returnValue to be set.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasStarted, submitted])

  useEffect(() => {
    if (!isTimeUp || submitted || submitLoading) return
    // Auto-submit when time is up.
    ;(async () => {
      try {
        setError(null)
        if (!effectiveKuisId) return
        if (!attemptId || !attemptToken) {
          setError('Waktu habis, percobaan tidak valid. Silakan muat ulang lalu kirim.')
          return
        }

        setSubmitLoading(true)
        const submitRes = await kuisAPI.submitAttempt(effectiveKuisId, attemptId, attemptToken, {
          answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])),
          waktu_selesai: new Date().toISOString(),
        })
        const direct = normalizeSubmitResult((submitRes as any)?.data)
        if (direct) setSubmitResult(direct)
        persistLocalNilai(direct)
        if (attemptStorageKey) localStorage.removeItem(attemptStorageKey)
        setSubmitted(true)
        void notifyQuizSubmitted(direct)
        if (effectiveKuisId) {
          const finalScore = direct?.nilai ?? direct?.score ?? 0
          const newAchievements = gameState.completeSession(effectiveKuisId, finalScore, siswaId || undefined)
          if (newAchievements.length > 0) {
            setUnlockedAchievements(newAchievements)
            setShowAchievements(true)
          }
          gameAudio.playComplete()
        }
      } catch (e: any) {
        setError(e?.message || 'Gagal auto-submit saat waktu habis')
      } finally {
        setSubmitLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp])

  // Autosave every ~10s while attempt is running.
  useEffect(() => {
    if (!hasStarted || submitted || !effectiveKuisId || !attemptId || !attemptToken) return
    const interval = window.setInterval(async () => {
      if (autosaveInFlight.current) return
      const snapshot = JSON.stringify(answers)
      if (!snapshot || snapshot === lastSavedRef.current) return
      autosaveInFlight.current = true
      try {
        await kuisAPI.autosaveAnswers(effectiveKuisId, attemptId, attemptToken, {
          answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])),
        })
        lastSavedRef.current = snapshot
      } catch {
        // ignore autosave errors
      } finally {
        autosaveInFlight.current = false
      }
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [hasStarted, submitted, effectiveKuisId, attemptId, attemptToken, answers])

  if (!effectiveKuisId) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Kuis</div>
        <div className="mt-2 text-sm text-slate-600">ID kuis tidak ditemukan.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat kuis...</p>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Kuis tidak ditemukan</div>
        <div className="mt-2 text-sm text-slate-600">Kuis ini mungkin belum dibuat, atau sudah dihapus.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali ke daftar kuis
        </button>
      </div>
    )
  }

  if (!isActiveQuizStatus(quiz.status)) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">{quiz.judul}</div>
        <div className="mt-2 text-sm text-slate-600">Kuis ini belum aktif.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (hasStarted && total === 0) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">{quiz.judul}</div>
        <div className="mt-2 text-sm text-slate-600">Soal belum tersedia atau tidak bisa diakses.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (submitted) {
    const scoreValueRaw = submitResult?.nilai ?? submitResult?.score
    const correct = submitResult?.benar
    const totalSoal = submitResult?.total_soal ?? submitResult?.total
    const denom = (totalSoal != null ? totalSoal : total)
    const derived = correct != null && denom != null && denom > 0 ? round2((correct / denom) * 100) : null
    const scoreValue =
      typeof scoreValueRaw === 'number' && scoreValueRaw === 0 && derived != null && derived > 0
        ? derived
        : scoreValueRaw
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">KUIS TERKIRIM</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{quiz.judul}</div>
          <div className="mt-2 text-sm text-slate-600">Jawaban berhasil dikirim.</div>

          {scoreValue != null ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-100">
              <div className="font-semibold text-amber-900">Nilai: {scoreValue}</div>
              {correct != null && (totalSoal != null ? totalSoal : total) != null ? (
                <div className="mt-1 text-xs text-amber-900/70">
                  Benar: {correct}/{(totalSoal != null ? totalSoal : total) as number}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">Nilai bisa dilihat di halaman Nilai.</div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              onClick={() => navigate('/siswa/nilai')}
            >
              Lihat Nilai
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigate('/siswa/kuis')}
            >
              Kembali ke daftar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasStarted) {
    // Show character picker first
    if (showCharacterPicker) {
      return (
        <div className="space-y-6">
          <WayangPicker
            siswaId={siswaId || undefined}
            onSelect={(char) => {
              setSelectedCharacter(char)
            }}
            initialCharacter={selectedCharacter}
          />
          <div className="text-center">
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              onClick={() => {
                setShowCharacterPicker(false)
                // Start quiz immediately after character selection
                setTimeout(() => startOrResumeAttempt(), 100)
              }}
            >
              Mulai Kuis dengan {selectedCharacter.charAt(0).toUpperCase() + selectedCharacter.slice(1)}!
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">SIAPKAN DIRI</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{quiz.judul}</div>
          <div className="mt-2 text-sm text-slate-600">
            Setelah klik <span className="font-semibold">Mulai Kuis</span>, timer berjalan dari server dan soal baru bisa diakses.
          </div>
          <div className="mt-3 text-sm text-slate-600">
            Durasi: <span className="font-semibold">{durationMinutes} menit</span>
          </div>

          {error ? <div className="mt-3 text-sm font-semibold text-rose-600">{error}</div> : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              onClick={() => setShowCharacterPicker(true)}
            >
              Pilih Wayang & Mulai
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigate('/siswa/kuis')}
            >
              Kembali
            </button>
          </div>
          
          {/* Audio toggle */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                gameAudio.toggle()
                setSoundEnabled(gameAudio.isEnabled())
              }}
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name={soundEnabled ? 'volumeOn' : 'volumeOff'} className="h-4 w-4" />
                {soundEnabled ? 'Sound ON' : 'Sound OFF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Adventure mode: handle trap hit (reduce HP, check shield)
  const handleTrapHit = (damage: number) => {
    if (!effectiveKuisId || !gameSession) return
    
    if (shieldActive) {
      // Shield absorbs trap damage
      setShieldActive(false)
      return
    }
    
    // Apply character trap damage reduction
    const charBonuses = getCharacterBonuses(selectedCharacter)
    const actualDamage = Math.round(damage * (1 - charBonuses.trapDamageReduction))
    
    const newHp = Math.max(0, gameSession.hp - actualDamage)
    gameState.updateSession(effectiveKuisId, { hp: newHp })
    setGameSession(prev => prev ? { ...prev, hp: newHp } : null)
    
    // Check game over
    if (newHp <= 0) {
      setTimeout(() => setIsGameOver(true), 1000)
    }
  }

  // Adventure mode: handle finish (all checkpoints done, reached finish tile)
  const handleFinish = () => {
    // Exit focus fullscreen when player reaches finish.
    if (focusMode) {
      setFocusMode(false)
    }

    // Auto-scroll to submit button area
    window.setTimeout(() => {
      const footer = document.querySelector('.submit-footer')
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }

  // Handle coin collected on map
  const handleCoinCollected = (value: number) => {
    if (!effectiveKuisId || !gameSession) return
    setCoinsCollected(prev => prev + 1)
    const newScore = gameSession.score + value
    gameState.updateSession(effectiveKuisId, { score: newScore })
    setGameSession(prev => prev ? { ...prev, score: newScore } : null)
    gameAudio.playClick()
  }
  
  // Handle power-up usage
  const handleUsePowerUp = (type: import('../../lib/gameState').PowerUpType) => {
    if (!effectiveKuisId || !gameSession) return
    
    const used = gameState.usePowerUp(effectiveKuisId, type)
    if (!used) return
    
    // Update local state
    setGameSession(prev => {
      if (!prev) return null
      return {
        ...prev,
        powerUps: {
          ...prev.powerUps,
          [type]: prev.powerUps[type] - 1,
        },
      }
    })
    
    switch (type) {
      case 'shield':
        setShieldActive(true)
        break
      case 'hint':
        // Handled in modal - will eliminate 2 wrong options
        break
      case 'skip':
        // Skip current question
        if (showQuestionModal) {
          const question = questions[modalQuestionIndex]
          if (question) {
            // Mark as skipped (use 'A' as placeholder - won't count for score)
            setAnswers(prev => ({ ...prev, [question.id]: 'A' as ChoiceKey }))
          }
          const nextProgress = checkpointProgress + 1
          if (nextProgress < checkpointQuestions.length) {
            setCheckpointProgress(nextProgress)
            const nextQuestionIdx = checkpointQuestions[nextProgress]
            setModalQuestionIndex(nextQuestionIdx)
            setCurrentQuestionIndex(nextQuestionIdx)
          } else {
            setShowQuestionModal(false)
            setCurrentQuestionIndex(prev => prev + 1)
          }
        }
        break
    }
  }

  // Adventure mode: handle checkpoint reached
  const handleCheckpointReached = (checkpointIndex: number, questionIndices: number[]) => {
    // Filter out already answered questions
    const unansweredQuestions = questionIndices.filter(idx => !answers[questions[idx]?.id])
    
    if (unansweredQuestions.length === 0) {
      // All questions in this checkpoint already answered
      return
    }
    
    // Set up checkpoint state
    setCurrentCheckpointIndex(checkpointIndex)
    setCheckpointQuestions(unansweredQuestions)
    setCheckpointProgress(0)
    setModalQuestionIndex(unansweredQuestions[0])
    setShowQuestionModal(true)
    setCurrentQuestionIndex(unansweredQuestions[0])
  }

  const handleAnswerQuestion = async (answer: ChoiceKey) => {
    const question = questions[modalQuestionIndex]
    if (!question || feedbackState) return // Prevent double-clicks while showing feedback
    
    // Check correctness - try local answer key first
    let correctAnswer = question.answer
    let isCorrect: boolean
    
    if (correctAnswer) {
      // We have the answer key locally
      isCorrect = answer === correctAnswer
    } else if (effectiveKuisId && attemptId && attemptToken) {
      // No local answer key — try server-side check
      try {
        const checkRes = await kuisAPI.checkAnswer(effectiveKuisId, attemptId, attemptToken, question.id, answer)
        const checkData = (checkRes as any)?.data ?? checkRes
        isCorrect = !!checkData?.benar
        if (checkData?.jawaban_benar) {
          correctAnswer = checkData.jawaban_benar as ChoiceKey
        }
      } catch {
        // Server check not available — assume correct (graceful degradation)
        isCorrect = true
        correctAnswer = undefined
      }
    } else {
      // No way to verify — assume correct
      isCorrect = true
    }
    
    // Show feedback
    setFeedbackState({
      isCorrect,
      correctAnswer: correctAnswer || null,
      selectedAnswer: answer,
    })
    
    // Save answer
    setAnswers(prev => ({ ...prev, [question.id]: answer }))
    
    if (effectiveKuisId && gameSession) {
      if (isCorrect) {
        // Correct answer: +score, +streak, +heal
        const result = gameState.handleCorrectAnswer(effectiveKuisId)
        const bonus = result.bonus
        const scoreGained = 10 + bonus
        
        setTentativeScore(prev => prev + scoreGained)
        setShowScoreAnimation(true)
        setTimeout(() => setShowScoreAnimation(false), 1000)
        
        setGameSession(prev => prev ? {
          ...prev,
          score: prev.score + scoreGained,
          streak: result.streak,
          maxStreak: Math.max(prev.maxStreak, result.streak),
          hp: result.hp,
          correctAnswers: prev.correctAnswers + 1,
        } : null)
        
        gameAudio.playCorrect()
        if (result.streak >= 3) {
          setTimeout(() => gameAudio.playStreak(result.streak), 200)
        }
      } else {
        // Wrong answer: -HP, reset streak
        const hasShield = shieldActive
        const result = gameState.handleWrongAnswer(effectiveKuisId, hasShield)
        
        if (hasShield) {
          setShieldActive(false) // Shield consumed
        }
        
        setGameSession(prev => prev ? {
          ...prev,
          hp: result.hp,
          streak: 0,
          wrongAnswers: prev.wrongAnswers + 1,
        } : null)
        
        gameAudio.playWrong()
        if (!hasShield) {
          setTimeout(() => gameAudio.playDamage(), 200)
        }
        
        // Check game over
        if (result.hp <= 0) {
          setTimeout(() => setIsGameOver(true), 1500)
        }
      }
    }
    
    // Move to next question after delay (longer for feedback)
    setTimeout(() => {
      setFeedbackState(null) // Clear feedback
      const nextProgress = checkpointProgress + 1
      
      if (nextProgress < checkpointQuestions.length) {
        // More questions in this checkpoint
        setCheckpointProgress(nextProgress)
        const nextQuestionIdx = checkpointQuestions[nextProgress]
        setModalQuestionIndex(nextQuestionIdx)
        setCurrentQuestionIndex(nextQuestionIdx)
      } else {
        // All questions in this checkpoint answered
        setShowQuestionModal(false)
        setCurrentQuestionIndex(prev => prev + 1)
      }
    }, 1500) // 1.5s delay to show feedback
  }

  return (
    <div
      ref={focusRootRef}
      className={
        focusActive
          ? 'jk-focus fixed inset-0 z-[200] flex h-[100dvh] flex-col gap-1.5 overflow-hidden bg-amber-50 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:p-2 sm:pb-[calc(0.5rem+env(safe-area-inset-bottom))]'
          : 'space-y-6'
      }
    >
      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="question-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="question-modal max-h-[85vh] overflow-y-auto" style={{ maxWidth: 500 }}>
            <div className="text-center mb-3">
              <div className="mb-2 inline-flex items-center justify-center text-amber-700">
                <Icon name="gamepad" size="lg" />
              </div>
              <div className="text-xl font-extrabold text-amber-800">Cara Bermain</div>
            </div>
            <div className="space-y-2 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200">
                  <Icon name="map" className="h-4 w-4" />
                </span>
                <span><b>Navigasi</b> — Gerakkan karakter di peta menggunakan D-pad atau swipe. Kunjungi pos (checkpoint) untuk menjawab soal.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-200">
                  <Icon name="check" className="h-4 w-4" />
                </span>
                <span><b>Jawab Benar</b> — Dapat poin, HP pulih sedikit, dan streak naik. Streak 3x/5x/10x = bonus poin!</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-rose-700 ring-1 ring-rose-200">
                  <Icon name="x" className="h-4 w-4" />
                </span>
                <span><b>Jawab Salah</b> — HP berkurang 10, streak reset ke 0. HP habis = Game Over!</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                  <Icon name="skull" className="h-4 w-4" />
                </span>
                <span><b>Jebakan</b> — Tersembunyi di peta. Mengurangi HP saat terinjak.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200">
                  <Icon name="coin" className="h-4 w-4" />
                </span>
                <span><b>Koin</b> — Kumpulkan di peta untuk bonus +5 poin.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-indigo-700 ring-1 ring-indigo-200">
                  <Icon name="sparkle" className="h-4 w-4" />
                </span>
                <span><b>Power-ups</b> — Hint (hilangkan 2 opsi salah), Shield (lindungi 1x serangan), Skip (lewati soal).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200">
                  <Icon name="trophy" className="h-4 w-4" />
                </span>
                <span><b>Finish</b> — Selesaikan semua pos lalu menuju finish untuk submit jawaban.</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowTutorial(false)}
                className="rounded-xl bg-amber-500 px-6 py-2 text-sm font-bold text-white shadow hover:bg-amber-600 transition"
              >
                <span className="inline-flex items-center gap-2">
                  Mengerti, Mulai!
                  <Icon name="rocket" className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Game Over Overlay */}
      {isGameOver && (
        <div className="question-modal-overlay" style={{ zIndex: 9999 }}>
          <div
            className="question-modal max-h-[85vh] overflow-y-auto"
            style={{ background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', borderColor: '#EF4444' }}
          >
            <div className="text-center">
              <div className="mb-2 inline-flex items-center justify-center text-red-700">
                <Icon name="skull" size="lg" />
              </div>
              <div className="text-2xl font-extrabold text-red-800">Game Over!</div>
              <div className="mt-2 text-sm text-red-600">HP kamu habis. Petualangan berakhir di sini.</div>
              
              {gameSession && (
                <div className="mt-4 rounded-xl bg-white/60 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="chart" className="h-4 w-4" />
                        Skor: <b className="text-amber-700">{gameSession.score}</b>
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="fire" className="h-4 w-4" />
                        Streak Terbaik: <b className="text-orange-600">{gameSession.maxStreak}x</b>
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="check" className="h-4 w-4" />
                        Benar: <b className="text-green-600">{gameSession.correctAnswers}</b>
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="x" className="h-4 w-4" />
                        Salah: <b className="text-red-600">{gameSession.wrongAnswers}</b>
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="coin" className="h-4 w-4" />
                        Koin: <b className="text-yellow-600">{coinsCollected}</b>
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2">
                        <Icon name="note" className="h-4 w-4" />
                        Dijawab: <b>{Object.keys(answers).length}/{questions.length}</b>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                {Object.keys(answers).length > 0 && (
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={async () => {
                      if (!effectiveKuisId || !attemptId || !attemptToken) return
                      setSubmitLoading(true)
                      try {
                        const submitRes = await kuisAPI.submitAttempt(effectiveKuisId, attemptId, attemptToken, {
                          answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])),
                          waktu_selesai: new Date().toISOString(),
                        })
                        const direct = normalizeSubmitResult((submitRes as any)?.data)
                        if (direct) setSubmitResult(direct)
                        persistLocalNilai(direct)
                        if (attemptStorageKey) localStorage.removeItem(attemptStorageKey)
                        setSubmitted(true)
                        void notifyQuizSubmitted(direct)
                        setIsGameOver(false)
                        if (effectiveKuisId) {
                          const finalScore = direct?.nilai ?? direct?.score ?? 0
                          gameState.completeSession(effectiveKuisId, finalScore, siswaId || undefined)
                          gameAudio.playComplete()
                        }
                      } catch (e: any) {
                        setError(e?.message || 'Gagal mengirim jawaban')
                      } finally {
                        setSubmitLoading(false)
                      }
                    }}
                    className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-50"
                  >
                    {submitLoading ? (
                      'Mengirim...'
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Icon name="send" className="h-4 w-4" />
                        Submit Jawaban yang Ada
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/siswa/kuis')}
                  className="rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Popup */}
      {showAchievements && unlockedAchievements.length > 0 && (
        <AchievementPopup
          achievements={unlockedAchievements}
          onClose={() => setShowAchievements(false)}
        />
      )}
      
      {/* Game Container: HUD + Map dalam satu panel */}
      <div
        className={
          focusActive
            ? 'game-container flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 p-1.5 shadow-lg ring-1 ring-amber-300 sm:p-2'
            : 'game-container rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 p-2 sm:p-3 md:p-6 shadow-lg ring-1 ring-amber-300'
        }
      >
        {/* Sound Toggle + Tutorial di pojok kanan atas */}
        <div className={focusActive ? 'flex justify-end gap-1 mb-1' : 'flex justify-end gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 md:mb-4'}>
          <button
            type="button"
            onClick={async () => {
              const next = !focusMode
              setFocusMode(next)
            }}
            className={
              focusActive
                ? 'min-h-9 min-w-9 text-sm px-2 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm flex items-center justify-center'
                : 'text-base sm:text-lg md:text-xl px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm'
            }
            title={focusActive ? 'Keluar fullscreen' : 'Masuk fullscreen'}
            aria-label={focusActive ? 'Keluar fullscreen' : 'Masuk fullscreen'}
          >
            <Icon name={focusActive ? 'minimize' : 'maximize'} className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className={
              focusActive
                ? 'min-h-9 min-w-9 text-sm px-2 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm flex items-center justify-center'
                : 'text-base sm:text-lg md:text-xl px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm'
            }
            title="Cara bermain"
          >
            <Icon name="help" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              gameAudio.toggle()
              setSoundEnabled(gameAudio.isEnabled())
            }}
            className={
              focusActive
                ? 'min-h-9 min-w-9 text-sm px-2 py-1 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm flex items-center justify-center'
                : 'text-base sm:text-lg md:text-xl px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg bg-white/50 hover:bg-white/80 transition shadow-sm'
            }
            title="Toggle sound"
          >
            <Icon name={soundEnabled ? 'volumeOn' : 'volumeOff'} className="h-5 w-5" />
          </button>
        </div>

        {/* Game HUD */}
        {gameSession && (
          <div className={focusActive ? 'mb-1.5' : 'mb-1.5 sm:mb-2 md:mb-4'}>
            <GameHUD
              character={selectedCharacter}
              hp={gameSession.hp}
              maxHp={gameSession.maxHp}
              streak={gameSession.streak}
              score={gameSession.score}
              powerUps={gameSession.powerUps}
              currentQuestion={currentQuestionIndex + 1}
              totalQuestions={total}
              timeRemaining={remainingSeconds != null ? formatClock(remainingSeconds) : undefined}
              showPowerUps={true}
              onUsePowerUp={handleUsePowerUp}
            />
            {shieldActive && (
              <div className="mt-1 text-center text-xs font-bold text-blue-600 animate-pulse">
                <span className="inline-flex items-center gap-2">
                  <Icon name="shield" className="h-4 w-4" />
                  Shield Aktif — Melindungi dari 1x serangan
                </span>
              </div>
            )}
          </div>
        )}

        {/* GameBoard */}
        <div className={focusActive ? 'min-h-0 flex-1' : undefined}>
          <GameBoard
            character={selectedCharacter}
            totalQuestions={questions.length}
            onReachCheckpoint={handleCheckpointReached}
            onTrapHit={handleTrapHit}
            onFinish={handleFinish}
            onCoinCollected={handleCoinCollected}
            answeredQuestions={new Set(
              questions
                .map((q, idx) => answers[q.id] ? idx : -1)
                .filter(idx => idx !== -1)
            )}
            allCheckpointsCompleted={Object.keys(answers).length === questions.length}
            fullscreen={focusActive}
          />
        </div>
      </div>

      {/* Question Modal */}
      <>
        {showQuestionModal && questions[modalQuestionIndex] && (() => {
            const q = questions[modalQuestionIndex]
          const checkpointNames = ['Gerbang', 'Hutan', 'Pendopo', 'Keraton']
          const checkpointName = checkpointNames[currentCheckpointIndex] || 'Pos'
            
            return (
              <div className="question-modal-overlay">
                <div
                  className={`question-modal max-h-[85vh] overflow-y-auto ${feedbackState ? (feedbackState.isCorrect ? 'modal-correct' : 'modal-wrong') : ''}`}
                >
                  <div className="modal-header">
                    <div className="modal-checkpoint-info">
                      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        {checkpointName}
                      </div>
                      <div className="text-sm font-bold text-amber-600">
                        <span className="inline-flex items-center gap-2">
                          <Icon name="document" className="h-4 w-4" />
                          Soal {checkpointProgress + 1} dari {checkpointQuestions.length}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Total: {modalQuestionIndex + 1} dari {questions.length}
                      </div>
                    </div>
                    {showScoreAnimation && feedbackState?.isCorrect && (
                      <div className="score-pop text-xl font-bold text-emerald-500">
                        +{10 + (gameSession?.streak && gameSession.streak >= 10 ? 15 : gameSession?.streak && gameSession.streak >= 5 ? 10 : gameSession?.streak && gameSession.streak >= 3 ? 5 : 0)}
                      </div>
                    )}
                    {feedbackState && !feedbackState.isCorrect && (
                      <div className="score-pop text-xl font-bold text-red-500">
                        -10 HP
                      </div>
                    )}
                  </div>
                  
                  {/* Feedback banner */}
                  {feedbackState && (
                    <div className={`feedback-banner ${feedbackState.isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
                      {feedbackState.isCorrect ? (
                        <span className="inline-flex items-center gap-2">
                          <Icon name="check" className="h-4 w-4" />
                          Benar!
                          {gameSession && gameSession.streak >= 3 ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="fire" className="h-4 w-4" />
                              Streak {gameSession.streak}x!
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Icon name="x" className="h-4 w-4" />
                          Salah! Coba lagi di soal berikutnya.
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="modal-question">
                    {q.text}
                  </div>

                  {q.image && (
                    <div className="modal-image">
                      <img src={q.image} alt={`Soal ${modalQuestionIndex + 1}`} />
                    </div>
                  )}

                  <div className="modal-choices">
                    {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => {
                      // Determine hint: hide 2 wrong options if hint power-up used
                      const isHintHidden = gameSession && gameSession.powerUps.hint < (gameState.getSession(effectiveKuisId)?.powerUps.hint ?? 0) && q.answer && key !== q.answer && ['D', 'E'].includes(key)
                      
                      // Feedback styling
                      let feedbackClass = ''
                      if (feedbackState) {
                        if (key === feedbackState.selectedAnswer && feedbackState.isCorrect) {
                          feedbackClass = 'choice-correct' // Green - user selected correct
                        } else if (key === feedbackState.selectedAnswer && !feedbackState.isCorrect) {
                          feedbackClass = 'choice-wrong' // Red - user selected wrong
                        } else {
                          feedbackClass = 'choice-disabled' // Dim others
                        }
                      }
                      
                      if (isHintHidden && !feedbackState) return null
                      
                      return (
                        <button
                          key={key}
                          onClick={() => !feedbackState && handleAnswerQuestion(key)}
                          disabled={!!feedbackState}
                          className={`choice-btn ${feedbackClass} ${!feedbackState && answers[q.id] === key ? 'selected' : ''}`}
                        >
                          <div className="choice-label">{key}</div>
                          <div className="choice-text">{q.options[key]}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </>

      {/* Footer with submit button */}
      <div
        className={
          focusActive
            ? 'submit-footer shrink-0 rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:p-3'
            : 'submit-footer rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-200'
        }
      >
        <div className={focusActive ? 'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2' : 'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'}>
          <div className={focusActive ? 'text-[11px] sm:text-xs text-slate-600' : 'text-xs sm:text-sm text-slate-600'}>
            Dijawab: <span className="font-bold text-amber-600">{Object.keys(answers).length}/{questions.length}</span>
          </div>
          <div className={focusActive ? 'flex gap-1.5 w-full sm:w-auto' : 'flex gap-2 w-full sm:w-auto'}>
            {Object.keys(answers).length === questions.length && (
              <button
                type="button"
                disabled={submitLoading}
                className={
                  focusActive
                    ? 'rounded-xl bg-amber-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 w-full sm:w-auto'
                    : 'rounded-xl bg-amber-500 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 w-full sm:w-auto'
                }
                onClick={async () => {
                  if (!effectiveKuisId) return
                  setSubmitLoading(true)
                  try {
                    if (!attemptId || !attemptToken) {
                      setError('Percobaan tidak valid. Silakan muat ulang dan klik Mulai lagi.')
                      return
                    }

                    const submitRes = await kuisAPI.submitAttempt(effectiveKuisId, attemptId, attemptToken, {
                      answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])),
                      waktu_selesai: new Date().toISOString(),
                    })

                    const direct = normalizeSubmitResult((submitRes as any)?.data)
                    if (direct) {
                      setSubmitResult(direct)
                    }

                    persistLocalNilai(direct)

                    if (attemptStorageKey) localStorage.removeItem(attemptStorageKey)
                    setSubmitted(true)
                    void notifyQuizSubmitted(direct)
                    
                    if (effectiveKuisId) {
                      const finalScore = direct?.nilai ?? direct?.score ?? 0
                      const newAchievements = gameState.completeSession(effectiveKuisId, finalScore, siswaId || undefined)
                      if (newAchievements.length > 0) {
                        setUnlockedAchievements(newAchievements)
                        setShowAchievements(true)
                      }
                      gameAudio.playComplete()
                    }
                  } catch (e: any) {
                    setError(e?.message || 'Gagal mengirim jawaban')
                  } finally {
                    setSubmitLoading(false)
                  }
                }}
              >
                {submitLoading ? (
                  'Mengirim...'
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Icon name="check" />
                    Submit Semua Jawaban
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              className={
                focusActive
                  ? 'rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 w-full sm:w-auto'
                  : 'rounded-xl border border-slate-200 bg-white px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 w-full sm:w-auto'
              }
              onClick={() => {
                if (!hasStarted || submitted) {
                  navigate('/siswa/kuis')
                  return
                }
                const ok = confirm(
                  'Kuis sedang berjalan. Jika keluar, kuis akan dianggap selesai dan tidak bisa dikerjakan lagi. Yakin mau keluar?'
                )
                if (ok) void forfeitAndExit()
              }}
            >
              Batal / Keluar
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .game-container {
          position: relative;
        }

        /* Fullscreen focus: make HUD more compact so the board fits */
        .jk-focus .game-hud {
          padding: 0.35rem;
          border-radius: 0.75rem;
        }

        .jk-focus .hud-top {
          gap: 0.4rem;
          margin-bottom: 0.25rem;
        }

        .jk-focus .character-avatar {
          font-size: 1.35rem !important;
        }

        .jk-focus .character-name {
          font-size: 0.8rem;
        }

        .jk-focus .hp-bar-bg {
          height: 14px;
        }

        .jk-focus .stats-info {
          gap: 0.25rem;
        }

        .jk-focus .stat-badge {
          padding: 0.2rem 0.4rem;
          font-size: 0.7rem;
          border-radius: 0.35rem;
        }

        .jk-focus .progress-section {
          margin-bottom: 0.35rem;
        }

        .jk-focus .progress-text {
          display: none;
        }

        .jk-focus .progress-landmarks {
          display: none;
        }

        .jk-focus .progress-bar-bg {
          height: 12px;
          border-width: 1px;
        }

        .jk-focus .powerups-section {
          margin-top: 0.25rem;
        }

        .jk-focus .powerups-title {
          display: none;
        }

        .jk-focus .powerups-grid {
          gap: 0.25rem;
          flex-wrap: nowrap;
        }

        .jk-focus .powerup-btn {
          padding: 0.25rem;
          border-radius: 0.6rem;
          min-width: 44px;
        }

        .jk-focus .powerup-icon {
          font-size: 1rem;
        }

        .jk-focus .powerup-count {
          font-size: 0.7rem;
        }

        @media (max-width: 640px) {
          .game-container {
            border-radius: 0.75rem !important;
            padding: 0.375rem !important;
          }
        }

        @media (max-width: 380px) {
          .game-container {
            border-radius: 0.5rem !important;
            padding: 0.25rem !important;
          }
        }

        @keyframes score-pop {
          0% {
            transform: scale(0) translateY(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.5) translateY(-10px);
            opacity: 1;
          }
          100% {
            transform: scale(1) translateY(-20px);
            opacity: 0;
          }
        }
        
        .score-pop {
          animation: score-pop 1s ease-out;
        }

        /* Question Modal Styles */
        .question-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          backdrop-filter: blur(4px);
          animation: fade-in 0.3s ease;
        }

        .question-modal {
          background: linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%);
          border: 4px solid #F59E0B;
          border-radius: 1.5rem;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: modal-pop-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes modal-pop-in {
          from {
            transform: scale(0.5) translateY(-50px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .modal-checkpoint-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .modal-question {
          font-size: 1.25rem;
          font-weight: bold;
          color: #78350F;
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .modal-image {
          margin-bottom: 1rem;
        }

        .modal-image img {
          max-width: 100%;
          max-height: 300px;
          border-radius: 0.75rem;
          border: 2px solid #F59E0B;
        }

        .modal-choices {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .choice-btn {
          display: flex;
          align-items: start;
          gap: 1rem;
          padding: 1rem;
          background: white;
          border: 3px solid transparent;
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .choice-btn:hover {
          transform: translateX(8px);
          border-color: #F59E0B;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .choice-btn.selected {
          border-color: #10B981;
          background: #D1FAE5;
        }

        /* Feedback states */
        .choice-btn.choice-correct {
          border-color: #10B981 !important;
          background: #D1FAE5 !important;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
          animation: pulse-green 0.6s ease-in-out;
        }

        .choice-btn.choice-wrong {
          border-color: #EF4444 !important;
          background: #FEE2E2 !important;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
          animation: shake-choice 0.5s ease-in-out;
        }

        .choice-btn.choice-disabled {
          opacity: 0.4;
          pointer-events: none;
        }

        .choice-btn:disabled {
          cursor: not-allowed;
        }

        .modal-correct {
          border-color: #10B981 !important;
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.3) !important;
        }

        .modal-wrong {
          border-color: #EF4444 !important;
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.3) !important;
        }

        /* Feedback banner */
        .feedback-banner {
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          margin-bottom: 0.75rem;
          text-align: center;
          font-weight: bold;
          font-size: 0.9rem;
          animation: slide-down 0.3s ease;
        }

        .feedback-correct {
          background: #D1FAE5;
          color: #065F46;
          border: 2px solid #10B981;
        }

        .feedback-wrong {
          background: #FEE2E2;
          color: #991B1B;
          border: 2px solid #EF4444;
        }

        @keyframes pulse-green {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        @keyframes shake-choice {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }

        @keyframes slide-down {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .choice-label {
          font-size: 1.25rem;
          font-weight: bold;
          color: #F59E0B;
          min-width: 2rem;
        }

        .choice-text {
          flex: 1;
          color: #374151;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .question-modal {
            padding: 0.75rem;
            border-width: 2px;
            border-radius: 0.875rem;
            width: 96%;
            max-height: 85vh;
          }

          .modal-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
            margin-bottom: 0.5rem;
          }

          .modal-header > div {
            font-size: 0.7rem;
          }

          .modal-checkpoint-info {
            gap: 0.125rem;
          }

          .modal-question {
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
            line-height: 1.5;
          }

          .modal-image {
            margin-bottom: 0.5rem;
          }

          .modal-image img {
            max-height: 150px;
            border-width: 1px;
          }

          .modal-choices {
            gap: 0.375rem;
          }

          .choice-btn {
            padding: 0.5rem;
            gap: 0.5rem;
            border-width: 2px;
            border-radius: 0.625rem;
          }

          .choice-btn:hover {
            transform: translateX(3px);
          }

          .choice-label {
            font-size: 0.875rem;
            min-width: 1.5rem;
          }

          .choice-text {
            font-size: 0.75rem;
            line-height: 1.35;
          }
        }

        @media (max-width: 380px) {
          .question-modal {
            padding: 0.5rem;
            width: 98%;
            max-height: 88vh;
          }

          .modal-question {
            font-size: 0.8rem;
            line-height: 1.4;
          }

          .choice-btn {
            padding: 0.375rem;
            gap: 0.375rem;
          }

          .choice-label {
            font-size: 0.8rem;
            min-width: 1.25rem;
          }

          .choice-text {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  )
}
