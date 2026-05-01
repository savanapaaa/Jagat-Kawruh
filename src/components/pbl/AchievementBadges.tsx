import { useMemo } from 'react'
import { Icon, type IconName } from '../ui/Icon'

type BadgeDefinition = {
  id: string
  icon: IconName
  name: string
  description: string
  condition: (ctx: BadgeContext) => boolean
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

type BadgeContext = {
  completedSintaks: number
  totalSintaks: number
  completionPercentage: number
  deadlineStr: string
  progressItems: Array<{
    sintaks_id: string
    completed: boolean
    submitted_at: string | null
    catatan: string | null
    file_path: string | null
  }>
}

type AchievementBadgesProps = {
  completedSintaks: number
  totalSintaks: number
  completionPercentage: number
  deadline: string
  progressItems: Array<{
    sintaks_id: string
    completed: boolean
    submitted_at: string | null
    catatan: string | null
    file_path: string | null
  }>
}

const RARITY_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', glow: '' },
  rare: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', glow: 'shadow-blue-200' },
  epic: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', glow: 'shadow-purple-200' },
  legendary: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', glow: 'shadow-amber-300' },
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Umum',
  rare: 'Langka',
  epic: 'Epik',
  legendary: 'Legendaris',
}

const ALL_BADGES: BadgeDefinition[] = [
  {
    id: 'first-step',
    icon: 'compass',
    name: 'Langkah Pertama',
    description: 'Selesaikan sintaks pertama',
    condition: (ctx) => ctx.completedSintaks >= 1,
    rarity: 'common',
  },
  {
    id: 'halfway',
    icon: 'bolt',
    name: 'Setengah Jalan',
    description: 'Selesaikan minimal 50% sintaks',
    condition: (ctx) => ctx.completionPercentage >= 50,
    rarity: 'common',
  },
  {
    id: 'almost-there',
    icon: 'fire',
    name: 'Hampir Sampai!',
    description: 'Selesaikan minimal 80% sintaks',
    condition: (ctx) => ctx.completionPercentage >= 80,
    rarity: 'rare',
  },
  {
    id: 'all-phases',
    icon: 'sparkle',
    name: 'Penjelajah Sejati',
    description: 'Selesaikan semua sintaks (100%)',
    condition: (ctx) => ctx.completionPercentage === 100,
    rarity: 'epic',
  },
  {
    id: 'documenter',
    icon: 'note',
    name: 'Pendokumentasi',
    description: 'Isi catatan di semua sintaks',
    condition: (ctx) =>
      ctx.progressItems.length > 0 &&
      ctx.progressItems.every((p) => p.catatan && p.catatan.trim().length > 0),
    rarity: 'rare',
  },
  {
    id: 'attachment-master',
    icon: 'paperclip',
    name: 'Rajin Lampiran',
    description: 'Lampirkan file di semua sintaks',
    condition: (ctx) =>
      ctx.progressItems.length > 0 &&
      ctx.progressItems.every((p) => p.file_path != null),
    rarity: 'epic',
  },
  {
    id: 'early-bird',
    icon: 'wind',
    name: 'Early Bird',
    description: 'Selesaikan 100% sebelum deadline',
    condition: (ctx) => {
      if (ctx.completionPercentage < 100) return false
      try {
        const deadline = new Date(ctx.deadlineStr)
        const now = new Date()
        return now < deadline
      } catch {
        return false
      }
    },
    rarity: 'legendary',
  },
]

export default function AchievementBadges({
  completedSintaks,
  totalSintaks,
  completionPercentage,
  deadline,
  progressItems,
}: AchievementBadgesProps) {
  const ctx: BadgeContext = useMemo(
    () => ({
      completedSintaks,
      totalSintaks,
      completionPercentage,
      deadlineStr: deadline,
      progressItems,
    }),
    [completedSintaks, totalSintaks, completionPercentage, deadline, progressItems],
  )

  const badges = useMemo(() => {
    return ALL_BADGES.map((badge) => ({
      ...badge,
      earned: badge.condition(ctx),
    }))
  }, [ctx])

  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Icon name="medal" />
          Achievement Kelompok
        </h2>
        <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
          {earnedCount}/{badges.length} terbuka
        </span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50 p-4 sm:p-5 shadow-inner">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((badge) => {
            const style = RARITY_STYLES[badge.rarity]
            return (
              <div
                key={badge.id}
                className={`
                  relative rounded-xl border-2 p-3 text-center transition-all duration-300
                  ${badge.earned
                    ? `${style.bg} ${style.border} shadow-md ${style.glow}`
                    : 'bg-slate-100/50 border-slate-200 opacity-50 grayscale'
                  }
                  ${badge.earned ? 'hover:scale-105 hover:shadow-lg cursor-default' : ''}
                `}
                title={badge.earned ? `${badge.name} — ${badge.description}` : `??? — ${badge.description}`}
              >
                {/* Rarity indicator */}
                {badge.earned && (
                  <div className={`absolute -top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                    {RARITY_LABELS[badge.rarity]}
                  </div>
                )}

                {/* Icon */}
                <div className={`mb-1.5 flex justify-center ${badge.earned ? '' : 'blur-[2px]'}`}>
                  <Icon
                    name={badge.earned ? badge.icon : 'lock'}
                    className="h-9 w-9 sm:h-10 sm:w-10"
                  />
                </div>

                {/* Name */}
                <div className={`text-xs font-bold leading-tight ${badge.earned ? style.text : 'text-slate-400'}`}>
                  {badge.earned ? badge.name : '???'}
                </div>

                {/* Description */}
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  {badge.description}
                </div>

                {/* Earned sparkle */}
                {badge.earned && badge.rarity === 'legendary' && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    <div className="absolute top-1 left-2 animate-ping" style={{ animationDuration: '2s' }}>
                      <Icon name="sparkle" className="h-4 w-4" />
                    </div>
                    <div
                      className="absolute bottom-2 right-1 animate-ping"
                      style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
                    >
                      <Icon name="sparkle" className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
