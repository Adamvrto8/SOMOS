# SOMOS — product vision

Written 2026-11-10 from Adam's own words. This is the compass for product and UX decisions:
when a feature or layout idea comes up, check it against this page first.

## In one sentence

SOMOS is a **digital textbook** of Mexican Spanish for Slovak speakers: an open dictionary sorted by topics,
many ways to practise, review of what you saved or got wrong, and a way to see your progress. The learner decides
what to do; the app makes every option easy to reach.

## What SOMOS is not

- Not a Duolingo competitor, and it will never try to be one.
- Not a step-by-step course that promises fluency. SOMOS does not plan the learner's day or decide what they must
  learn next.
- No complex game mechanics: no leagues, hearts, energy, paywalled practice or pressure loops. The streak and the
  daily goal stay light and kind (a freeze, not a punishment).

## The pillars

| Pillar | Where | Role in the "textbook" |
|---|---|---|
| **Dictionary** | Hľadať | The open reference: every word, sorted by topics (the chapters), with examples, conjugation and pronunciation. Free browsing, no locks. |
| **Exercises** | Cvičiť | Many exercise types; the learner picks type, topic and level. Practise exactly what you want. |
| **Review** | Kartičky (saved words, SRS), Chyby | Bring back what you saved and what you got wrong. |
| **Cesta** | Cesta | Progress tracking: what you have covered, how far you are in each level, a suggested next step. Like a table of contents with checkmarks, not a forced route. |
| **Duel** | Cvičiť → Duel | The fun part: a quick, light match with a friend. |
| **Grammar** | tips, linked from everywhere | The textbook's explanation pages. |

## Principles

1. **Freedom over guidance.** Suggest, never force. A suggested next step is fine; a locked door the learner
   cannot open is a last resort.
2. **Customisable.** The learner shapes the app: own words, own order of exercises, own daily goal, own level,
   own topics. New settings should serve "what I want to do", not the app's plan.
3. **Everything close.** Any pillar within one tap from the tab bar, any common task within two.
4. **A textbook you can find your way in.** Topics are chapters, tips are pages, Cesta is the table of contents.
   The same thing always has the same name (one word per concept: Kartičky, Chyby, Opakovanie, Test…).
5. **One clear main action per screen,** but the other options stay visible: the learner is never stuck in a flow.
6. **Simple beats clever.** Prefer a plain list or card the learner understands at a glance over a smart
   mechanism they have to learn.

## What this means for open decisions (2026-11-10)

- **Navigation:** Domov stays the hub ("what can I do today": review, continue, word of the day, diary). Cesta should
  be easier to see and to reach (in the tab bar or clearly on Domov), but it is **not** the home screen, because it
  is a tracker, not the course everything revolves around. The navigation mockups (canvas "SOMOS – návrhy
  navigácie", 2026-11-10) are judged by this: variant A (Cesta as a tab) fits the vision better than B (Cesta = Domov).
- **Cesta's locks:** today units open one after another. Under "freedom over guidance" it is worth deciding whether
  every unit should stay open with the next one only *recommended*. Open question for Adam.
- **Out of scope:** a planned daily course ("today do this"), placement tests that lock content, a mascot,
  leagues and other Duolingo-style systems.
- **In scope, fits well:** clearer naming, a visible Archív (own words), badges on tabs for waiting reviews and mistakes,
  a "Zmiešané cvičenie" shortcut, better empty states, more exercise types, duel round 2 (Adam's own design).
