# App tour (spotlight walkthrough) — design

Date: 2026-11-17. Status: awaiting Adam's review.

## Goal

A learner who has just finished the welcome and the first lesson gets, once, an optional short tour of the app:
the screen darkens and the parts of Domov (and the tab bar) are highlighted one by one, each with a short text
saying what it is and what it does. The learner chooses whether to take it and can skip it at any moment.

Works with or without an account (the account is optional in SOMOS), offline, in Slovak and English.

## Decisions (from the brainstorming, 2026-11-17)

- **Trigger:** the first time the learner reaches Domov after the welcome and the first lesson. Not after sign-in
  (many learners have no account), not before the first lesson (it would take them away from the lesson the welcome leads to).
- **Scope:** the whole tour runs on Domov. No navigation to other screens: Hľadať, Cesta, Cvičiť and Profil are
  explained by highlighting their tab icons.
- **Implementation:** own small component, no library (no new dependency, fits tokens, dark mode, i18n, offline PWA).
- **Replay:** a row "Zopakovať zoznámenie" in Profil, and in Nástroje pre vývoj.
- **Usage numbers:** anonymous `track('tour', …)` events, like `track('welcome', …)`.

## Flow

1. Domov is shown for the first time after the first lesson → an **offer card** appears at the top of Domov:
   "Chceš krátke zoznámenie s appkou?" with **Áno, ukáž mi** and **Nie, vďaka**.
2. **Nie, vďaka** → stored, the card never comes back by itself (the replay row in Profil stays).
3. **Áno** → the tour starts: dark overlay, one highlighted target with a text bubble, **Ďalej / Späť**, step dots,
   **Preskočiť** always visible. The last step has **Hotovo**.
4. Finishing or skipping stores the outcome; the tour does not start again by itself.

Devices that already have progress (`hasHistory()`, the same rule as `shouldOnboard()`) are marked as offered
and never see the card.

## Steps

Each step: one target (`data-tour` id), a title, 1–2 sentences. Texts live in `src/i18n/sk.ts` and `en.ts`
(Slovak is the source, English follows the existing overlay conventions).

| # | Target | Says |
|---|---|---|
| 1 | Domov cards (review card, streak/daily goal, word of the day) | What Domov shows; the cards can be tapped to go further |
| 2 | SOMO pill | The assistant: answers questions about Spanish and about the app |
| 3 | Tab Hľadať | Dictionary, verbs and conjugation, topics |
| 4 | Tab Cesta | Progress by levels, what comes next |
| 5 | Tab Cvičiť | Exercise types, tests |
| 6 | Tab Profil | Statistics and settings: goal, reminder, voice, backup, account |

A step whose target is not on screen (e.g. SOMO hidden by `somoVisibility`) is skipped; the dots reflect the
steps actually shown.

## Architecture

Small units, one purpose each:

- `src/lib/tour.ts` — state and pure logic. Extends `OnboardingState` in `src/lib/onboarding.ts` with
  `tourOffered?: boolean` and `tourDone?: 'finished' | 'skipped' | 'declined'` (stored in the existing
  `somos-onboarding` localStorage key, this device only, not synced, not in the backup). Exports
  `shouldOfferTour(state, lessonDone)`, `TOUR_STEPS` (id, target, i18n key), `visibleSteps(present: Set<string>)`,
  `startTour()` for the replay row.
- `src/features/tour/TourOffer.tsx` — the offer card on Domov.
- `src/features/tour/TourOverlay.tsx` — the overlay: finds the target with
  `document.querySelector('[data-tour="…"]')`, measures `getBoundingClientRect()`, draws the dark layer with a
  rounded cut-out (a big `box-shadow` on a positioned box, or an SVG mask), places the bubble above or below the
  target so it stays inside the 480px column and the safe areas, recomputes on resize / scroll / keyboard
  `visualViewport` change, scrolls the target into view first (Domov cards).
- `data-tour` attributes added to: `ReviewCard`/progress cards on Domov, the SOMO pill, and the five tab links in
  `TabBar.tsx`. No other behaviour of those components changes.
- Domov (`HomePage.tsx`) renders `TourOffer` and `TourOverlay` conditionally; nothing else knows about the tour.

### Behaviour details

- The overlay blocks taps on the page behind it (the highlighted target is not clickable either; the tour is a
  tour, not a shortcut).
- Escape and the phone's Back button close the tour as "skipped" (Back must not leave Domov).
- Focus moves into the bubble and is trapped there; the bubble is `role="dialog"` with `aria-labelledby`/`describedby`;
  the highlighted target is described to screen readers by the bubble text.
- `prefers-reduced-motion`: no sliding between steps, only a fade.
- The bottom tab bar is `fixed z-20`; the overlay sits above it (z higher than the bar and the SOMO pill).
- If the keyboard opens (`keyboard:` variant), the tour is not affected (no inputs on the steps).

## Replay

Profil: a row "Zopakovať zoznámenie" (opens Domov and starts the tour). Nástroje pre vývoj: "Zoznámenie znova"
resets `tourOffered`/`tourDone` so the offer card comes again. Replaying does not change the welcome state.

## Usage numbers

`track('tour', { step: 'offered' | 'declined' | 'started' | 'step-<n>' | 'skipped' | 'finished' })`, through the
existing `src/lib/usage.ts` (anonymous, no personal data). The privacy page already covers anonymous usage numbers;
`usageReport` gets the new event name if it whitelists names.

## Testing

- Unit (`tour.test.ts`): `shouldOfferTour` (new learner after the first lesson yes; done/declined no; device with
  history no), `visibleSteps` drops missing targets, state parsing of the new fields (bad values ignored, like
  `parseOnboardingForTesting`).
- E2E (Playwright, 375px): after the first lesson Domov shows the offer; Áno → all six steps through → no offer on
  reload; Nie, vďaka → no offer on reload; Preskočiť in step 3 → stays closed; replay from Profil works; no overlay
  for a device with history. Run with `E2E_PORT=5299 npm run test:e2e` when another copy is running.
- Manual on the phone: highlight placement on the real tab bar with the safe area, dark theme, Slovak and English.

## Out of scope

- Touring other screens (Hľadať, Cesta, Cvičiť, Profil internals) — a possible later step B.
- Per-feature hints that appear on first use of a screen.
- Videos or animations in the bubbles.

## Open points (none blocking)

- Exact Slovak/English wording of the six texts: drafted during the implementation, Adam reads them on the phone.
