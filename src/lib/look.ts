// The style of the app: its colours and typefaces (src/styles/tokens.css), each with a light and a
// dark side. Kept apart from theme.ts, which touches the browser, so the backup can read it anywhere.

export const LOOKS = ['classic', 'talavera'] as const
export type Look = (typeof LOOKS)[number]

export const parseLook = (value: unknown): Look | undefined => LOOKS.find((look) => look === value)
