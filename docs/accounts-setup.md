# Účty v SOMOS – jednorazové nastavenie

Kým nie sú na Verceli nastavené dve premenné z kroku 5, appka sa správa ako doteraz a sekcia
„Účet“ sa v Nastaveniach vôbec neukáže. Postup trvá asi 30–45 minút. Všetko je zadarmo.

## 1. Projekt v Supabase

1. Na [supabase.com](https://supabase.com) sa prihlás (napr. cez GitHub) a daj **New project**.
   - Name: `somos`
   - Region: **Central EU (Frankfurt)**: dáta ostanú v EÚ, ako sľubuje stránka Ochrana súkromia.
   - Database password: vygeneruj a ulož si ho (appka ho nepotrebuje).
2. Keď je projekt hotový: **SQL Editor** → **New query** → vlož celý obsah súboru
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Má skončiť „Success. No rows returned“.
3. **Project Settings → API Keys** (alebo „API“): skopíruj si
   - **Project URL** (`https://xxxx.supabase.co`),
   - verejný kľúč: **anon public** (starší názov) alebo **publishable** (`sb_publishable_…`).

   Tajný kľúč (`service_role` / `secret`) **nikam nekopíruj**, appka ho nepotrebuje.

## 2. Adresy, kam sa appka vracia

**Authentication → URL Configuration**:

- Site URL: `https://somos-jade.vercel.app`
- Redirect URLs (pridaj obe):
  - `https://somos-jade.vercel.app/archive/account`
  - `http://localhost:5173/archive/account` (na skúšanie na PC)

## 3. Prihlásenie kódom z e-mailu

1. **Authentication → Sign In / Providers → Email**: zapnuté (býva predvolene). Email OTP Length nechaj **6**.
2. **Authentication → Emails → Templates**: v šablónach **Magic Link** aj **Confirm signup**
   (prvá ide známym používateľom, druhá novým) nahraď obsah týmto:

   ```html
   <h2>Tvoj kód do SOMOS</h2>
   <p>Prepíš tento kód do aplikácie:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Ak si sa neprihlasoval, e-mail ignoruj.</p>
   ```

   Predmet napr. `Kód do SOMOS: {{ .Token }}`.
3. **Kto dostane e-mail.** Vstavané e-maily Supabase chodia iba členom tvojho tímu v Supabase (teda
   tebe) a len pár za hodinu. Na prvé vyskúšanie to stačí. Pre ďalších ľudí treba vlastný odosielateľ,
   **Authentication → Emails → SMTP Settings**:
   - teraz zadarmo: **Gmail** s heslom pre aplikácie (Google účet → Zabezpečenie → dvojstupňové
     overenie → Heslá aplikácií): Host `smtp.gmail.com`, Port `465`, Username = tvoj Gmail,
     Password = heslo pre aplikácie, Sender = tvoj Gmail. Limit je asi 500 e-mailov denne.
   - pred zverejnením: vlastná doména (asi 10 € ročne) a služba ako Resend (3 000 e-mailov mesačne
     zadarmo). Resend bez overenej domény posiela iba majiteľovi účtu.

## 4. Prihlásenie cez Google

1. [console.cloud.google.com](https://console.cloud.google.com) → nový projekt `SOMOS`.
2. **Google Auth Platform → Branding** (predtým „OAuth consent screen“):
   - App name `SOMOS`, support e-mail tvoj,
   - App home page `https://somos-jade.vercel.app`,
   - Privacy policy `https://somos-jade.vercel.app/privacy`,
   - Authorized domains: `somos-jade.vercel.app` a `supabase.co`.
3. **Audience**: External. Kým je appka v stave **Testing**, prihlásia sa len ľudia pridaní medzi
   **Test users** (pridaj seba). Pre všetkých daj **Publish app**. Appka chce iba e-mail a meno, takže
   overenie Googlom netreba.
4. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://somos-jade.vercel.app`
   - Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback` (tvoja Project URL z kroku 1 + `/auth/v1/callback`)
   - Skopíruj **Client ID** a **Client secret**.
5. V Supabase **Authentication → Sign In / Providers → Google**: zapni, vlož Client ID a Client secret, ulož.

## 5. Vercel

**Vercel → projekt somos → Settings → Environment Variables**, pre Production aj Preview:

| Názov | Hodnota |
|---|---|
| `VITE_SUPABASE_URL` | Project URL z kroku 1 |
| `VITE_SUPABASE_ANON_KEY` | verejný kľúč z kroku 1 (anon / publishable) |

Potom **Deployments → posledný → Redeploy**. Premenné sa dostanú do appky až pri builde.

Na PC: rovnaké dva riadky do súboru `.env.local` v koreni projektu (git ho ignoruje) a reštart `npm run dev`.

## 6. Vyskúšanie na telefóne

1. Zavri a znova otvor SOMOS. V Nastaveniach má byť navrchu **Účet**.
2. **Prihlásiť sa → e-mail → Poslať kód** a prepíš kód. Pod e-mailom má byť „Synchronizované práve teraz“.
3. **Pokračovať cez Google** z nainštalovanej appky: po výbere účtu sa máš vrátiť späť do SOMOS
   (nie do Chrome). Toto sa na PC otestovať nedá. Ak skončíš v Chrome, napíš mi.
4. Druhé zariadenie (napr. PC): prihlás sa rovnakým účtom a over, že sú tam tvoje ⭐, štatistiky a lekcie.
   Odober ⭐ na jednom, otvor appku na druhom: má zmiznúť aj tam.
5. V Supabase **Table Editor → records** uvidíš svoje záznamy (každý vidí iba svoje).
