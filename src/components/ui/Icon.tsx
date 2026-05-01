import type { SVGProps } from 'react'

export type IconName =
  | 'gamepad'
  | 'compass'
  | 'map'
  | 'pin'
  | 'help'
  | 'headset'
  | 'settings'
  | 'book'
  | 'message'
  | 'bow'
  | 'fist'
  | 'plane'
  | 'target'
  | 'smile'
  | 'clipboard'
  | 'pencil'
  | 'note'
  | 'paperclip'
  | 'send'
  | 'save'
  | 'check'
  | 'x'
  | 'play'
  | 'lock'
  | 'sword'
  | 'door'
  | 'tree'
  | 'temple'
  | 'castle'
  | 'clock'
  | 'maximize'
  | 'minimize'
  | 'volumeOn'
  | 'volumeOff'
  | 'skull'
  | 'coin'
  | 'shield'
  | 'fire'
  | 'wind'
  | 'crown'
  | 'users'
  | 'group'
  | 'repeat'
  | 'chart'
  | 'bolt'
  | 'medal'
  | 'trophy'
  | 'alert'
  | 'rocket'
  | 'swap'
  | 'exit'
  | 'sparkle'
  | 'document'
  | 'hourglass'

export function Icon({
  name,
  size = 'sm',
  className,
  ...svgProps
}: {
  name: IconName
  size?: 'sm' | 'lg'
} & SVGProps<SVGSVGElement>) {
  const svgSize = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'

  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const common = {
    viewBox: '0 0 24 24',
    className: `${svgSize}${className ? ` ${className}` : ''}`,
    ...strokeProps,
    ...svgProps,
  }

  switch (name) {
    case 'gamepad':
      return (
        <svg {...common}>
          <path d="M8 9h8a5 5 0 0 1 5 5v2a3 3 0 0 1-3 3h-1l-2-2H9l-2 2H6a3 3 0 0 1-3-3v-2a5 5 0 0 1 5-5Z" />
          <path d="M8.5 13H6.5" />
          <path d="M7.5 12v2" />
          <path d="M16.5 12.5h.01" />
          <path d="M18 13.5h.01" />
        </svg>
      )
    case 'compass':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 9.2 13 14l-4.8 1.8L10 11l4.8-1.8Z" />
        </svg>
      )
    case 'map':
      return (
        <svg {...common}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'headset':
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0 1 16 0" />
          <path d="M4 12v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Z" />
          <path d="M20 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
          <path d="M12 19v2" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 7h10" />
          <path d="M4 17h16" />
          <path d="M4 12h16" />
          <path d="M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
          <path d="M6 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
          <path d="M12 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 19a2 2 0 0 0 2 2h14" />
          <path d="M6 2h14v16H6a2 2 0 0 0-2 2V4a2 2 0 0 1 2-2Z" />
          <path d="M10 6h6" />
          <path d="M10 10h6" />
        </svg>
      )
    case 'message':
      return (
        <svg {...common}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
          <path d="M8 9h8" />
          <path d="M8 13h6" />
        </svg>
      )
    case 'bow':
      return (
        <svg {...common}>
          <path d="M4 20c8-2 14-8 16-16" />
          <path d="M7 17c5-1 9-5 10-10" />
          <path d="M12 12l8 0" />
          <path d="M18 10l2 2-2 2" />
        </svg>
      )
    case 'fist':
      return (
        <svg {...common}>
          <path d="M7 11V9a2 2 0 0 1 2-2h1v4" />
          <path d="M10 11V7h1a2 2 0 0 1 2 2v2" />
          <path d="M13 11V8h1a2 2 0 0 1 2 2v1" />
          <path d="M16 11V9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7H9a4 4 0 0 1-4-4v-3a3 3 0 0 1 2-3Z" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path d="M22 16l-8-5V3l8 13Z" />
          <path d="M14 11 2 13l12-2Z" />
          <path d="M14 11l-4 10 4-10Z" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 12l7-7" />
          <path d="M17 5h2v2" />
        </svg>
      )
    case 'smile':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
          <path d="M8.5 14c1 1.5 2.5 2.5 3.5 2.5S15 15.5 15.5 14" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg {...common}>
          <path d="M9 4h6" />
          <path d="M10 3h4a2 2 0 0 1 2 2v1H8V5a2 2 0 0 1 2-2Z" />
          <path d="M8 6H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      )
    case 'pencil':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
        </svg>
      )
    case 'note':
      return (
        <svg {...common}>
          <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v4h4" />
          <path d="M8 12h8" />
          <path d="M8 16h8" />
        </svg>
      )
    case 'paperclip':
      return (
        <svg {...common}>
          <path d="M8 12.5 14.5 6a3.5 3.5 0 0 1 5 5L11 19.5a5 5 0 0 1-7-7L12 4.5" />
        </svg>
      )
    case 'send':
      return (
        <svg {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
      )
    case 'save':
      return (
        <svg {...common}>
          <path d="M5 21h14a2 2 0 0 0 2-2V7l-3-3H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          <path d="M8 21v-7h8v7" />
          <path d="M9 4v4h6V4" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common}>
          <path d="M9 7l10 5-10 5V7Z" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <path d="M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
          <path d="M12 15v2" />
        </svg>
      )
    case 'sword':
      return (
        <svg {...common}>
          <path d="M14 3l7 7" />
          <path d="M20 4l-6 6" />
          <path d="M8 12l4 4" />
          <path d="M3 21l6-6" />
          <path d="M7 17l-2 2" />
        </svg>
      )
    case 'door':
      return (
        <svg {...common}>
          <path d="M7 21h10" />
          <path d="M8 21V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17" />
          <path d="M13 12h.01" />
        </svg>
      )
    case 'tree':
      return (
        <svg {...common}>
          <path d="M12 2c-3 3-6 5-6 9a6 6 0 0 0 12 0c0-4-3-6-6-9Z" />
          <path d="M12 17v5" />
          <path d="M9 22h6" />
        </svg>
      )
    case 'temple':
      return (
        <svg {...common}>
          <path d="M3 10h18" />
          <path d="M5 10V7l7-4 7 4v3" />
          <path d="M6 10v9" />
          <path d="M10 10v9" />
          <path d="M14 10v9" />
          <path d="M18 10v9" />
          <path d="M4 19h16" />
        </svg>
      )
    case 'castle':
      return (
        <svg {...common}>
          <path d="M4 21V8l4-2v2l4-2 4 2V6l4 2v13" />
          <path d="M4 21h16" />
          <path d="M9 21v-6h6v6" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l3 2" />
        </svg>
      )
    case 'maximize':
      return (
        <svg {...common}>
          <path d="M8 3H3v5" />
          <path d="M3 3l7 7" />
          <path d="M16 21h5v-5" />
          <path d="M21 21l-7-7" />
        </svg>
      )
    case 'minimize':
      return (
        <svg {...common}>
          <path d="M21 8V3h-5" />
          <path d="M21 3l-7 7" />
          <path d="M3 16v5h5" />
          <path d="M3 21l7-7" />
        </svg>
      )
    case 'volumeOn':
      return (
        <svg {...common}>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15 9a3 3 0 0 1 0 6" />
          <path d="M17 7a6 6 0 0 1 0 10" />
        </svg>
      )
    case 'volumeOff':
      return (
        <svg {...common}>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M16 9l5 6" />
          <path d="M21 9l-5 6" />
        </svg>
      )
    case 'skull':
      return (
        <svg {...common}>
          <path d="M9 16v2" />
          <path d="M15 16v2" />
          <path d="M8 20h8" />
          <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8Z" />
          <path d="M9.5 11a1.5 1.5 0 1 0 0 .01" />
          <path d="M14.5 11a1.5 1.5 0 1 0 0 .01" />
        </svg>
      )
    case 'coin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <path d="M9.5 10.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.7-2.5 1.7-2.5.7-2.5 1.7 1 1.8 2.5 1.8 2.5-.8 2.5-1.8" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2 20 6v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4Z" />
        </svg>
      )
    case 'fire':
      return (
        <svg {...common}>
          <path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-3 2-3 5 0-3-2-4-3-6-1 3-4 5-4 8 0 4 3 7 6 7Z" />
        </svg>
      )
    case 'wind':
      return (
        <svg {...common}>
          <path d="M3 8h10a3 3 0 1 0-3-3" />
          <path d="M3 12h14a3 3 0 1 1-3 3" />
          <path d="M3 16h8a2 2 0 1 1-2 2" />
        </svg>
      )
    case 'crown':
      return (
        <svg {...common}>
          <path d="M4 7l4 5 4-6 4 6 4-5v12H4V7Z" />
          <path d="M4 19h16" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <path d="M12 11a3 3 0 1 0-3-3" />
          <path d="M5 19a5 5 0 0 1 10 0" />
          <path d="M18 8a2.5 2.5 0 1 1 0 5" />
          <path d="M17 19a4 4 0 0 1 4 0" />
        </svg>
      )
    case 'group':
      return (
        <svg {...common}>
          <path d="M17 21a4 4 0 0 0-8 0" />
          <path d="M13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path d="M22 21a4 4 0 0 0-6-3.5" />
          <path d="M18 8a2.5 2.5 0 1 1 0 5" />
        </svg>
      )
    case 'repeat':
      return (
        <svg {...common}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V8a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v3a4 4 0 0 1-4 4H3" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-6" />
          <path d="M12 15v-9" />
          <path d="M16 15v-4" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
        </svg>
      )
    case 'medal':
      return (
        <svg {...common}>
          <circle cx="12" cy="14" r="4" />
          <path d="M8 2h8l-2 6H10L8 2Z" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
          <path d="M6 4H4v3a4 4 0 0 0 4 4" />
          <path d="M18 4h2v3a4 4 0 0 1-4 4" />
          <path d="M12 11v4" />
          <path d="M9 21h6" />
          <path d="M10 15h4" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 3.3 1.9 17.2A2 2 0 0 0 3.6 20h16.8a2 2 0 0 0 1.7-2.8L13.7 3.3a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...common}>
          <path d="M9.5 14.5 7 17l2.5-.5" />
          <path d="M14.5 9.5 17 7l-.5 2.5" />
          <path d="M10 14c2-5 7-10 11-11 1 4-6 12-11 11Z" />
          <path d="M11.5 12.5l0 0" />
        </svg>
      )
    case 'swap':
      return (
        <svg {...common}>
          <path d="M7 7h12" />
          <path d="M16 4l3 3-3 3" />
          <path d="M17 17H5" />
          <path d="M8 20l-3-3 3-3" />
        </svg>
      )
    case 'exit':
      return (
        <svg {...common}>
          <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
          <path d="M14 7l5 5-5 5" />
          <path d="M19 12H10" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" />
        </svg>
      )
    case 'document':
      return (
        <svg {...common}>
          <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v4h4" />
        </svg>
      )
    case 'hourglass':
      return (
        <svg {...common}>
          <path d="M6 2h12" />
          <path d="M6 22h12" />
          <path d="M8 2v4c0 2 2 4 4 6-2 2-4 4-4 6v4" />
          <path d="M16 2v4c0 2-2 4-4 6 2 2 4 4 4 6v4" />
        </svg>
      )
  }
}
