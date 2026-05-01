/**
 * Game Audio Manager
 * Web Audio API untuk sound effects tanpa file audio
 */

class GameAudioManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    // Check if audio enabled in localStorage
    const saved = localStorage.getItem('jk_game_audio_enabled')
    this.enabled = saved !== 'false'
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  private resolvePublicUrl(path: string): string {
    const base = import.meta.env.BASE_URL || '/'
    const normalizedBase = base.endsWith('/') ? base : `${base}/`
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path
    return `${normalizedBase}${normalizedPath}`
  }

  private playFileWithFallback(
    path: string,
    options: { volume?: number } | undefined,
    fallback: () => void
  ) {
    if (!this.enabled) return

    try {
      const url = this.resolvePublicUrl(path)
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = options?.volume ?? 0.9

      const onFailure = () => {
        try {
          fallback()
        } catch {
          // ignore
        }
      }

      audio.addEventListener('error', onFailure, { once: true })

      const playPromise = audio.play()
      if (playPromise && typeof (playPromise as any).catch === 'function') {
        ;(playPromise as Promise<void>).catch(onFailure)
      }
    } catch {
      try {
        fallback()
      } catch {
        // ignore
      }
    }
  }

  /**
   * Play a beep tone
   * @param frequency - Frequency in Hz (higher = higher pitch)
   * @param duration - Duration in seconds
   * @param type - Waveform type
   */
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.enabled) return

    try {
      const ctx = this.getContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      // Fade out to avoid clicks
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
      console.warn('Audio playback failed:', e)
    }
  }

  /**
   * Kenong sound - Jawaban benar
   */
  playCorrect() {
    this.playFileWithFallback('audio/sfx/correct.mp3', { volume: 0.9 }, () => {
      // C5 note (523.25 Hz) - pleasant high tone
      this.playTone(523.25, 0.3, 'sine')
      // Add a second harmonic for richness
      setTimeout(() => this.playTone(659.25, 0.2, 'sine'), 50)
    })
  }

  /**
   * Keprak sound - Click/select
   */
  playClick() {
    this.playFileWithFallback('audio/sfx/click.mp3', { volume: 0.7 }, () => {
      // Short percussive click
      this.playTone(800, 0.05, 'square')
    })
  }

  /**
   * Suling (sad) sound - Jawaban salah
   */
  playWrong() {
    this.playFileWithFallback('audio/sfx/wrong.mp3', { volume: 0.9 }, () => {
      // F4 note (349.23 Hz) - lower, sad tone
      this.playTone(349.23, 0.4, 'triangle')
    })
  }

  /**
   * Gong sound - Quiz selesai
   */
  playComplete() {
    this.playFileWithFallback('audio/sfx/complete.mp3', { volume: 0.9 }, () => {
      // Low gong-like sound with multiple harmonics
      this.playTone(130.81, 1.0, 'sine') // C3
      setTimeout(() => this.playTone(164.81, 0.8, 'sine'), 100) // E3
      setTimeout(() => this.playTone(196.0, 0.6, 'sine'), 200) // G3
    })
  }

  /**
   * Achievement unlock sound
   */
  playAchievement() {
    this.playFileWithFallback('audio/sfx/achievement.mp3', { volume: 0.9 }, () => {
      // Ascending arpeggio
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.2, 'sine'), i * 100)
      })
    })
  }

  /**
   * Combo/Streak sound
   */
  playStreak(level: number) {
    this.playFileWithFallback('audio/sfx/streak.mp3', { volume: 0.85 }, () => {
      // Pitch increases with streak level
      const basePitch = 440 + (level * 50) // A4 + level bonus
      this.playTone(basePitch, 0.15, 'square')
      setTimeout(() => this.playTone(basePitch * 1.5, 0.1, 'square'), 75)
    })
  }

  /**
   * Power-up activation sound
   */
  playPowerUp() {
    this.playFileWithFallback('audio/sfx/powerup.mp3', { volume: 0.9 }, () => {
      // Sweep upward
      const ctx = this.getContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(200, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3)

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    })
  }

  /**
   * HP damage sound
   */
  playDamage() {
    this.playFileWithFallback('audio/sfx/damage.mp3', { volume: 0.9 }, () => {
      this.playTone(200, 0.2, 'sawtooth')
    })
  }

  /**
   * HP heal sound
   */
  playHeal() {
    this.playFileWithFallback('audio/sfx/heal.mp3', { volume: 0.9 }, () => {
      this.playTone(660, 0.15, 'sine')
      setTimeout(() => this.playTone(880, 0.1, 'sine'), 75)
    })
  }

  /**
   * Optional: voice/quote when selecting a wayang character.
   * Put files in: public/audio/wayang/<character>.mp3
   */
  playWayangVoice(character: string) {
    this.playFileWithFallback(`audio/wayang/${character}.mp3`, { volume: 0.95 }, () => {
      this.playClick()
    })
  }

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled
    localStorage.setItem('jk_game_audio_enabled', String(this.enabled))
    
    // Play test sound if enabling
    if (this.enabled) {
      this.playClick()
    }
  }

  /**
   * Check if audio is enabled
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    localStorage.setItem('jk_game_audio_enabled', String(enabled))
  }
}

// Singleton instance
export const gameAudio = new GameAudioManager()
