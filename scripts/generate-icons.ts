// Generates the app icon set from a single SVG definition.
// Run with `npm run icons` (Node 24 strips TS types natively); outputs are committed.
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Colors from src/styles/tokens.css (light theme).
const BRICK = '#B5553C'
const CONCRETE = '#F4F1EC'

// "S" from Fraunces SemiBold (opsz 144), extracted with opentype.js at size 100
// and translated so its bounding box starts at (0, 0). Keeps the SVG font-independent.
const S_WIDTH = 49.33
const S_HEIGHT = 72.45
const S_PATH =
  'M26.55 72.25Q21.90 72.25 18.93 70.90Q15.95 69.55 14.30 68.23Q12.65 66.90 12.05 66.90Q11.70 66.90 10.93 67.73Q10.15 68.55 9.25 69.65Q8.35 70.75 7.58 71.60Q6.80 72.45 6.35 72.45Q6.05 72.45 5.75 72.20Q5.45 71.95 5.35 71.60L1.55 50.05Q1.50 49.75 1.52 49.58Q1.55 49.40 1.65 49.35Q1.80 49.25 1.98 49.35Q2.15 49.45 2.25 49.65Q6.45 58.20 10.38 62.90Q14.30 67.60 18.05 69.45Q21.80 71.30 25.45 71.30Q30.90 71.30 34.13 68.33Q37.35 65.35 37.35 59.60Q37.35 56.10 35.90 53.15Q34.45 50.20 30.98 47.67Q27.50 45.15 21.50 43Q13.60 40.20 8.90 36.83Q4.20 33.45 2.10 29.38Q0 25.30 0 20.20Q0 14.25 3.02 9.75Q6.05 5.25 11.30 2.72Q16.55 0.20 23.30 0.20Q27.50 0.20 30.25 1.22Q33 2.25 34.60 3.28Q36.20 4.30 36.95 4.30Q37.60 4.30 38.93 3.22Q40.25 2.15 41.50 1.08Q42.75 0 43.25 0Q43.50 0 43.70 0.15Q43.90 0.30 44 0.65L49.30 22.10Q49.35 22.40 49.33 22.55Q49.30 22.70 49.20 22.80Q49.10 22.85 48.93 22.77Q48.75 22.70 48.60 22.50Q44.10 14.10 40.05 9.48Q36 4.85 32.10 3Q28.20 1.15 24.15 1.15Q18.95 1.15 15.58 4.53Q12.20 7.90 12.20 13.80Q12.20 17.45 13.58 20.50Q14.95 23.55 18.27 26.08Q21.60 28.60 27.35 30.75Q35.60 33.70 40.33 37.05Q45.05 40.40 47.05 44.30Q49.05 48.20 49.05 52.90Q49.05 58.30 46.38 62.68Q43.70 67.05 38.68 69.65Q33.65 72.25 26.55 72.25'

// Layout on a 512 canvas: the "S" centered, like the "somos" wordmark.
const CANVAS = 512
const GLYPH_HEIGHT = 300
const GLYPH_SCALE = GLYPH_HEIGHT / S_HEIGHT
const GLYPH_WIDTH = S_WIDTH * GLYPH_SCALE
const GLYPH_X = (CANVAS - GLYPH_WIDTH) / 2
const GLYPH_Y = (CANVAS - GLYPH_HEIGHT) / 2

const round = (n: number) => Math.round(n * 100) / 100

interface IconOptions {
  // Rounded tile with transparent corners ("any"), or full-bleed square (maskable, iOS).
  rounded: boolean
  // Shrinks the content toward the center, e.g. to fit the maskable safe zone.
  contentScale: number
}

function iconSvg({ rounded, contentScale }: IconOptions): string {
  const radius = rounded ? 112 : 0
  const c = CANVAS / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" rx="${radius}" fill="${BRICK}"/>
  <g transform="translate(${c} ${c}) scale(${contentScale}) translate(${-c} ${-c})">
    <path transform="translate(${round(GLYPH_X)} ${round(GLYPH_Y)}) scale(${round(GLYPH_SCALE)})" fill="${CONCRETE}" d="${S_PATH}"/>
  </g>
</svg>
`
}

// Android status-bar badge: only the alpha channel is shown, so a white "S" on transparency.
function badgeSvg(): string {
  const height = 400
  const scale = height / S_HEIGHT
  const x = (CANVAS - S_WIDTH * scale) / 2
  const y = (CANVAS - height) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <path transform="translate(${round(x)} ${round(y)}) scale(${round(scale)})" fill="#FFFFFF" d="${S_PATH}"/>
</svg>
`
}

async function renderPng(svg: string, size: number, file: string) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${file}`)
  console.log(`public/${file}`)
}

const anyIcon = iconSvg({ rounded: true, contentScale: 1 })
// Maskable safe zone is a centered circle with 40% radius; 0.8 leaves a margin.
const maskableIcon = iconSvg({ rounded: false, contentScale: 0.8 })
const appleIcon = iconSvg({ rounded: false, contentScale: 0.9 })

await writeFile('public/favicon.svg', anyIcon)
console.log('public/favicon.svg')
await renderPng(anyIcon, 192, 'pwa-192x192.png')
await renderPng(anyIcon, 512, 'pwa-512x512.png')
await renderPng(maskableIcon, 512, 'maskable-icon-512x512.png')
await renderPng(appleIcon, 180, 'apple-touch-icon-180x180.png')
await renderPng(badgeSvg(), 96, 'badge-96x96.png')
