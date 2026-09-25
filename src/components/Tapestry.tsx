import { useId } from 'react'

interface TapestryProps {
  className?: string
}

/**
 * Subtle floral tapestry pattern (the armchairs of the loft café). A "character
 * moment" — use sparingly: home header, lesson-complete card, empty archive.
 * Fills its positioned parent.
 */
export function Tapestry({ className = '' }: TapestryProps) {
  // useId output contains characters that break url(#…) references.
  const id = `tapestry-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <g id={`${id}-flower`}>
          {[45, 225].map((r) => (
            <path key={r} d="M0 -7C3 -10 3 -14 0 -17C-3 -14 -3 -10 0 -7Z" transform={`rotate(${r})`} className="fill-leaf" />
          ))}
          {[0, 90, 180, 270].map((r) => (
            <ellipse key={r} rx="2.8" ry="5" cy="-5" transform={`rotate(${r})`} className="fill-brick" />
          ))}
          <circle r="2.2" className="fill-amber" />
        </g>
        <pattern id={`${id}-tile`} width="56" height="56" patternUnits="userSpaceOnUse">
          <use href={`#${id}-flower`} x="14" y="14" />
          <use href={`#${id}-flower`} x="42" y="42" />
          <circle cx="42" cy="14" r="1.6" className="fill-amber" />
          <circle cx="14" cy="42" r="1.6" className="fill-leaf" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-tile)`} />
    </svg>
  )
}
