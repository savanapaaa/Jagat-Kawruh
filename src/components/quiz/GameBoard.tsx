import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { WayangCharacter } from '../../lib/gameState'
import { gameAudio } from '../../lib/gameAudio'
import { getWayangImageSrc } from '../../lib/wayangImages'
import { Icon, type IconName } from '../ui/Icon'

interface Position {
  x: number
  y: number
}

interface Checkpoint {
  x: number
  y: number
  icon: IconName
  name: string
  questionStart: number  // First question index in this checkpoint
  questionEnd: number    // Last question index in this checkpoint
  unlocked: boolean
  completed: boolean     // All questions in this checkpoint answered
}

interface GameBoardProps {
  character: WayangCharacter
  totalQuestions: number
  onReachCheckpoint: (checkpointIndex: number, questionIndices: number[]) => void
  onTrapHit: (damage: number) => void
  onFinish: () => void
  onCoinCollected?: (value: number) => void
  answeredQuestions: Set<number>
  allCheckpointsCompleted: boolean
  fullscreen?: boolean
}

// Map layout: 0 = path, 1 = wall, 2 = checkpoint, 3 = trap, 4 = finish, 5 = coin
const MAP_LAYOUT = [
  [0, 0, 3, 1, 0, 5, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 3, 1, 0, 2], // CP1 top-right
  [0, 1, 0, 5, 0, 1, 0, 0, 5, 0],
  [0, 3, 1, 1, 0, 0, 0, 1, 1, 0],
  [5, 0, 0, 2, 0, 1, 5, 3, 0, 0], // CP2 middle-left
  [1, 1, 0, 1, 0, 0, 0, 1, 0, 1],
  [2, 0, 5, 1, 3, 1, 0, 0, 0, 5], // CP3 left side
  [1, 0, 1, 0, 0, 5, 0, 1, 3, 0],
  [0, 5, 1, 0, 1, 3, 0, 1, 0, 0],
  [3, 0, 0, 5, 1, 0, 0, 2, 5, 4], // CP4 bottom-right, FINISH far right
]

export function GameBoard({
  character,
  totalQuestions,
  onReachCheckpoint,
  onTrapHit,
  onFinish,
  onCoinCollected,
  answeredQuestions,
  allCheckpointsCompleted,
  fullscreen = false
}: GameBoardProps) {
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 })
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [trapCooldown, setTrapCooldown] = useState<Set<string>>(new Set())
  const [shakeScreen, setShakeScreen] = useState(false)
  const [collectedCoins, setCollectedCoins] = useState<Set<string>>(new Set())
  const boardRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const checkpointIcon = (idx: number): IconName => {
    switch (idx) {
      case 0:
        return 'door'
      case 1:
        return 'tree'
      case 2:
        return 'temple'
      case 3:
        return 'castle'
      default:
        return 'pin'
    }
  }

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Initialize checkpoints from map
  useEffect(() => {
    const cps: Checkpoint[] = []
    const checkpointCount = MAP_LAYOUT.flat().filter(c => c === 2).length
    const questionsPerCheckpoint = Math.ceil(totalQuestions / checkpointCount)
    
    MAP_LAYOUT.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 2) {
          const cpIndex = cps.length
          const questionStart = cpIndex * questionsPerCheckpoint
          const questionEnd = Math.min(questionStart + questionsPerCheckpoint - 1, totalQuestions - 1)
          
          cps.push({
            x,
            y,
            icon: checkpointIcon(cpIndex),
            name: ['Gerbang', 'Hutan', 'Pendopo', 'Keraton'][cpIndex] || 'Pos',
            questionStart,
            questionEnd,
            unlocked: cpIndex === 0, // First checkpoint always unlocked
            completed: false
          })
        }
      })
    })
    
    queueMicrotask(() => setCheckpoints(cps))
  }, [totalQuestions])

  // Update checkpoint status based on answered questions
  useEffect(() => {
    queueMicrotask(() => {
      setCheckpoints(prev => prev.map((cp, index) => {
        // Check if all questions in this checkpoint are answered
        const allQuestionsAnswered = Array.from(
          { length: cp.questionEnd - cp.questionStart + 1 },
          (_, i) => cp.questionStart + i
        ).every(q => answeredQuestions.has(q))
        
        // Checkpoint unlocks when previous checkpoint is completed
        const prevCompleted = index === 0 || prev[index - 1]?.completed
        
        return {
          ...cp,
          unlocked: prevCompleted,
          completed: allQuestionsAnswered
        }
      }))
    })
  }, [answeredQuestions])

  const canMoveTo = useCallback((x: number, y: number): boolean => {
    // Out of bounds
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return false
    
    const cell = MAP_LAYOUT[y][x]
    
    // Wall
    if (cell === 1) return false

    // Finish cell - only accessible when all checkpoints completed
    if (cell === 4) return allCheckpointsCompleted
    
    // Traps are always walkable (they deal damage)
    if (cell === 3) return true
    
    // Coins are always walkable
    if (cell === 5) return true
    
    // Check if checkpoint is locked
    const checkpoint = checkpoints.find(cp => cp.x === x && cp.y === y)
    if (checkpoint && !checkpoint.unlocked) {
      return false // Can't enter locked checkpoint
    }
    
    return true
  }, [checkpoints, allCheckpointsCompleted])

  const handleMove = useCallback((dx: number, dy: number) => {
    setPlayerPos(prev => {
      const newX = prev.x + dx
      const newY = prev.y + dy
      
      if (!canMoveTo(newX, newY)) {
        gameAudio.playWrong() // Bump sound
        return prev
      }
      
      gameAudio.playClick() // Move sound

      const cell = MAP_LAYOUT[newY][newX]

      // Check trap
      if (cell === 3) {
        const trapKey = `${newX}-${newY}`
        if (!trapCooldown.has(trapKey)) {
          // Trap triggers! Damage the player
          const damage = 10
          setTimeout(() => {
            gameAudio.playDamage()
            onTrapHit(damage)
            setShakeScreen(true)
            setTimeout(() => setShakeScreen(false), 400)
          }, 100)
          // Cooldown so the same trap doesn't fire again immediately
          setTrapCooldown(cdPrev => {
            const next = new Set(cdPrev)
            next.add(trapKey)
            return next
          })
          // Reset cooldown after 3 seconds (trap rearms)
          setTimeout(() => {
            setTrapCooldown(cdPrev => {
              const next = new Set(cdPrev)
              next.delete(trapKey)
              return next
            })
          }, 3000)
        }
      }

      // Check finish
      if (cell === 4 && allCheckpointsCompleted) {
        setTimeout(() => {
          gameAudio.playComplete()
          onFinish()
        }, 200)
      }

      // Check coin
      if (cell === 5) {
        const coinKey = `${newX}-${newY}`
        if (!collectedCoins.has(coinKey)) {
          setCollectedCoins(prev => {
            const next = new Set(prev)
            next.add(coinKey)
            return next
          })
          setTimeout(() => {
            gameAudio.playAchievement()
            onCoinCollected?.(5) // +5 bonus score
          }, 100)
        }
      }
      
      // Check if reached checkpoint
      const checkpointIndex = checkpoints.findIndex(cp => cp.x === newX && cp.y === newY)
      if (checkpointIndex !== -1) {
        const checkpoint = checkpoints[checkpointIndex]
        if (checkpoint.unlocked && !checkpoint.completed) {
          // Get all question indices for this checkpoint
          const questionIndices = Array.from(
            { length: checkpoint.questionEnd - checkpoint.questionStart + 1 },
            (_, i) => checkpoint.questionStart + i
          )
          
          setTimeout(() => {
            onReachCheckpoint(checkpointIndex, questionIndices)
            gameAudio.playCorrect()
          }, 200)
        }
      }
      
      return { x: newX, y: newY }
    })
  }, [canMoveTo, checkpoints, onReachCheckpoint, onTrapHit, onFinish, onCoinCollected, allCheckpointsCompleted, trapCooldown, collectedCoins])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          handleMove(0, -1)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          handleMove(0, 1)
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          handleMove(-1, 0)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          handleMove(1, 0)
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  // Touch swipe controls
  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const minSwipe = 30

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipe) {
          handleMove(dx > 0 ? 1 : -1, 0)
        }
      } else {
        if (Math.abs(dy) > minSwipe) {
          handleMove(0, dy > 0 ? 1 : -1)
        }
      }
      touchStartRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleMove])

  const getCellClass = (x: number, y: number): string => {
    const cell = MAP_LAYOUT[y][x]
    
    if (cell === 1) return 'cell wall'
    if (x === playerPos.x && y === playerPos.y) return 'cell player'

    // Finish cell
    if (cell === 4) {
      return allCheckpointsCompleted ? 'cell finish unlocked' : 'cell finish locked'
    }

    // Trap cell
    if (cell === 3) {
      const trapKey = `${x}-${y}`
      return trapCooldown.has(trapKey) ? 'cell trap triggered' : 'cell trap'
    }

    // Coin cell
    if (cell === 5) {
      const coinKey = `${x}-${y}`
      return collectedCoins.has(coinKey) ? 'cell path' : 'cell coin'
    }
    
    const checkpoint = checkpoints.find(cp => cp.x === x && cp.y === y)
    if (checkpoint) {
      if (checkpoint.completed) return 'cell checkpoint completed'
      if (checkpoint.unlocked) return 'cell checkpoint unlocked'
      return 'cell checkpoint locked'
    }
    
    return 'cell path'
  }

  const getCellContent = (x: number, y: number): ReactNode => {
    if (x === playerPos.x && y === playerPos.y) {
      return (
        <img
          src={getWayangImageSrc(character)}
          alt=""
          className="h-5 w-5 object-contain"
          loading="lazy"
          draggable={false}
        />
      )
    }

    const cell = MAP_LAYOUT[y][x]

    // Finish
    if (cell === 4) {
      return allCheckpointsCompleted ? <Icon name="trophy" className="h-5 w-5" /> : <Icon name="lock" className="h-5 w-5" />
    }

    // Trap (hidden as normal tile, or show skull on cooldown)
    if (cell === 3) {
      const trapKey = `${x}-${y}`
      return trapCooldown.has(trapKey) ? <Icon name="skull" className="h-5 w-5" /> : null
    }

    // Coin (show if not collected)
    if (cell === 5) {
      const coinKey = `${x}-${y}`
      return collectedCoins.has(coinKey) ? null : <Icon name="coin" className="h-5 w-5" />
    }
    
    const checkpoint = checkpoints.find(cp => cp.x === x && cp.y === y)
    if (checkpoint) {
      return <Icon name={checkpoint.icon} className="h-5 w-5" />
    }
    
    return null
  }

  return (
    <div
      className={`game-board-container ${shakeScreen ? 'screen-shake' : ''} ${fullscreen ? `fullscreen ${isMobile ? 'fullscreen-mobile' : 'fullscreen-desktop'}` : ''}`}
      ref={boardRef}
      style={fullscreen ? { height: '100%' } : undefined}
    >
      <div className="game-instructions">
        <div className="text-sm font-semibold text-slate-700 mb-1">
          {isMobile ? 'Swipe atau gunakan tombol arah di bawah' : 'Kontrol: Arrow Keys / WASD untuk gerak'}
        </div>
        <div className="text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            Jalan ke pos checkpoint untuk menjawab soal!
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Icon name="alert" className="h-4 w-4" />
              Hati-hati jebakan tersembunyi di jalan!
            </span>
          </span>
        </div>
      </div>

      <div className="game-board">
        {MAP_LAYOUT.map((row, y) => (
          <div key={y} className="board-row">
            {row.map((_, x) => (
              <div
                key={`${x}-${y}`}
                className={getCellClass(x, y)}
              >
                <span className="cell-content">{getCellContent(x, y)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile D-pad Controls */}
      {isMobile && (
        <div className="dpad-container">
          <div className="dpad">
            <button className="dpad-btn dpad-up" onClick={() => handleMove(0, -1)} aria-label="Up">
              ▲
            </button>
            <div className="dpad-middle-row">
              <button className="dpad-btn dpad-left" onClick={() => handleMove(-1, 0)} aria-label="Left">
                ◀
              </button>
              <div className="dpad-center">
                <img
                  src={getWayangImageSrc(character)}
                  alt=""
                  className="h-6 w-6 object-contain"
                  loading="lazy"
                  draggable={false}
                />
              </div>
              <button className="dpad-btn dpad-right" onClick={() => handleMove(1, 0)} aria-label="Right">
                ▶
              </button>
            </div>
            <button className="dpad-btn dpad-down" onClick={() => handleMove(0, 1)} aria-label="Down">
              ▼
            </button>
          </div>
        </div>
      )}

      <div className="checkpoint-legend">
        {checkpoints.map((cp, idx) => (
          <div
            key={idx}
            className={`legend-item ${cp.completed ? 'completed' : cp.unlocked ? 'unlocked' : 'locked'}`}
          >
            <span className="legend-emoji">
              <Icon name={cp.icon} className="h-5 w-5" />
            </span>
            <div className="legend-info">
              <span className="legend-name">{cp.name}</span>
              <span className="legend-questions">
                Soal {cp.questionStart + 1}-{cp.questionEnd + 1}
              </span>
            </div>
            {cp.completed && (
              <span className="legend-check">
                <Icon name="check" className="h-4 w-4" />
              </span>
            )}
            {!cp.completed && !cp.unlocked && (
              <span className="legend-lock">
                <Icon name="lock" className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
        {/* Finish legend */}
        <div className={`legend-item ${allCheckpointsCompleted ? 'finish-ready' : 'locked'}`}>
          <span className="legend-emoji">
            <Icon name="trophy" className="h-5 w-5" />
          </span>
          <div className="legend-info">
            <span className="legend-name">Garis Akhir</span>
            <span className="legend-questions">
              {allCheckpointsCompleted ? 'Terbuka!' : 'Selesaikan semua pos'}
            </span>
          </div>
          {!allCheckpointsCompleted && (
            <span className="legend-lock">
              <Icon name="lock" className="h-4 w-4" />
            </span>
          )}
        </div>
        {/* Coin legend */}
        <div className="legend-item">
          <span className="legend-emoji">
            <Icon name="coin" className="h-5 w-5" />
          </span>
          <div className="legend-info">
            <span className="legend-name">Koin Bonus</span>
            <span className="legend-questions">
              {collectedCoins.size}/{MAP_LAYOUT.flat().filter(c => c === 5).length} dikumpulkan (+5 poin)
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .game-board-container {
          --jk-board-max: 92vmin;
          width: 100%;
          box-sizing: border-box;
          /* Allow the page to scroll on touch devices when the user drags on the board area */
          touch-action: pan-y;
          transition: transform 0.1s ease;
        }

        .game-board-container.fullscreen {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
          padding: 0;
          padding-bottom: 8px;
          box-sizing: border-box;
        }

        .game-board-container.fullscreen-mobile {
          /* Mobile: prevent pull-to-refresh / scroll gestures inside the game area */
          touch-action: none;
          max-width: 100vw;
          /* Leave room for HUD + D-pad */
          --jk-board-max: min(92vmin, calc(100dvh - 300px));
        }

        .game-board-container.fullscreen-desktop {
          /* Desktop fullscreen: avoid accidental scroll gestures */
          touch-action: none;
          /* Leave room for HUD + top controls */
          --jk-board-max: min(78vmin, calc(100dvh - 260px));
        }

        .game-board-container.fullscreen-desktop .game-instructions {
          display: none;
        }

        .game-board-container.fullscreen-desktop .checkpoint-legend {
          display: none;
        }

        .game-board-container.fullscreen-mobile .game-instructions {
          display: none;
        }

        .game-board-container.fullscreen-mobile .checkpoint-legend {
          display: none;
        }

        .game-board-container.fullscreen .game-board {
          width: min(calc(100% - 8px), var(--jk-board-max));
          max-width: min(calc(100% - 8px), var(--jk-board-max));
          align-self: center;
        }

        .game-board-container.fullscreen-mobile .dpad-container {
          margin-top: 0.4rem;
          flex: 0 0 auto;
        }

        .game-board-container.fullscreen-mobile .dpad-btn {
          width: 44px;
          height: 44px;
          font-size: 1rem;
          border-radius: 10px;
        }

        .game-board-container.fullscreen-mobile .dpad-center {
          width: 44px;
          height: 44px;
          font-size: 1.25rem;
        }

        .game-board-container.screen-shake {
          animation: screen-shake 0.4s ease;
        }

        @keyframes screen-shake {
          0%, 100% { transform: translate(0); }
          10% { transform: translate(-4px, -2px); }
          20% { transform: translate(4px, 2px); }
          30% { transform: translate(-3px, 3px); }
          40% { transform: translate(3px, -3px); }
          50% { transform: translate(-2px, 2px); }
          60% { transform: translate(2px, -2px); }
          70% { transform: translate(-1px, 1px); }
          80% { transform: translate(1px, -1px); }
        }

        .game-instructions {
          background: rgba(255, 255, 255, 0.9);
          padding: 0.75rem;
          border-radius: 0.5rem;
          margin-bottom: 0.75rem;
          text-align: center;
        }

        .game-board {
          display: grid;
          gap: 2px;
          background: rgba(0, 0, 0, 0.2);
          padding: 2px;
          box-sizing: border-box;
          border-radius: 0.5rem;
          margin: 0 auto;
          width: min(calc(100% - 8px), var(--jk-board-max));
          aspect-ratio: 1;
        }

        .board-row {
          display: grid;
          /* Allow columns to shrink; prevents right-edge clipping on small viewports */
          grid-template-columns: repeat(10, minmax(0, 1fr));
          gap: 2px;
        }

        .cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          font-size: clamp(1rem, 3.5vw, 2rem);
          border-radius: 4px;
          transition: all 0.2s ease;
          position: relative;
        }

        .cell.path {
          background: #f5f5dc;
        }

        .cell.wall {
          background: #4a2511;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .cell.player {
          background: linear-gradient(135deg, #FCD34D, #F59E0B);
          animation: player-pulse 1s ease-in-out infinite;
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
          z-index: 2;
        }

        /* ===== TRAP CELLS ===== */
        .cell.trap {
          background: #f5f5dc; /* Looks like normal path - hidden trap! */
        }

        .cell.trap.triggered {
          background: linear-gradient(135deg, #FCA5A5, #EF4444);
          animation: trap-flash 0.4s ease;
        }

        @keyframes trap-flash {
          0%, 100% { background: #f5f5dc; }
          25% { background: #EF4444; }
          50% { background: #FCA5A5; }
          75% { background: #EF4444; }
        }

        /* ===== FINISH CELL ===== */
        .cell.finish.unlocked {
          background: linear-gradient(135deg, #FDE68A, #F59E0B, #D97706);
          animation: finish-glow 1.5s ease-in-out infinite;
          box-shadow: 0 0 20px rgba(217, 119, 6, 0.6);
        }

        .cell.finish.locked {
          background: #6B7280;
          opacity: 0.4;
          filter: grayscale(1);
        }

        /* ===== COIN CELL ===== */
        .cell.coin {
          background: linear-gradient(135deg, #FEF3C7, #FDE68A);
          animation: coin-shine 2s ease-in-out infinite;
        }

        @keyframes coin-shine {
          0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.2); }
          50% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); }
        }

        @keyframes finish-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(217, 119, 6, 0.3); }
          50% { box-shadow: 0 0 25px rgba(217, 119, 6, 0.8); }
        }

        /* ===== CHECKPOINT CELLS ===== */
        .cell.checkpoint {
          background: linear-gradient(135deg, #93C5FD, #3B82F6);
          animation: checkpoint-glow 2s ease-in-out infinite;
        }

        .cell.checkpoint.completed {
          background: linear-gradient(135deg, #86EFAC, #10B981);
          animation: none;
          opacity: 0.7;
        }

        .cell.checkpoint.locked {
          background: #9CA3AF;
          opacity: 0.5;
          filter: grayscale(1);
        }

        .cell-content {
          display: block;
          animation: bounce-gentle 2s ease-in-out infinite;
          line-height: 1;
        }

        @keyframes player-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes checkpoint-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
        }

        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        /* ===== D-PAD Controls ===== */
        .dpad-container {
          display: flex;
          justify-content: center;
          margin-top: 0.75rem;
        }

        .dpad {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .dpad-middle-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .dpad-btn {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          border: 2px solid rgba(139, 69, 19, 0.4);
          background: linear-gradient(145deg, rgba(255,255,255,0.9), rgba(245, 222, 179, 0.9));
          color: #4a2511;
          font-size: 1.25rem;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.1s ease;
          box-shadow: 0 3px 6px rgba(0,0,0,0.15);
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .dpad-btn:active {
          transform: scale(0.9);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          background: linear-gradient(145deg, #F59E0B, #FCD34D);
          color: white;
        }

        .dpad-center {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
        }

        /* ===== Checkpoint Legend ===== */
        .checkpoint-legend {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          background: rgba(255, 255, 255, 0.9);
          padding: 0.4rem 0.6rem;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .legend-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
          flex: 1;
        }

        .legend-name {
          font-weight: 600;
          font-size: 0.8rem;
        }

        .legend-questions {
          font-size: 0.7rem;
          opacity: 0.7;
        }

        .legend-item.completed {
          color: #059669;
          background: rgba(134, 239, 172, 0.3);
        }

        .legend-item.unlocked {
          color: #2563EB;
          background: rgba(147, 197, 253, 0.3);
        }

        .legend-item.locked {
          color: #6B7280;
          opacity: 0.6;
        }

        .legend-item.finish-ready {
          color: #D97706;
          background: linear-gradient(135deg, rgba(253, 230, 138, 0.5), rgba(245, 158, 11, 0.3));
          animation: pulse 1.5s ease infinite;
        }

        .legend-emoji {
          font-size: 1.25rem;
          line-height: 1;
        }

        .legend-lock {
          font-size: 0.875rem;
        }

        .legend-check {
          color: #10B981;
          font-size: 0.875rem;
        }

        /* ===== MOBILE (max 640px) ===== */
        @media (max-width: 640px) {
          .game-instructions {
            padding: 0.4rem 0.5rem;
            margin-bottom: 0.5rem;
            border-radius: 0.375rem;
          }

          .game-instructions .text-sm {
            font-size: 0.7rem !important;
            line-height: 1.3;
            margin-bottom: 0.125rem !important;
          }

          .game-instructions .text-xs {
            font-size: 0.6rem !important;
            line-height: 1.3;
          }

          .game-board {
            max-width: 100%;
            gap: 1px;
            padding: 1px;
            border-radius: 0.375rem;
          }

          .board-row {
            gap: 1px;
          }

          .cell {
            font-size: clamp(0.85rem, 6.5vw, 1.5rem);
            border-radius: 2px;
          }

          .cell-content {
            line-height: 1;
          }

          .dpad-container {
            margin-top: 0.5rem;
          }

          .dpad-btn {
            width: 46px;
            height: 46px;
            font-size: 1.1rem;
            border-radius: 10px;
          }

          .dpad-center {
            width: 46px;
            height: 46px;
            font-size: 1.3rem;
          }

          .checkpoint-legend {
            gap: 0.375rem;
            margin-top: 0.5rem;
          }

          .legend-item {
            font-size: 0.65rem;
            padding: 0.3rem 0.4rem;
            gap: 0.25rem;
            border-radius: 0.375rem;
          }

          .legend-emoji {
            font-size: 1rem;
          }

          .legend-name {
            font-size: 0.65rem;
          }

          .legend-questions {
            font-size: 0.55rem;
          }

          .legend-check, .legend-lock {
            font-size: 0.7rem;
          }
        }

        /* ===== VERY SMALL (max 380px) ===== */
        @media (max-width: 380px) {
          .cell {
            font-size: clamp(0.75rem, 6vw, 1.2rem);
          }

          .dpad-btn {
            width: 40px;
            height: 40px;
            font-size: 1rem;
          }

          .dpad-center {
            width: 40px;
            height: 40px;
            font-size: 1.1rem;
          }

          .legend-item {
            padding: 0.25rem 0.35rem;
          }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
      `}</style>
    </div>
  )
}
