# Navigation and clarity (variant E) — design

2026-11-10. Adam picked variant E of the canvas "SOMOS – návrhy navigácie"
(https://claude.ai/artifact/1x67iPPHkKvbnxWUCWCMZJ): variant A's five tabs plus the clarity changes.
Guided by `docs/product-vision.md` (a customisable textbook; Cesta tracks progress, it does not run the day).

## 1. One name per concept (sk + en)

| Concept | sk | en | Replaces |
|---|---|---|---|
| SRS review of saved, own and practised words | **Kartičky** (Kartičky na dnes, Prejsť kartičky) | **Flashcards** | Opakovanie, Na zopakovanie dnes, Zopakovať (n) |
| Wrong answers kept for later | **Chyby**, action **Opraviť chyby** | Mistakes, **Fix mistakes** | Precvičiť chyby, Zopakovať n chýb |
| A lesson played again | **Ešte raz** (Ešte raz celú lekciu) | **Once more** | Zopakovať lekciu |
| The review step of a Cesta unit | Opakovanie (unchanged) | Review | — |
| The tense tip card | **Ťahák: presente** | **Cheat sheet: presente** | Rýchle opakovanie |
| Cards made from practised words (setting) | **Kartičky z cvičení** | **Flashcards from exercises** | Automatické opakovanie |
| Archív | **Môj slovník** (Uložené · Pridané · Chyby) | **My dictionary** (Saved · Added · Mistakes) | Archív, Môj archív, Moje slová |

## 2. Tab bar

Domov · Hľadať · **Cesta** · Cvičiť · Profil. Cesta in the middle as a raised round button (brick), label below.
Cesta moves to `/path` (`/practice/path` redirects there). Badges: Domov = cards due today, Cvičiť = mistakes.
Archív (`/archive`) belongs to the Profil tab.

## 3. Domov

The hero stays (cards due today, else the next step of Cesta or the lesson to continue). While cards are due,
a neutral row "Ďalej na Ceste: <unit>" sits under the hero, so the next step is never hidden.

## 4. Cvičiť

- Top: **Zmiešané cvičenie**, the one filled (brick) card: 10 tasks of the learner's level, mistakes first,
  least practised next (`prepareLesson` of the level exam). `/practice/lesson?mixed=A1`, usage source `mixed`.
  The level: that of the next Cesta step, else the welcome's level, else A1.
- Then "Pokračovať" (neutral), the shortcuts (Opraviť chyby · Duel · Testy · Gramatika) and the exercise list.
- No Cesta card any more (it has its tab).
- Exercise rows show "2 z 6 lekcií" with a thin bar.
- Ordering: the Naposledy / Moje switch and the arrows open from "Upraviť poradie" under the list.

## 5. Profil

A "Môj slovník" group on top: Uložené · Pridané slová · Chyby, each with its count, opening `/archive?tab=…`.
The Archív card leaves Hľadať.

## Not in this change

Cesta's locked order (open question in the vision), empty states beyond the renames, grammar in search results.
