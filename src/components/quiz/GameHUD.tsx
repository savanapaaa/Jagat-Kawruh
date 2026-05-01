import { useEffect, useRef, useState } from 'react'
import { WAYANG_CHARACTERS } from '../../lib/gameState'
import type { WayangCharacter, PowerUpType } from '../../lib/gameState'
import { gameAudio } from '../../lib/gameAudio'
import { getWayangImageSrc } from '../../lib/wayangImages'
import { Icon } from '../ui/Icon'

interface GameHUDProps {
  character: WayangCharacter
  hp: number
  maxHp: number
  streak: number
  score: number
  powerUps: Record<PowerUpType, number>
  currentQuestion: number
  totalQuestions: number
  timeRemaining?: string
  onUsePowerUp?: (type: PowerUpType) => void
  showPowerUps?: boolean
}

export function GameHUD({
  character,
  hp,
  maxHp,
  streak,
  score,
  powerUps,
  currentQuestion,
  totalQuestions,
  timeRemaining,
  onUsePowerUp,
  showPowerUps = true
}: GameHUDProps) {
  const wayang = WAYANG_CHARACTERS[character]
  const hpPercentage = (hp / maxHp) * 100
  const progressPercentage = (currentQuestion / totalQuestions) * 100

  const prevHpRef = useRef(hp)
  const [hpAnimation, setHpAnimation] = useState<'damage' | 'heal' | null>(null)

  useEffect(() => {
    const prevHp = prevHpRef.current
    if (hp < prevHp) {
      queueMicrotask(() => setHpAnimation('damage'))
      const timer = setTimeout(() => setHpAnimation(null), 500)
      prevHpRef.current = hp
      return () => clearTimeout(timer)
    } else if (hp > prevHp) {
      queueMicrotask(() => setHpAnimation('heal'))
      const timer = setTimeout(() => setHpAnimation(null), 500)
      prevHpRef.current = hp
      return () => clearTimeout(timer)
    }
    prevHpRef.current = hp
  }, [hp])

  const getHpColor = () => {
    if (hpPercentage > 60) return '#10B981' // green
    if (hpPercentage > 30) return '#F59E0B' // yellow
    return '#EF4444' // red
  }

  const handlePowerUpClick = (type: PowerUpType) => {
    if (powerUps[type] > 0 && onUsePowerUp) {
      gameAudio.playPowerUp()
      onUsePowerUp(type)
    }
  }

  const getPowerUpIcon = (type: PowerUpType) => {
    switch (type) {
      case 'hint':
        return 'sparkle'
      case 'shield':
        return 'shield'
      case 'skip':
        return 'sword'
    }
  }

  const getPowerUpName = (type: PowerUpType) => {
    switch (type) {
      case 'hint': return 'Wasiat Resi'
      case 'shield': return 'Wijayakusuma'
      case 'skip': return 'Panah Sakti'
    }
  }

  return (
    <div className="game-hud">
      {/* Character & HP */}
      <div className="hud-top">
        <div className="character-info">
          <div className={`character-avatar ${hpAnimation || ''}`} style={{ fontSize: '1.75rem' }}>
            <img
              src={getWayangImageSrc(character)}
              alt={wayang.name}
              className="h-8 w-8 object-contain"
              loading="lazy"
              draggable={false}
            />
          </div>
          <div className="character-details">
            <div className="character-name" style={{ color: wayang.color, fontWeight: 'bold' }}>
              {wayang.name}
            </div>
            <div className="hp-bar-container">
              <div className="hp-bar-bg">
                <div 
                  className="hp-bar-fill" 
                  style={{ 
                    width: `${hpPercentage}%`,
                    backgroundColor: getHpColor(),
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
              <div className="hp-text">{hp} / {maxHp} HP</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-info">
          {streak > 0 && (
            <div className={`stat-badge streak ${streak >= 5 ? 'fire' : ''}`}>
              <span className="inline-flex items-center gap-1">
                {streak >= 10 ? (
                  <>
                    <Icon name="fire" className="h-4 w-4" />
                    <Icon name="fire" className="h-4 w-4" />
                  </>
                ) : streak >= 5 ? (
                  <Icon name="fire" className="h-4 w-4" />
                ) : (
                  <Icon name="bolt" className="h-4 w-4" />
                )}
                {streak}x Streak!
              </span>
            </div>
          )}
          <div className="stat-badge score">
            <span className="inline-flex items-center gap-1">
              <Icon name="sparkle" className="h-4 w-4" />
              {score} Poin
            </span>
          </div>
          {timeRemaining && (
            <div className="stat-badge time">
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-4 w-4" />
                {timeRemaining}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-text">
          Soal {currentQuestion} / {totalQuestions}
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${progressPercentage}%`,
                backgroundColor: wayang.color
              }}
            />
          </div>
          <div className="progress-landmarks">
            <div className={`landmark ${progressPercentage >= 0 ? 'reached' : ''}`}>
              <Icon name="door" className="h-4 w-4" />
            </div>
            <div className={`landmark ${progressPercentage >= 33 ? 'reached' : ''}`}>
              <Icon name="tree" className="h-4 w-4" />
            </div>
            <div className={`landmark ${progressPercentage >= 66 ? 'reached' : ''}`}>
              <Icon name="temple" className="h-4 w-4" />
            </div>
            <div className={`landmark ${progressPercentage >= 100 ? 'reached' : ''}`}>
              <Icon name="castle" className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Power-ups */}
      {showPowerUps && (
        <div className="powerups-section">
          <div className="powerups-title">Kesaktian:</div>
          <div className="powerups-grid">
            {(Object.keys(powerUps) as PowerUpType[]).map(type => (
              <button
                key={type}
                onClick={() => handlePowerUpClick(type)}
                disabled={powerUps[type] <= 0}
                className={`powerup-btn ${powerUps[type] > 0 ? 'available' : 'disabled'}`}
                title={getPowerUpName(type)}
              >
                <div className="powerup-icon">
                  <Icon name={getPowerUpIcon(type)} className="h-5 w-5" />
                </div>
                <div className="powerup-count">x{powerUps[type]}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .game-hud {
          background: rgba(255, 255, 255, 0.6);
          border: 2px solid rgba(139, 69, 19, 0.2);
          border-radius: 1rem;
          padding: 0.75rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .hud-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .character-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .character-avatar {
          transition: transform 0.3s ease;
          flex-shrink: 0;
        }

        .character-avatar.damage {
          animation: shake 0.5s ease;
          filter: brightness(0.5);
        }

        .character-avatar.heal {
          animation: heal-pulse 0.5s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px) rotate(-5deg); }
          75% { transform: translateX(10px) rotate(5deg); }
        }

        @keyframes heal-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); filter: brightness(1.5); }
        }

        .character-details {
          flex: 1;
          min-width: 0;
        }

        .character-name {
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-bar-container {
          position: relative;
        }

        .hp-bar-bg {
          width: 100%;
          height: 20px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid rgba(0,0,0,0.3);
        }

        .hp-bar-fill {
          height: 100%;
          transition: width 0.4s ease, background-color 0.3s ease;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.3);
        }

        .hp-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          font-weight: bold;
          color: white;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
          pointer-events: none;
          white-space: nowrap;
        }

        .stats-info {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          align-items: center;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .stat-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-weight: bold;
          font-size: 0.75rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          white-space: nowrap;
        }

        .stat-badge.streak {
          background: linear-gradient(135deg, #FCD34D, #F59E0B);
          color: #78350F;
          animation: pulse 1s ease infinite;
        }

        .stat-badge.streak.fire {
          background: linear-gradient(135deg, #FCA5A5, #EF4444);
          color: white;
          animation: fire-pulse 0.8s ease infinite;
        }

        .stat-badge.score {
          background: linear-gradient(135deg, #A78BFA, #7C3AED);
          color: white;
        }

        .stat-badge.time {
          background: linear-gradient(135deg, #93C5FD, #3B82F6);
          color: white;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes fire-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); box-shadow: 0 0 15px rgba(239,68,68,0.5); }
        }

        .progress-section {
          margin-bottom: 0.75rem;
        }

        .progress-text {
          font-weight: bold;
          margin-bottom: 0.25rem;
          color: #4a2511;
          font-size: 0.85rem;
        }

        .progress-bar-container {
          position: relative;
        }

        .progress-bar-bg {
          width: 100%;
          height: 18px;
          background: rgba(0,0,0,0.2);
          border-radius: 9px;
          overflow: hidden;
          border: 2px solid rgba(0,0,0,0.3);
        }

        .progress-bar-fill {
          height: 100%;
          transition: width 0.4s ease;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.3);
        }

        .progress-landmarks {
          position: absolute;
          top: -6px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          pointer-events: none;
        }

        .landmark {
          font-size: 1.25rem;
          opacity: 0.3;
          transition: all 0.3s ease;
          filter: grayscale(1);
        }

        .landmark.reached {
          opacity: 1;
          filter: grayscale(0);
          animation: bounce-in 0.5s ease;
        }

        @keyframes bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        .powerups-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .powerups-title {
          font-weight: bold;
          color: #4a2511;
          white-space: nowrap;
          font-size: 0.85rem;
        }

        .powerups-grid {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .powerup-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          border: 2px solid #8b4513;
          border-radius: 0.5rem;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 50px;
        }

        .powerup-btn.available:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          background: #fffbeb;
        }

        .powerup-btn.available:active {
          transform: scale(0.95);
        }

        .powerup-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .powerup-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .powerup-count {
          font-size: 0.7rem;
          font-weight: bold;
          color: #4a2511;
        }

        /* ===== TABLET (max 768px) ===== */
        @media (max-width: 768px) {
          .hud-top {
            flex-direction: column;
            gap: 0.5rem;
          }

          .stats-info {
            flex-direction: row;
            justify-content: flex-start;
            width: 100%;
          }

          .powerups-section {
            flex-direction: column;
            align-items: flex-start;
          }

          .powerups-grid {
            width: 100%;
          }

          .powerup-btn {
            flex: 1;
            min-width: unset;
          }
        }

        /* ===== MOBILE (max 640px) ===== */
        @media (max-width: 640px) {
          .game-hud {
            padding: 0.5rem;
            border-radius: 0.625rem;
            border-width: 1px;
          }

          .hud-top {
            gap: 0.375rem;
            margin-bottom: 0.375rem;
          }

          .character-info {
            gap: 0.375rem;
          }

          .character-avatar {
            font-size: 1.3rem !important;
          }

          .character-name {
            font-size: 0.75rem;
            margin-bottom: 0.125rem;
          }

          .hp-bar-bg {
            height: 16px;
            border-width: 1px;
          }

          .hp-text {
            font-size: 0.6rem;
          }

          .stats-info {
            gap: 0.25rem;
          }

          .stat-badge {
            padding: 0.2rem 0.375rem;
            font-size: 0.6rem;
            border-radius: 0.25rem;
          }

          .progress-section {
            margin-bottom: 0.375rem;
          }

          .progress-text {
            font-size: 0.65rem;
            margin-bottom: 0.125rem;
          }

          .progress-bar-bg {
            height: 14px;
            border-width: 1px;
          }

          .progress-landmarks {
            top: -6px;
          }

          .landmark {
            font-size: 0.85rem;
          }

          .powerup-icon {
            font-size: 1rem;
          }

          .powerup-btn {
            padding: 0.25rem;
            min-width: unset;
          }
        }

        /* ===== VERY SMALL (max 380px) ===== */
        @media (max-width: 380px) {
          .game-hud {
            padding: 0.375rem;
          }

          .character-avatar {
            font-size: 1.1rem !important;
          }

          .character-name {
            font-size: 0.65rem;
          }

          .hp-bar-bg {
            height: 14px;
          }

          .hp-text {
            font-size: 0.55rem;
          }

          .stat-badge {
            font-size: 0.55rem;
            padding: 0.15rem 0.3rem;
          }

          .progress-bar-bg {
            height: 12px;
          }

          .landmark {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  )
}
