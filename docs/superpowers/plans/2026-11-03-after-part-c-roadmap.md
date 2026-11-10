# After part C: roadmap

Written 2026-11-03, after steps 1–4 of part C went live (`main` 883a5f8). This is a roadmap, not an implementation
plan: each step has a goal, scope, size and an exit check. A step that gets built first gets its own spec and plan
(superpowers:brainstorming → writing-plans), as steps 1–4 did.

Sizes: **S** = one session inline, **M** = a plan of 3–6 tasks, **L** = several plans or bulk content with batches.

## Status update (2026-11-06)

- §2 step 5 (sources database): done, merged (a75b82a).
- §3.1: done. 6100629 (2026-11-05) added 347 second blanks and `scripts/report-blanks.ts`; fc73d15 (2026-11-06) fixed the
  last 58 B2 sentences that blanked the trigger word (aunque, ojalá…) instead of the form, and added the relatives rules
  quien and cuyo. Report: B1 125/125, B2 310/310.
- §3.2: done in 4d4a68c (2026-11-05): 196 longer B2 sentences, B2 average 10.2 words, 59 % with a subordinate clause.
- Adam's direction (2026-11-06): product first, no deadline; publishing and the release track (§6) wait. His scope for the
  complete product: content quality, guided path + duel round 2 (his design), the Spain variant. §5 not chosen for now.
- 2026-11-07: Cesta phase 3 (Viem to button, level offer after the first lesson, level celebration) built on branch
  `path-phase-3` (docs/guided-path-spec.md §10c).
- 2026-11-07: Adam added five product items (§4a): matching on the whole screen, sorting exercises, notes in Spanish,
  a new page layout, and a reorganised grammar section drawn from his literature list.
- 2026-11-07: §4a.1 and §4a.2 pushed to main (2859816, CI green).
- 2026-11-07: §4a.3 Denník pushed to main (8c00164; spec 2026-11-07-diary-design.md), Supabase SQL run by Adam,
  828 unit + 121 e2e green.
  Default order: recency; own order arranged with up/down arrows (no dragging).
- 2026-11-09: §1.2 done. Adam tested everything pushed so far on his phone (new exercise types, Cesta phase 3,
  §4a.1–4a.3, Spain variant, tense recap card): all fine. §3.3 closes with nothing asked; §1.4 minors stay deferred.
  Visual details will be tuned in a later overall **visual rebrand** (new item, Adam's design).
- 2026-11-09: §4a.5 started. Step 1, the literature list, is done:
  `docs/reports/Akademické zdroje pre španielčinu.md` (14 core works; notes in `docs/research_notes/`). The full PCIC is kept
  as Markdown from an archived copy, because CVC was down.
  Step 2, the gap analysis, is done: `docs/grammar-gap-analysis.md` (5 level mismatches, 48 gaps, 35 American notes).
  Tips now cite PCIC sections and the NGLE (new source `ngle`). Next: Adam's decisions (futuro/ir a, progresivo A1,
  splitting B2 tips), then the new structure and content in batches.
- 2026-11-09: §4a.5 part A1 (levels after the PCIC) built, uncommitted: 33 tips (ir-a A2 / futuro B1, and B1/B2 splits of
  subjuntivo-clauses, relatives, passive-se), 37 sentences rewritten to ir a, 96 new sentences, drill levels, 19 Cesta units.
  Spec 2026-11-09-grammar-levels-design.md. Next parts: A2 (new A1–A2 tips), A3 (B1–B2 gaps), A4 (variants.mx), B (grammar screen).
- 2026-11-09: §4a.5 part A2 built, uncommitted: 5 new tips (demonstratives, possessives, interrogatives A1; negation,
  personal-a A2), 170 blanks retagged or added, 49 new sentences, 10 Cesta units. Spec 2026-11-09-grammar-a1-a2-tips-design.md.
- 2026-11-10: §4a.5 parts A3 + A4 built, uncommitted: 11 new B1–B2 tips (49 in all), 158 new sentences, 22 Cesta units, variants.mx notes
  from the PCIC, seven loose hints. Spec 2026-11-10-grammar-b1-b2-tips-design.md. Next: B (grammar screen).

## 0. State today

| Part C step (from the content review of 2026-11-03) | State |
|---|---|
| 1 Grammar B1–B2 and A1–A2 gaps (28 tips, new tenses on all verbs) | done, live |
| 2 Sentences for the new points (346 new, 88 old with a usage blank, 22 path units) | done, live |
| 3 More varied blanks (227 on prepositions, conjunctions, pronouns, demonstratives) | done, live |
| 4 New exercise types: pravda/nepravda, nájdi chybu, priraďovanie | done, live, **not yet tried on a phone** |
| 5 Sources database | done, live (a75b82a, 2026-11-06) |

Totals now: 1681 words, 283 verbs, 1971 sentences (2316 blanks), 28 tips, 11 exercises in Cvičiť.

## 1. Close-out (do first, all S)

1. Adam: update `CLAUDE.md` (§1.4 still lists five exercise types; add the three new ones, the totals above, part C steps 1–4).
2. Adam: try the new exercises on the phone (swipe feel, 80 px threshold, card tilt; matching chip size and 4 rounds;
   any "false" sentence that reads as correct — use Nahlásiť chybu). Feedback decides step 3.3 below.
3. Claude: tidy the repo — remove the worktrees `SOMOS-vb2` and `SOMOS-varied-blanks`, the branches
   `grammar-varied-blanks-v2` and `grammar-varied-blanks`, and `.superpowers/sdd/`; update the memory notes
   (grammar-b1-b2 is now "steps 1–4 live").
4. Deferred minors from the review (only if the phone test shows they matter): findmistake tasks with 2 options
   (53 of 1968), `taskFromItem('matching')` accepting a hand-made id with fewer than 5 words, a tap-target check on
   one-letter tokens in findmistake.

Exit check: CLAUDE.md matches the app; Adam has seen all three exercises; no stray worktrees.

## 2. Step 5 — sources database (M)

Goal: one record per grammar point, so tips, sentences and future content point to the same checked source.
Fields (from the review §4.5): CEFR level by the Plan Curricular del Instituto Cervantes, the rule in our own words
in Slovak, examples, a Mexican note, source links, ideas for exercises.

- Tips already carry a source line each (step 1), so this step **collects and structures**, it does not search again.
- Never copy textbook text (copyright): store a pointer to the chapter plus our own explanation.
- Scope for the first plan: data file + type + `validate:data` checks (every tip has a record; level valid; at least
  one source; no `vosotros`; Spain-only wording rejected like elsewhere). Whether Profil / a dev page shows it is a
  decision for the spec, default: no UI.
- Depends on nothing; can run in parallel with step 3 only if the two never touch the same files (tips data vs sentences).

Exit check: `validate:data` fails when a tip has no record; every one of the 28 tips has one.

## 3. Content quality (L, in this order)

3.1 **B1/B2 blanks that test the B1/B2 point** (M). The review's example: B2 sentence "Aunque me duela admitirlo, ya no
tengo la condición de antes" blanks `tengo`, not `duela`. Method: a script lists sentences tagged with a B1+ point
whose only blank is a plain A1 form; Sonnet batches add a second blank on the point (hint-only, or with a `tip`).
Exit: report script shows the share of B1/B2 blanks on the level's own grammar before/after; validator green.

3.2 **Longer B2 sentences with subordinate clauses** (L). Average length is 5.7 (A1) → 9.4 (B2) words; B2 should
routinely have clauses. Add sentences per B2 topic, each with Slovak and English, blank on the clause's point.
Exit: B2 average length and the share of sentences with a subordinate clause are written in the plan and met;
every topic × B2 still has at least 20.

3.3 **Follow-up on the new exercises** (M, gated on the phone feedback from §1.2). Candidates the spec left out on
purpose: level exams and topic tests using the new types, path units using them, a tip per type, review (SRS) cards.
Do only what Adam's feedback asks for.

## 4. Native-speaker check — the gate before a public release (M tooling, then human time)

All content was written by Claude and never checked by a native speaker. The new exercises make this more
important (they show deliberately broken sentences).
- Tooling (Claude): export a review pack per topic × level (Spanish, Slovak, English, blanks, tips) in a format a
  reviewer can mark up; a way to import their corrections as one reviewed batch; a "reviewed" marker if Adam wants one.
- Human (Adam): find the reviewer, decide the scope (all 1971 sentences or the B1/B2 and tip texts first).
- Include the open reports from Nahlásiť chybu.

Exit check: reviewed content merged, `validate:data` green, the list of changed ids in the commit message.

## 4a. Adam's additions (2026-11-07)

Part of the product scope ("product first"), each gets its own spec before it is built. Cheapest first:

1. **Matching on the whole screen** (S). Priraďovanie today uses only the top half of the screen; the chips and
   rounds should fill the screen at 375 px, like the full-screen pravda/nepravda run.
   Exit: matching fills the viewport on a phone, chips stay ≥44 px, e2e green.
2. **Sort the exercises in Cvičiť** (S–M). Two orders the learner can switch between: by recency (the exercise
   played last is first, the one played longest ago last; recency comes from the attempts) or by hand (the learner
   drags them into his own order; the order is stored and synced with the account).
   Exit: both orders work and survive a reload and a sign-in on another device.
3. **Notes in Spanish** (M). Decided 2026-11-07: a diary first (one entry per day); free notes beside it later
   (Adam's wish, not in the first version). A place to write: what I learned today, or a few sentences in Spanish about what I did.
   Open questions for the spec: one note per day (a diary) or free notes; any check of the Spanish (offline only:
   e.g. unknown words marked from `knownForms`, nothing paid); a link from Domov or the daily goal; saved in Dexie,
   synced and in the backup like the archive.
4. **New page layout** (M–L, Adam's design first). For example Domov in the middle and the other pages to the sides
   (swipe between them) instead of today's bottom tab bar order. Touches navigation everywhere, so it needs Adam's
   sketch and a spec before any code; check it against the keyboard behaviour and the lesson player.
5. **Reorganise the grammar section** (L, gated on Adam's literature list). Goals: clearer structure, information
   easy to find (search over tips, grouping by level and grammar area, links between related points), and more
   comprehensive content. Content is drawn from **Adam's complete literature list**, which he will provide: it
   extends `src/data/sources.json`, every tip points to its sources, and the same rules apply as in §2 (own words,
   never copied textbook text, Mexican note, Spain variant). Order: the list → a gap analysis (which points the
   literature covers and the 28+ tips do not) → the new structure → content in batches with `validate:data`.

## 5. More exercise types (each its own spec)

In the order the review proposed, cheapest first:
1. **Listening comprehension** (hear a sentence, pick the Slovak meaning): needs no new data, uses TTS; keep
   dictation as is.
2. **Rewrite the sentence** (`Compro el pan → Lo compro`): needs new data per grammar point.
3. **Dialogues and short stories with questions**: the most expensive, a lot of new content; only after §4.
Conversation with an AI is out of scope (paid, not offline).

## 6. Release track (Adam leads, Claude supports)

- Audio recordings in es-MX: designed on 2026-11-03, postponed by Adam until the public release (his four decisions are
  in the memory note `audio-recordings`).
- Google Play: the package is ready, waiting for his developer account and the two SHA-256 fingerprints for assetlinks.
- iPhone: tested on Android only; push, speech recognition and installing differ on iOS.
- Legal and hosting: privacy policy exists; paid Vercel (Hobby is non-commercial) and DeepL terms for commercial use.
- Duel round 2 and the guided path's next phase: Adam brings his own design / decides (spec `docs/guided-path-spec.md`).

## 7. Order and gates

```
§1 close-out ──► §2 step 5 ─┐
      │                      ├─► §4 native check ─► §6 release track
      └──────► §3.1, §3.2 ───┘
      └──────► §3.3 (after phone feedback) ──► §5 new exercise types

§4a.1 matching full screen ─► §4a.2 sorting ─► §4a.3 notes      (independent, any time)
§4a.4 layout                ◄── Adam's sketch
§4a.5 grammar reorganisation ◄── Adam's literature list ─► feeds §4 native check (tips)
```

Suggested next (2026-11-07): §1 (phone tests), then **§4a.1 and §4a.2** (small, visible), §4a.3 after its spec.
§3.1, §3.2 and §2 are done.

## 8. How the work is run (unchanged from CLAUDE.md §9)

One step at a time, in its own worktree and branch from `main`; Sonnet for bulk content and implementers, at most 2
agents at once, the controller keeps design and integration; `validate:data`, `npm test`, `npm run build` and
`E2E_PORT=5299 npm run test:e2e -- --workers=3` before a merge; one whole-branch review before a push; never push or
merge without Adam's word; stage explicit paths and never `CLAUDE.md`, `poznaky.txt`, `.gitignore`, `Design/`.

## Decisions Adam needs to make

1. Run §3.1 before §2, or the other way round?
2. Native-speaker check: who, and for how much content?
3. Is a "reviewed" marker on content wanted, or is the commit history enough?
4. Does step 5 get a UI (a sources page), or stay data-only?
5. §4a.2: which order is the default, recency or his own?
6. §4a.3: a daily diary or free notes; any checking of the Spanish?
7. §4a.4: the sketch of the new layout (which pages sit left and right of Domov).
8. §4a.5: the literature list, and whether the grammar page gets its own search or shares Hľadať.
