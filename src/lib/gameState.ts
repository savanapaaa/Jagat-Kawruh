/**
 * Game State Manager
 * Manages HP, streak, achievements, power-ups with localStorage
 */

import type { IconName } from '../components/ui/Icon'

export type WayangCharacter = 'arjuna' | 'bima' | 'gatotkaca' | 'srikandi' | 'semar'

export type PowerUpType = 'hint' | 'shield' | 'skip'

export type AchievementId = 
  | 'satria_wijaya'      // Perfect score (100)
  | 'pangeran_geledek'   // Complete < 5 minutes
  | 'ksatria_tangguh'    // Complete 10 quizzes
  | 'begawan_cendekia'   // Total score > 900 (10 quizzes)
  | 'raja_panah'         // Streak 10x
  | 'first_blood'        // First quiz completed
  | 'speed_demon'        // Complete < 3 minutes
  | 'combo_master'       // Streak 5x

export interface Achievement {
  id: AchievementId
  name: string
  description: string
  icon: IconName
  unlocked: boolean
  unlockedAt?: string
}

export interface WayangData {
  id: WayangCharacter
  name: string
  icon: IconName
  color: string
  description: string
}

export interface GameSession {
  hp: number
  maxHp: number
  streak: number
  maxStreak: number
  score: number
  powerUps: Record<PowerUpType, number>
  startTime: number
  correctAnswers: number
  wrongAnswers: number
}

export interface GameProfile {
  siswaId: string | null
  selectedCharacter: WayangCharacter
  totalQuizzes: number
  totalPoints: number
  highestStreak: number
  achievements: AchievementId[]
  stats: {
    totalCorrect: number
    totalWrong: number
    avgScore: number
    fastestTime: number
  }
}

export const WAYANG_CHARACTERS: Record<WayangCharacter, WayangData> = {
  arjuna: {
    id: 'arjuna',
    name: 'Arjuna',
    icon: 'bow',
    color: '#3B82F6',
    description: 'Ksatria bijaksana dengan panah sakti'
  },
  bima: {
    id: 'bima',
    name: 'Bima',
    icon: 'fist',
    color: '#EF4444',
    description: 'Ksatria kuat dengan kuku Pancanaka'
  },
  gatotkaca: {
    id: 'gatotkaca',
    name: 'Gatotkaca',
    icon: 'plane',
    color: '#10B981',
    description: 'Ksatria terbang dengan otot kawat tulang besi'
  },
  srikandi: {
    id: 'srikandi',
    name: 'Srikandi',
    icon: 'target',
    color: '#A855F7',
    description: 'Ksatria putri dengan panah menakjubkan'
  },
  semar: {
    id: 'semar',
    name: 'Semar',
    icon: 'smile',
    color: '#F59E0B',
    description: 'Punakawan bijak pembawa keberuntungan'
  }
}

export const ACHIEVEMENTS: Record<AchievementId, Omit<Achievement, 'unlocked' | 'unlockedAt'>> = {
  first_blood: {
    id: 'first_blood',
    name: 'Pertempuran Pertama',
    description: 'Selesaikan kuis pertama',
    icon: 'sword'
  },
  satria_wijaya: {
    id: 'satria_wijaya',
    name: 'Satria Wijaya',
    description: 'Dapatkan nilai sempurna (100)',
    icon: 'trophy'
  },
  pangeran_geledek: {
    id: 'pangeran_geledek',
    name: 'Pangeran Geledek',
    description: 'Selesaikan kuis < 5 menit',
    icon: 'bolt'
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Kilat Jawa',
    description: 'Selesaikan kuis < 3 menit',
    icon: 'wind'
  },
  combo_master: {
    id: 'combo_master',
    name: 'Pamungkas',
    description: 'Raih streak 5x beruntun',
    icon: 'fire'
  },
  raja_panah: {
    id: 'raja_panah',
    name: 'Raja Panah',
    description: 'Raih streak 10x beruntun',
    icon: 'target'
  },
  ksatria_tangguh: {
    id: 'ksatria_tangguh',
    name: 'Ksatria Tangguh',
    description: 'Selesaikan 10 kuis',
    icon: 'shield'
  },
  begawan_cendekia: {
    id: 'begawan_cendekia',
    name: 'Begawan Cendekia',
    description: 'Kumpulkan 900+ poin total',
    icon: 'book'
  }
}

class GameStateManager {
  private readonly PROFILE_KEY = 'jk_game_profile'
  private readonly SESSION_KEY_PREFIX = 'jk_game_session'

  /**
   * Get or create game profile
   */
  getProfile(siswaId?: string): GameProfile {
    const stored = localStorage.getItem(this.PROFILE_KEY)
    
    if (stored) {
      try {
        const profile = JSON.parse(stored) as GameProfile
        if (siswaId && profile.siswaId !== siswaId) {
          // Different user, reset profile
          return this.createProfile(siswaId)
        }
        return profile
      } catch {
        // Corrupted data, create new
      }
    }

    return this.createProfile(siswaId)
  }

  /**
   * Create new profile
   */
  private createProfile(siswaId?: string): GameProfile {
    const profile: GameProfile = {
      siswaId: siswaId || null,
      selectedCharacter: 'arjuna',
      totalQuizzes: 0,
      totalPoints: 0,
      highestStreak: 0,
      achievements: [],
      stats: {
        totalCorrect: 0,
        totalWrong: 0,
        avgScore: 0,
        fastestTime: Infinity
      }
    }
    this.saveProfile(profile)
    return profile
  }

  /**
   * Save profile to localStorage
   */
  saveProfile(profile: GameProfile) {
    localStorage.setItem(this.PROFILE_KEY, JSON.stringify(profile))
  }

  /**
   * Select wayang character
   */
  selectCharacter(character: WayangCharacter, siswaId?: string) {
    const profile = this.getProfile(siswaId)
    profile.selectedCharacter = character
    this.saveProfile(profile)
  }

  /**
   * Start new game session
   */
  startSession(kuisId: string): GameSession {
    const session: GameSession = {
      hp: 100,
      maxHp: 100,
      streak: 0,
      maxStreak: 0,
      score: 0,
      powerUps: {
        hint: 1,
        shield: 1,
        skip: 0
      },
      startTime: Date.now(),
      correctAnswers: 0,
      wrongAnswers: 0
    }

    localStorage.setItem(`${this.SESSION_KEY_PREFIX}:${kuisId}`, JSON.stringify(session))
    return session
  }

  /**
   * Get current session
   */
  getSession(kuisId: string): GameSession | null {
    const stored = localStorage.getItem(`${this.SESSION_KEY_PREFIX}:${kuisId}`)
    if (!stored) return null

    try {
      return JSON.parse(stored) as GameSession
    } catch {
      return null
    }
  }

  /**
   * Update session
   */
  updateSession(kuisId: string, updates: Partial<GameSession>) {
    const session = this.getSession(kuisId)
    if (!session) return

    const updated = { ...session, ...updates }
    localStorage.setItem(`${this.SESSION_KEY_PREFIX}:${kuisId}`, JSON.stringify(updated))
  }

  /**
   * Handle correct answer
   */
  handleCorrectAnswer(kuisId: string): { hp: number; streak: number; bonus: number } {
    const session = this.getSession(kuisId)
    if (!session) return { hp: 100, streak: 0, bonus: 0 }

    // Increment streak
    session.streak += 1
    session.maxStreak = Math.max(session.maxStreak, session.streak)
    session.correctAnswers += 1

    // Heal HP
    session.hp = Math.min(session.maxHp, session.hp + 5)

    // Calculate bonus points from streak
    let bonus = 0
    if (session.streak >= 10) {
      bonus = 15 // 10x streak = 3x points
    } else if (session.streak >= 5) {
      bonus = 10 // 5x streak = 2x points
    } else if (session.streak >= 3) {
      bonus = 5 // 3x streak = 1.5x points
    }

    session.score += (10 + bonus)

    this.updateSession(kuisId, session)
    return { hp: session.hp, streak: session.streak, bonus }
  }

  /**
   * Handle wrong answer
   */
  handleWrongAnswer(kuisId: string, hasShield: boolean): { hp: number; streak: number } {
    const session = this.getSession(kuisId)
    if (!session) return { hp: 100, streak: 0 }

    // Break streak
    session.streak = 0
    session.wrongAnswers += 1

    // Damage HP (unless shielded)
    if (!hasShield) {
      session.hp = Math.max(0, session.hp - 10)
    }

    this.updateSession(kuisId, session)
    return { hp: session.hp, streak: session.streak }
  }

  /**
   * Use power-up
   */
  usePowerUp(kuisId: string, type: PowerUpType): boolean {
    const session = this.getSession(kuisId)
    if (!session || session.powerUps[type] <= 0) return false

    session.powerUps[type] -= 1
    this.updateSession(kuisId, session)
    return true
  }

  /**
   * Complete session and update profile
   */
  completeSession(kuisId: string, finalScore: number, siswaId?: string): Achievement[] {
    const session = this.getSession(kuisId)
    if (!session) return []

    const profile = this.getProfile(siswaId)
    const duration = (Date.now() - session.startTime) / 1000 / 60 // minutes

    // Update stats
    profile.totalQuizzes += 1
    profile.totalPoints += finalScore
    profile.highestStreak = Math.max(profile.highestStreak, session.maxStreak)
    profile.stats.totalCorrect += session.correctAnswers
    profile.stats.totalWrong += session.wrongAnswers
    profile.stats.avgScore = profile.totalPoints / profile.totalQuizzes
    profile.stats.fastestTime = Math.min(profile.stats.fastestTime, duration)

    // Check achievements
    const newAchievements = this.checkAchievements(profile, session, finalScore, duration)

    // Add new achievements to profile
    newAchievements.forEach(ach => {
      if (!profile.achievements.includes(ach.id)) {
        profile.achievements.push(ach.id)
      }
    })

    this.saveProfile(profile)

    // Clear session
    localStorage.removeItem(`${this.SESSION_KEY_PREFIX}:${kuisId}`)

    return newAchievements
  }

  /**
   * Check and return newly unlocked achievements
   */
  private checkAchievements(
    profile: GameProfile,
    session: GameSession,
    finalScore: number,
    duration: number
  ): Achievement[] {
    const unlocked: Achievement[] = []
    const now = new Date().toISOString()

    // First quiz
    if (profile.totalQuizzes === 1 && !profile.achievements.includes('first_blood')) {
      unlocked.push({ ...ACHIEVEMENTS.first_blood, unlocked: true, unlockedAt: now })
    }

    // Perfect score
    if (finalScore === 100 && !profile.achievements.includes('satria_wijaya')) {
      unlocked.push({ ...ACHIEVEMENTS.satria_wijaya, unlocked: true, unlockedAt: now })
    }

    // Speed achievements
    if (duration < 5 && !profile.achievements.includes('pangeran_geledek')) {
      unlocked.push({ ...ACHIEVEMENTS.pangeran_geledek, unlocked: true, unlockedAt: now })
    }
    if (duration < 3 && !profile.achievements.includes('speed_demon')) {
      unlocked.push({ ...ACHIEVEMENTS.speed_demon, unlocked: true, unlockedAt: now })
    }

    // Streak achievements
    if (session.maxStreak >= 5 && !profile.achievements.includes('combo_master')) {
      unlocked.push({ ...ACHIEVEMENTS.combo_master, unlocked: true, unlockedAt: now })
    }
    if (session.maxStreak >= 10 && !profile.achievements.includes('raja_panah')) {
      unlocked.push({ ...ACHIEVEMENTS.raja_panah, unlocked: true, unlockedAt: now })
    }

    // Long-term achievements
    if (profile.totalQuizzes >= 10 && !profile.achievements.includes('ksatria_tangguh')) {
      unlocked.push({ ...ACHIEVEMENTS.ksatria_tangguh, unlocked: true, unlockedAt: now })
    }
    if (profile.totalPoints > 900 && !profile.achievements.includes('begawan_cendekia')) {
      unlocked.push({ ...ACHIEVEMENTS.begawan_cendekia, unlocked: true, unlockedAt: now })
    }

    return unlocked
  }

  /**
   * Get all achievements with unlock status
   */
  getAllAchievements(siswaId?: string): Achievement[] {
    const profile = this.getProfile(siswaId)
    
    return Object.values(ACHIEVEMENTS).map(ach => ({
      ...ach,
      unlocked: profile.achievements.includes(ach.id),
      unlockedAt: undefined // Could store timestamp if needed
    }))
  }

  /**
   * Reset game profile (for testing)
   */
  resetProfile() {
    localStorage.removeItem(this.PROFILE_KEY)
  }

  /**
   * Clear session (for cleanup)
   */
  clearSession(kuisId: string) {
    localStorage.removeItem(`${this.SESSION_KEY_PREFIX}:${kuisId}`)
  }
}

// Singleton instance
export const gameState = new GameStateManager()
