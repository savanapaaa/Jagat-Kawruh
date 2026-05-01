import { useState } from 'react'
import { gameState, WAYANG_CHARACTERS } from '../../lib/gameState'
import type { WayangCharacter } from '../../lib/gameState'
import { gameAudio } from '../../lib/gameAudio'
import { getWayangImageSrc } from '../../lib/wayangImages'
import { Icon } from '../ui/Icon'

interface WayangPickerProps {
  siswaId?: string
  onSelect: (character: WayangCharacter) => void
  initialCharacter?: WayangCharacter
}

export function WayangPicker({ siswaId, onSelect, initialCharacter }: WayangPickerProps) {
  const [selected, setSelected] = useState<WayangCharacter>(
    initialCharacter || gameState.getProfile(siswaId).selectedCharacter
  )
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const handleSelect = (character: WayangCharacter) => {
    gameAudio.playClick()
    gameAudio.playWayangVoice(character)
    setSelected(character)
    gameState.selectCharacter(character, siswaId)
    onSelect(character)
  }

  const characters = Object.values(WAYANG_CHARACTERS)

  const characterBonusLabel = (id: WayangCharacter): string => {
    switch (id) {
      case 'arjuna':
        return '+20 HP Maksimal'
      case 'bima':
        return 'Trap Damage -50%'
      case 'gatotkaca':
        return '+1 Shield Ekstra'
      case 'srikandi':
        return '+1 Hint Ekstra'
      case 'semar':
        return '+10 HP & Trap -25%'
    }
  }

  return (
    <div className="wayang-picker-container">
      <div className="wayang-picker-header">
        <h2 className="inline-flex w-full items-center justify-center gap-2 text-2xl font-bold text-center mb-2">
          <Icon name="sparkle" className="h-5 w-5" />
          Pilih Wayang Kesatriaanmu
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Pilih karakter wayang untuk menemanimu dalam pertempuran soal!
        </p>
      </div>

      <div className="wayang-grid">
        {characters.map((char, idx) => (
          <button
            key={char.id}
            onClick={() => handleSelect(char.id)}
            onMouseEnter={() => {
              setHoveredIdx(idx)
              gameAudio.playClick()
            }}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`wayang-card ${selected === char.id ? 'selected' : ''} ${hoveredIdx === idx ? 'hovered' : ''}`}
            style={{
              borderColor: selected === char.id ? char.color : 'transparent',
              backgroundColor: selected === char.id ? `${char.color}15` : 'white'
            }}
          >
            <div className="wayang-emoji flex h-20 w-20 items-center justify-center">
              <img
                src={getWayangImageSrc(char.id)}
                alt={char.name}
                className="h-full w-full object-contain"
                loading="lazy"
                draggable={false}
              />
            </div>
            <div className="wayang-name" style={{ color: char.color, fontWeight: 'bold', fontSize: '1.25rem' }}>
              {char.name}
            </div>
            <div className="wayang-desc" style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.5rem', textAlign: 'center' }}>
              {char.description}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '0.25rem', textAlign: 'center', fontWeight: 600 }}>
              <span className="inline-flex items-center gap-2">
                <img
                  src={getWayangImageSrc(char.id)}
                  alt=""
                  className="h-5 w-5 object-contain"
                  loading="lazy"
                  draggable={false}
                />
                {characterBonusLabel(char.id)}
              </span>
            </div>
            {selected === char.id && (
              <div className="selected-badge" style={{ marginTop: '1rem', color: char.color, fontWeight: 'bold' }}>
                <span className="inline-flex items-center gap-2">
                  <Icon name="check" />
                  Dipilih
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .wayang-picker-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .wayang-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .wayang-card {
          padding: 1.5rem;
          border: 3px solid transparent;
          border-radius: 1rem;
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .wayang-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .wayang-card.selected {
          transform: scale(1.05);
          box-shadow: 0 12px 32px rgba(0,0,0,0.2);
        }

        .wayang-emoji {
          transition: transform 0.3s ease;
        }

        .wayang-card:hover .wayang-emoji {
          transform: scale(1.2) rotate(10deg);
        }

        .wayang-card.selected .wayang-emoji {
          animation: bounce 0.5s ease infinite alternate;
        }

        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-10px); }
        }

        @media (max-width: 640px) {
          .wayang-picker-container {
            padding: 1rem;
          }

          .wayang-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          
          .wayang-card {
            padding: 1rem;
          }
          
          .wayang-emoji {
            width: 4rem !important;
            height: 4rem !important;
          }
          
          .wayang-name {
            font-size: 1rem !important;
          }
          
          .wayang-desc {
            font-size: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  )
}
