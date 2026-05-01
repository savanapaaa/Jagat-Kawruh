import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../ui/Icon'

type QuestNode = {
  id: string
  label: string
  completed: boolean
  active: boolean
  index: number
}

type QuestMapProps = {
  nodes: QuestNode[]
  onNodeClick: (index: number) => void
  completionPercentage: number
}

// Tema perjalanan - ikon untuk tiap fase
const PHASE_ICONS: IconName[] = ['tree', 'swap', 'fire', 'crown', 'sparkle', 'temple']
const PHASE_THEMES = [
  { bg: 'from-orange-400 to-red-500', glow: 'shadow-orange-300', ring: 'ring-orange-300' },
  { bg: 'from-cyan-400 to-blue-500', glow: 'shadow-cyan-300', ring: 'ring-cyan-300' },
  { bg: 'from-emerald-400 to-green-600', glow: 'shadow-emerald-300', ring: 'ring-emerald-300' },
  { bg: 'from-amber-400 to-yellow-500', glow: 'shadow-amber-300', ring: 'ring-amber-300' },
  { bg: 'from-purple-400 to-violet-500', glow: 'shadow-purple-300', ring: 'ring-purple-300' },
  { bg: 'from-pink-400 to-rose-500', glow: 'shadow-pink-300', ring: 'ring-pink-300' },
]

export default function QuestMap({ nodes, onNodeClick, completionPercentage }: QuestMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [characterPos, setCharacterPos] = useState(0)
  const [showSparkle, setShowSparkle] = useState(false)

  // Find character position (first incomplete or last completed)
  useEffect(() => {
    const firstIncomplete = nodes.findIndex((n) => !n.completed)
    if (firstIncomplete === -1) {
      setCharacterPos(nodes.length) // At the finish
    } else {
      setCharacterPos(firstIncomplete)
    }
  }, [nodes])

  // Sparkle effect on completion
  useEffect(() => {
    if (completionPercentage === 100) {
      setShowSparkle(true)
      const t = setTimeout(() => setShowSparkle(false), 3000)
      return () => clearTimeout(t)
    }
  }, [completionPercentage])

  const allComplete = completionPercentage === 100

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Icon name="map" />
          Peta Perjalanan
        </h2>
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-slate-500">
            {nodes.filter((n) => n.completed).length}/{nodes.length} misi
          </div>
          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quest Map - Horizontal scroll on mobile */}
      <div
        ref={mapRef}
        className="relative rounded-2xl bg-gradient-to-br from-amber-50 via-green-50 to-cyan-50 p-4 sm:p-6 shadow-inner overflow-x-auto"
        style={{ minHeight: 200 }}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute top-2 left-4 opacity-20 text-emerald-700">
            <Icon name="tree" className="h-7 w-7" />
          </div>
          <div className="absolute top-4 right-8 opacity-20 text-cyan-700">
            <Icon name="wind" className="h-6 w-6" />
          </div>
          <div className="absolute bottom-3 left-12 opacity-20 text-pink-700">
            <Icon name="sparkle" className="h-6 w-6" />
          </div>
          <div className="absolute bottom-2 right-4 opacity-20 text-emerald-700">
            <Icon name="tree" className="h-5 w-5" />
          </div>
          <div className="absolute top-1/2 left-1/3 opacity-10 text-slate-700">
            <Icon name="wind" className="h-5 w-5" />
          </div>
        </div>

        {/* Path line (SVG) */}
        <div className="relative" style={{ minWidth: nodes.length > 4 ? nodes.length * 120 : '100%' }}>
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ minHeight: 180 }}
            viewBox={`0 0 ${Math.max(nodes.length * 120, 500)} 180`}
            preserveAspectRatio="none"
          >
            {/* Dotted path */}
            {nodes.map((_, i) => {
              if (i === nodes.length - 1) return null
              const x1 = getNodeX(i, nodes.length)
              const x2 = getNodeX(i + 1, nodes.length)
              const y1 = getNodeY(i)
              const y2 = getNodeY(i + 1)
              const completed = nodes[i].completed
              return (
                <line
                  key={`path-${i}`}
                  x1={`${x1}%`}
                  y1={y1}
                  x2={`${x2}%`}
                  y2={y2}
                  stroke={completed ? '#10b981' : '#d1d5db'}
                  strokeWidth={completed ? 4 : 3}
                  strokeDasharray={completed ? '0' : '8 6'}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              )
            })}
            {/* Path to finish */}
            {nodes.length > 0 && (
              <line
                x1={`${getNodeX(nodes.length - 1, nodes.length)}%`}
                y1={getNodeY(nodes.length - 1)}
                x2="95%"
                y2={90}
                stroke={allComplete ? '#10b981' : '#d1d5db'}
                strokeWidth={allComplete ? 4 : 3}
                strokeDasharray={allComplete ? '0' : '8 6'}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            )}
          </svg>

          {/* Nodes */}
          <div className="relative flex items-start justify-between" style={{ minHeight: 180 }}>
            {/* Start flag */}
            <div
              className="absolute flex flex-col items-center"
              style={{
                left: '2%',
                top: 10,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-slate-600">
                <Icon name="pin" className="h-7 w-7" />
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">START</div>
            </div>

            {nodes.map((node, i) => {
              const theme = PHASE_THEMES[i % PHASE_THEMES.length]
              const icon = PHASE_ICONS[i % PHASE_ICONS.length]
              const isCharacterHere = characterPos === i
              const xPos = getNodeX(i, nodes.length)
              const yPos = getNodeY(i)

              return (
                <button
                  key={node.id}
                  onClick={() => onNodeClick(i)}
                  className="absolute flex flex-col items-center group"
                  style={{
                    left: `${xPos}%`,
                    top: yPos - 30,
                    transform: 'translateX(-50%)',
                    zIndex: node.active ? 20 : 10,
                  }}
                >
                  {/* Character indicator */}
                  {isCharacterHere && (
                    <div className="absolute -top-8 animate-bounce z-30 text-emerald-700">
                      <Icon name="users" className="h-7 w-7" />
                    </div>
                  )}

                  {/* Node circle */}
                  <div
                    className={`
                      relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full
                      text-xl sm:text-2xl font-bold transition-all duration-300
                      ${node.completed
                        ? `bg-gradient-to-br ${theme.bg} text-white shadow-lg ${theme.glow}`
                        : node.active
                          ? `bg-white ring-4 ${theme.ring} shadow-lg scale-110`
                          : 'bg-white/80 shadow ring-2 ring-slate-200 opacity-75'
                      }
                      group-hover:scale-110 group-hover:shadow-xl
                    `}
                  >
                    {node.completed ? (
                      <span className="relative">
                        <Icon name={icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Icon name="check" className="h-3.5 w-3.5" />
                        </span>
                      </span>
                    ) : (
                      <span className={node.active ? 'animate-pulse' : 'opacity-60'}>
                        <Icon name={icon} className="h-7 w-7 sm:h-8 sm:w-8" />
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <div
                    className={`mt-1.5 max-w-[80px] text-center text-[10px] sm:text-xs font-semibold leading-tight ${
                      node.completed
                        ? 'text-emerald-700'
                        : node.active
                          ? 'text-slate-800'
                          : 'text-slate-400'
                    }`}
                  >
                    {node.label}
                  </div>
                </button>
              )
            })}

            {/* Finish flag */}
            <div
              className="absolute flex flex-col items-center"
              style={{
                left: '95%',
                top: 60,
                transform: 'translateX(-50%)',
                zIndex: allComplete ? 20 : 10,
              }}
            >
              {characterPos === nodes.length && (
                <div className="absolute -top-8 animate-bounce z-30 text-emerald-700">
                  <Icon name="users" className="h-7 w-7" />
                </div>
              )}
              <div className={`text-3xl transition-all duration-500 ${allComplete ? 'scale-125' : 'opacity-50 grayscale'}`}>
                <Icon name="trophy" className="h-9 w-9" />
              </div>
              <div className={`text-[10px] font-bold mt-0.5 ${allComplete ? 'text-amber-600' : 'text-slate-400'}`}>
                FINISH
              </div>
            </div>
          </div>
        </div>

        {/* Sparkle overlay */}
        {showSparkle && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-ping text-xl"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                  animationDelay: `${Math.random() * 1.5}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              >
                <Icon name="sparkle" className="h-6 w-6" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper: zigzag Y positions for nodes to make the path more interesting
function getNodeY(index: number): number {
  const positions = [50, 120, 60, 130, 70, 110]
  return positions[index % positions.length]
}

// Helper: X position evenly spaced
function getNodeX(index: number, total: number): number {
  if (total <= 1) return 50
  const startX = 12
  const endX = 85
  return startX + (index / (total - 1)) * (endX - startX)
}
