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
```

Suggested next: **§1, then §3.1** (cheapest visible gain for B1/B2 learners), with §2 whenever Adam returns to it.

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
