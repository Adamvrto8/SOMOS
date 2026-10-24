# Hlásenia chýb (Sentry) – jednorazové nastavenie

Kým nie je na Verceli nastavená premenná `VITE_SENTRY_DSN` z kroku 4, aplikácia nič neposiela a Sentry sa ani
nenačíta. Postup trvá asi 10 minút. Je zadarmo: po skúšobnej dobe ostane bezplatný plán Developer (5 000 chýb mesačne).

Čo sa posiela: chyba, miesto v kóde, obrazovka a pár krokov pred ňou (ťuknutia, adresy obrazoviek bez parametrov),
verzia aplikácie, prehliadača a systému. Neposiela sa: e-mail, účet, IP adresa (krok 3), konzola, nahrávanie obrazovky,
počty spustení ani to, čo sa učiaci učí. Kód: [`src/lib/errorReports.ts`](../src/lib/errorReports.ts).

## 1. Účet a organizácia

1. Na [sentry.io](https://sentry.io) daj **Get started** (napríklad cez GitHub).
2. Pri zakladaní organizácie vyber **Data Storage Location: European Union**. Neskôr sa to zmeniť nedá
   a stránka Ochrana súkromia sľubuje servery v EÚ.

## 2. Projekt

1. **Create Project** → platforma **React**.
2. Upozornenia nechaj na predvolenom „Alert me on high priority issues“: pri novej chybe ti príde e-mail.
3. Názov projektu napríklad `somos` → **Create Project**.
4. Návod na inštaláciu, ktorý Sentry ukáže, preskoč (kód už je hotový). Skopíruj si z neho iba **DSN**
   (`https://…@o….ingest.de.sentry.io/…`). Neskôr ho nájdeš v **Project Settings → Client Keys (DSN)**.

## 3. Bez IP adries

**Project Settings → Security & Privacy** → zapni **Prevent Storing of IP Addresses**.
Ak ho tam nevidíš, je v **Organization Settings → Security & Privacy**.

## 4. Vercel

1. V Sentry: **Settings → Developer Settings → Organization Tokens** (alebo „Auth Tokens“) → **Create New Token**,
   napríklad `vercel-somos`. Skopíruj ho, zobrazí sa iba raz. Slúži na nahranie source máp pri builde, aby
   hlásenie ukazovalo na skutočné miesto v kóde.
2. Vercel → projekt **somos** → **Settings → Environment Variables**, pre **Production**:

   | Názov | Hodnota |
   |---|---|
   | `VITE_SENTRY_DSN` | DSN z kroku 2 |
   | `SENTRY_AUTH_TOKEN` | token z bodu 1 |
   | `SENTRY_ORG` | skratka organizácie (je v adrese: `https://<org>.sentry.io/…`) |
   | `SENTRY_PROJECT` | `somos` (alebo ako si projekt nazval) |

3. **Deployments** → posledné nasadenie → **⋯ → Redeploy**. Premenné platia až pre nový build.

## 5. Overenie na telefóne

1. Keď je nová verzia na telefóne: Profil → 7× ťukni na verziu dole → **Nástroje pre vývoj**.
2. **Hlásenia chýb → Poslať skúšobnú chybu**.
3. Do pár minút ju uvidíš v Sentry v **Issues** („Test error from Nástroje pre vývoj …“) a príde aj e-mail.
   Riadky kódu v nej majú byť čitateľné (`src/features/settings/DevSettings.tsx`), nie `index-a1b2c3.js`.

Ak namiesto tlačidla vidíš „Hlásenia chýb nie sú zapnuté“, build nedostal `VITE_SENTRY_DSN`:
skontroluj premennú a nasaď znova.
