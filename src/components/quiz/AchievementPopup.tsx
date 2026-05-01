import { useEffect, useState } from 'react'
import type { Achievement } from '../../lib/gameState'
import { gameAudio } from '../../lib/gameAudio'
import { Icon, type IconName } from '../ui/Icon'

interface AchievementPopupProps {
  achievements: Achievement[]
  onClose: () => void
}

export function AchievementPopup({ achievements, onClose }: AchievementPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (achievements.length > 0) {
      gameAudio.playAchievement()
    }
  }, [achievements])

  useEffect(() => {
    if (currentIndex < achievements.length - 1) {
      const timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
        gameAudio.playAchievement()
      }, 3000)
      return () => clearTimeout(timer)
    } else if (currentIndex === achievements.length - 1) {
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 500)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, achievements.length, onClose])

  if (achievements.length === 0 || !visible) return null

  const achievement = achievements[currentIndex]

  const achievementIcon = (id: Achievement['id']): IconName => {
    switch (id) {
      case 'first_blood':
        return 'sword'
      case 'satria_wijaya':
        return 'trophy'
      case 'pangeran_geledek':
        return 'bolt'
      case 'speed_demon':
        return 'wind'
      case 'combo_master':
        return 'fire'
      case 'raja_panah':
        return 'target'
      case 'ksatria_tangguh':
        return 'shield'
      case 'begawan_cendekia':
        return 'book'
      default:
        return 'medal'
    }
  }

  return (
    <div className="achievement-overlay">
      <div className={`achievement-popup ${visible ? 'show' : 'hide'}`}>
        <div className="achievement-glow" />
        <div className="achievement-header">
          <div className="achievement-badge">
            <Icon name="trophy" className="h-10 w-10" />
          </div>
          <div className="achievement-title">Pencapaian Terbuka!</div>
        </div>
        
        <div className="achievement-content">
          <div className="achievement-emoji">
            <Icon name={achievementIcon(achievement.id)} className="h-20 w-20" />
          </div>
          <div className="achievement-name">{achievement.name}</div>
          <div className="achievement-description">{achievement.description}</div>
        </div>

        {achievements.length > 1 && (
          <div className="achievement-counter">
            {currentIndex + 1} / {achievements.length}
          </div>
        )}

        <button 
          onClick={() => {
            setVisible(false)
            setTimeout(onClose, 500)
          }}
          className="achievement-close"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <style>{`
        .achievement-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          animation: fade-in 0.3s ease;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .achievement-popup {
          position: relative;
          background: linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%);
          border: 4px solid #F59E0B;
          border-radius: 1.5rem;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .achievement-popup.show {
          animation: popup-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .achievement-popup.hide {
          animation: popup-out 0.5s ease forwards;
        }

        @keyframes popup-in {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes popup-out {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(180deg);
            opacity: 0;
          }
        }

        .achievement-glow {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(252, 211, 77, 0.3) 0%, transparent 70%);
          animation: rotate-glow 3s linear infinite;
          pointer-events: none;
        }

        @keyframes rotate-glow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .achievement-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          position: relative;
          z-index: 1;
        }

        .achievement-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bounce-trophy 1s ease infinite;
        }

        @keyframes bounce-trophy {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .achievement-title {
          font-size: 1.25rem;
          font-weight: bold;
          color: #78350F;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .achievement-content {
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .achievement-emoji {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
          animation: float-emoji 2s ease-in-out infinite;
        }

        @keyframes float-emoji {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(-5deg); }
          75% { transform: translateY(-10px) rotate(5deg); }
        }

        .achievement-name {
          font-size: 1.5rem;
          font-weight: bold;
          color: #78350F;
          margin-bottom: 0.5rem;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .achievement-description {
          font-size: 1rem;
          color: #92400E;
          line-height: 1.5;
        }

        .achievement-counter {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.875rem;
          font-weight: bold;
          color: #78350F;
          position: relative;
          z-index: 1;
        }

        .achievement-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.3);
          border: 2px solid rgba(120, 53, 15, 0.3);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #78350F;
          font-size: 1.25rem;
          font-weight: bold;
          z-index: 2;
        }

        .achievement-close:hover {
          background: rgba(255, 255, 255, 0.6);
          transform: rotate(90deg);
        }

        .achievement-close:active {
          transform: scale(0.9) rotate(90deg);
        }

        /* Confetti animation */
        .achievement-popup::before,
        .achievement-popup::after {
          content: '';
          position: absolute;
          width: 10px;
          height: 10px;
          background: #EF4444;
          animation: confetti 3s ease-in-out infinite;
          z-index: 0;
        }

        .achievement-popup::before {
          top: 20%;
          left: 10%;
          animation-delay: 0s;
        }

        .achievement-popup::after {
          top: 30%;
          right: 10%;
          background: #3B82F6;
          animation-delay: 0.5s;
        }

        @keyframes confetti {
          0% {
            transform: translateY(-50px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(300px) rotate(720deg);
            opacity: 0;
          }
        }

        @media (max-width: 640px) {
          .achievement-popup {
            padding: 1.5rem;
          }

          .achievement-emoji {
            font-size: 3.5rem;
          }

          .achievement-name {
            font-size: 1.25rem;
          }

          .achievement-description {
            font-size: 0.875rem;
          }

          .achievement-badge {
            font-size: 2rem;
          }

          .achievement-title {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
