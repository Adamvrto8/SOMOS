# Accounts and sync — design

Date: 2026-10-19. Approved by Adam in chat ("áno sedí, môžeme podľa plánu implementovať").
Goal: preparation for a public release — everyone can sign in and keeps their own progress history.

## Decisions (Adam's)

- The account is **optional**. Without it the app works as today: offline, on the device only.
- Sign-in: **Google** or **e-mail + 6-digit code** (a code, not a link: a link from an e-mail opens Chrome,
  not the installed PWA). No passwords of our own. Hosted by **Supabase**.
- Sync **record by record** (not the whole backup): deletions travel, only changes are sent.
- **Sign-out** removes the account's data from the device after a last sync; the app starts afresh.
  With changes not sent yet (offline) it warns and waits.
- The first sign-in on a device with progress **merges** it with what the account has on the server.

## What syncs

| Kind | Source | Key | Conflict rule |
|---|---|---|---|
| `customWord` | Dexie `customWords` | id | last change wins |
| `saved` | Dexie `savedItems` | `itemType:itemId` | last change wins, deletes travel |
| `card` | Dexie `reviewCards` | `itemType:itemId` | last change wins, deletes travel |
| `attempt` | Dexie `attempts` | `at|exercise|itemId` | append only |
| `mistake` | Dexie `mistakes` | `exercise:itemId` | last change wins, deletes travel |
| `lesson` | localStorage lesson progression | lesson key | better record wins (`mergeProgression`) |
| `test` | localStorage test results | test key | better record wins (`mergeTestResults`) |
| `settings` | `SettingsBackup` without `reminder` | `settings` | last change wins |

Not synced: the reminder (it belongs to a phone), the DeepL cache, the active-lesson memory, the TTS voice.

## How

- The device stays the source of truth; the server holds a copy shared by the devices of one account.
- **Dexie tables**: Dexie hooks (creating / updating / deleting) note the changed key in an `outbox` table
  once the transaction completes. Changes applied from the server run in transactions marked as remote and
  are not noted. At push time the current row is read (missing → tombstone).
- **localStorage stores** (lessons, tests, settings): compared at sync time with the last state known to be
  on the server (`somos-sync-state`); what differs is pushed.
- **Server**: one table `records (user_id, kind, key, data jsonb, deleted, changed_at, rev)`, row level
  security `user_id = auth.uid()`, `rev` from a sequence for the pull cursor (no clock skew), a function
  `push_records(jsonb)` that keeps the newer `changed_at`, and `delete_my_account()` (security definer).
- **One sync round**: pull `rev > cursor` in pages → apply (skipping rows whose local pending change is newer)
  → push the outbox and store diffs in batches → save cursor and state.
- **When**: at start, after sign-in, when the app returns to the foreground, when the device goes online,
  and a few seconds after a local change. One round at a time.
- **First sign-in** (adopting the device's progress): every local row goes to the outbox with time 0, so on
  the same key the server's version wins and everything new on the device is uploaded; lessons and tests
  merge by the better result.
- `@supabase/supabase-js` is loaded only when signing in or signed in (dynamic import); a marker in
  localStorage (`somos-account`) says to load it at start. PKCE flow for Google; `verifyOtp` for the code.

## Screens

- **Nastavenia → Účet** (top): signed out — "Prihlásiť sa" + what an account is for; signed in — e-mail,
  sync state (synced n min ago / offline, sends later / error), "Odhlásiť sa", "Zmazať účet".
- **Prihlásenie** (`/archive/account`): "Pokračovať cez Google"; or e-mail → "Poslať kód" → 6-digit code.
- **Ochrana súkromia** (`/privacy`), linked from the sign-in screen. Draft by Claude, Adam reviews.
- Backup export / import stay as they are.

## Sign-out and deletion

- Sign-out: sync round; if the outbox or diffs are not empty after it (offline), ask
  "Niektoré zmeny ešte nie sú odoslané" with "Počkať" / "Odhlásiť aj tak". Then clear the learner tables and
  stores, the sync state and the session, and reload. Device settings (theme, look, language, sound) stay.
- Deletion: confirm → `delete_my_account()` → the same local wipe.
- One account per device at a time.

## Adam's one-time setup (a guide in docs/accounts-setup.md)

Supabase project + SQL from `supabase/schema.sql`; Google Cloud OAuth client; Resend as SMTP with the
code e-mail template; Vercel env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public; RLS protects data).

## Not in this project

Reminder per user, DeepL limit per user, store listing, paid plans and commercial terms.

## Testing

Unit tests of the sync engine with `fake-indexeddb` and an in-memory server (merge, conflicts, deletions,
adoption, pending changes at sign-out); Playwright for the screens with the Supabase endpoints mocked.
On the phone: the return from Google sign-in into the installed PWA (cannot be tested on the desktop).
