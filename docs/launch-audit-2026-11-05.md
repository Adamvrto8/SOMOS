# SOMOS – kontrola pred zverejnením (bezpečnosť + prevádzka)

Dátum: 2026-11-05 · Stav kódu: `main` @ `8d36935` (tense recap). Počas kontroly bol obsah tohto commitu ešte
necommitnutý v pracovnom priečinku, testy teda bežali presne nad tým, čo je teraz v `8d36935`.

## Zhrnutie v skratke

**Verdikt: kód je v dobrom stave, ale zverejniť zatiaľ nie.** Serverové funkcie a databáza sú navrhnuté
starostlivo (RLS na každej tabuľke, validácia každého vstupu, rate limity, hashované IP adresy, žiadne
tajomstvá v gite, 0 zraniteľností v produkčných závislostiach). Brzdí to sedem vecí, ktoré treba vyriešiť
pred zverejnením. Väčšina z nich nie je chyba v kóde, sú to rozhodnutia a nastavenia okolo neho:

| # | Blokuje zverejnenie | Prečo | Náročnosť |
|---|---|---|---|
| B1 | **Finálna doména** | Progres ľudí bez účtu je viazaný na doménu. Zmena po zverejnení = všetci oň prídu | rozhodnutie + 1–2 h nastavení |
| B2 | **Bezpečnostné HTTP hlavičky** chýbajú (CSP, clickjacking, nosniff…) | Jediná ochrana pred XSS a vložením stránky do cudzieho rámca | 1–2 h |
| B3 | **Databáza nemá limity na dáta účtu** | Jeden účet môže zaplniť 500 MB Supabase Free, potom prestane fungovať zápis pre všetkých | 1 h SQL |
| B4 | **Rast tabuľky `records`** (každá odpoveď = 1 riadok) | Pri stovkách aktívnych ľudí sa 500 MB zaplní za mesiace | rozhodnutie + pár hodín |
| B5 | **E-maily s kódom** idú cez Gmail / vstavaný Supabase | Limit 500/deň, tvoj osobný Gmail ako odosielateľ, spam | 1 h (Resend + doména) |
| B6 | **Právne veci** (Google Fonts, súhlas so štatistikami, DeepL Free, Vercel Hobby, Google Play) | GDPR / ePrivacy riziko, odmietnutie v Google Play | pol dňa |
| B7 | **Žiadne zálohy databázy** (Supabase Free ich nemá) | Pri chybe alebo zmazaní je progres všetkých účtov preč | 1–2 h (GitHub Action) |

Plus jedna produktová vec mimo kódu: **obsah nikdy nekontroloval rodený hovoriaci** (CLAUDE.md to sám
uvádza ako najdôležitejšiu kontrolu pred zverejnením).

## Stav opráv (2026-11-06)

Opravené v kóde. Overené: lint, `validate:data`, `validate:es`, 783 unit testov, build, `check:build`,
e2e 110/110. SQL schéma bola overená na Postgres 17 (PGlite) 18 kontrolami vrátane opakovaného spustenia.

| Nález | Stav | Čo sa zmenilo |
|---|---|---|
| B2 hlavičky | ✅ kód · ⏳ ty | `vercel.json`: nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, CSP **zatiaľ Report-Only**, `immutable` cache pre `/assets`. Skript témy presunutý do `public/theme-init.js`. **Ty:** po nasadení týždeň sleduj konzolu (Chrome na PC, appka cez `chrome://inspect` z telefónu). Ak nevidíš hlásenia CSP, premenuj `Content-Security-Policy-Report-Only` na `Content-Security-Policy` |
| B3 limity DB | ✅ (SQL spustené 2026-11-06) | `schema.sql`: do `records` sa dá písať iba cez `push_records` (security definer). Funkcia preskočí neznámy `kind`, kľúč nad 200 znakov a dáta nad 64 kB, odmietne dávku nad 500 a účet nad 200 000 záznamov. Check constrainty sú záloha. `push_cleanup` maže nespustené duelové miestnosti po 24 h (okrem odkazov na odvetu). **Ty: spusti celý `supabase/schema.sql` v Supabase SQL editore** (dá sa spustiť opakovane; stará aj nová verzia appky s ním fungujú) |
| O1 kľúč `sb_secret_` | ✅ | `translate`, `report`, `usage` posielajú kľúč ako `reminder.ts`, s testami pre oba typy kľúča |
| O4 precache 4 MB | ✅ | `npm run check:build` (`scripts/check-build.ts`) v CI zlyhá, keď niečo nie je v precache alebo keď chunk prekročí 3,5 MB |
| O6 štatistiky | ✅ | limit aj na blok adries (`BATCHES_PER_BLOCK = 360`) |
| O8 dev závislosti | ✅ čiastočne | vite 8.3.6, vitest 5.1.0, sharp 0.35.5: **0 high**. Zostáva 6 moderate a 2 low v `vite-plugin-pwa` (workbox-build) a v Sentry build plugine, iba počas buildu a bez opravy, ktorá by nebola downgrade |
| O9 CI | ✅ | `npm ci` vo Verceli; CI pridáva `validate:es`, `npm audit --omit=dev --audit-level=high`, `check:build` |
| O10 `.env` | ✅ | doplnené do `.gitignore` (3e415b4) |
| `CRON_SECRET` | ✅ | porovnanie v konštantnom čase (`timingSafeEqual`) |
| e2e workery | ✅ | `workers: 4` lokálne. Pozor: keď beží iná session, spúšťaj `E2E_PORT=5299 npm run test:e2e`, inak Playwright „požičia“ jej server na 5199 a padne, keď ho vypne (stalo sa pri tejto kontrole: 84 falošných zlyhaní) |
| Text zásad | ✅ | „Profil → Záloha“ (SK aj EN) |
| B1, B4–B7, O2, O3, O5, O7, O11 | ⏳ | rozhodnutia a nastavenia mimo kódu, pozri nižšie |

---

## Čo som skontroloval a výsledky

| Kontrola | Výsledok |
|---|---|
| `npm run lint` (oxlint) | ✅ bez nálezov |
| `npm run validate:data` | ✅ prešlo |
| `npm run validate:es` | ✅ prešlo (CI ho ale nespúšťa, pozri O9) |
| `npm test` (vitest) | ✅ 52 súborov, 777 testov, všetky prešli |
| `npm run build` (tsc + vite) | ✅ prešlo; varovanie o veľkom chunku (pozri O6) |
| `npm run test:e2e` (Playwright) | ✅ 110/110 s 3 workermi; s 12 workermi 40 falošných timeoutov (pozri „Výsledok e2e“) |
| `npm audit --omit=dev` (produkčné závislosti) | ✅ **0 zraniteľností** |
| `npm audit` (všetko vrátane dev) | ⚠️ 3 high, 9 moderate, 3 low, len v dev nástrojoch (pozri O8) |
| Tajomstvá v gite (aj v histórii) | ✅ žiadne; iba testovacie `sb_secret_abc` v testoch |
| `.env` súbory | ✅ v repe nie sú; `.gitignore` ale `.env` neignoruje (pozri O10) |
| Debug zvyšky (`console.log`, `debugger`, TODO, localhost) v `src/` a `api/` | ✅ žiadne |
| `dangerouslySetInnerHTML` / `eval` / `innerHTML` v aplikácii | ✅ žiadne (React escapuje všetok text) |
| Hlavičky živej stránky (1 request) | ⚠️ iba HSTS, ostatné chýbajú (B2) |
| Supabase advisors, živé RLS, premenné na Verceli | ❌ **nedalo sa overiť**: MCP konektory nemajú prístup k projektu SOMOS (Vercel chce autorizovať tím, Supabase projekt je v inej organizácii). Checklist na ručné overenie je v sekcii „Over sám“ |

---

## 🔴 Blokujúce nálezy (pred zverejnením)

### B1. Rozhodni finálnu doménu teraz, nie po zverejnení

**Problém.** Všetko je dnes natvrdo na `somos-jade.vercel.app`:

- **IndexedDB a localStorage patria doméne.** Kto používa appku bez účtu (predvolený stav), má celý
  progres iba v prehliadači pod touto doménou. Presun na `somos.sk` = prázdna appka pre každého bez účtu.
  Toto sa nedá opraviť dodatočne, iba presmerovaním a ručným exportom/importom.
- Push odbery (`push_devices`) sú viazané na pôvod. `VAPID_SUBJECT` v [api/reminder.ts:548](../api/reminder.ts#L548).
- TWA balík pre Google Play: `host` v [android/twa-manifest.json](../android/twa-manifest.json) a
  `assetlinks.json` patria doméne. Zmena = nové vydanie v obchode.
- Google OAuth (JavaScript origins, home page, privacy URL), Supabase Site URL a Redirect URLs.
- Vlastná doména je zároveň podmienka pre Resend (B5).

**Riešenie.** Kúp doménu (napr. `somos.app` / `somos.sk`, ~10 €/rok), pridaj ju vo Verceli, prepni
všetky miesta vyššie a až potom zverejni. Kým nikto okrem teba appku nepoužíva, je zmena zadarmo.

### B2. Chýbajú bezpečnostné HTTP hlavičky

**Zistenie.** Živá stránka posiela iba `Strict-Transport-Security` (ten pridáva Vercel sám).
[vercel.json](../vercel.json) nemá žiadne bezpečnostné hlavičky:

- žiadna **Content-Security-Policy**: keby sa niekedy dostal cudzí skript do stránky (závislosť,
  chyba v obsahu), nič ho nezastaví;
- žiadne **`frame-ancestors` / `X-Frame-Options`**: stránku sa dá vložiť do cudzieho `<iframe>`
  (clickjacking, napr. na tlačidlo „Zmazať účet“);
- žiadne `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

**Riešenie.** Doplň do `vercel.json` (najprv ako `Content-Security-Policy-Report-Only`, týždeň sleduj
konzolu na telefóne, potom prepni na ostrú):

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), geolocation=(), payment=(), microphone=(self)" },
    { "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://<PROJECT>.supabase.co wss://<PROJECT>.supabase.co https://*.ingest.de.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" }
  ]
}
```

Poznámky:
- `microphone=(self)`: cvičenie „speaking“ používa rozpoznávanie reči.
- Inline `<script>` v [index.html](../index.html) (téma pred prvým vykreslením) by CSP zablokovala.
  Presuň ho do `public/theme-init.js` a načítaj `<script src="/theme-init.js">` (synchrónne, bez `type=module`).
- Ak urobíš O5 (fonty u seba), z CSP vypadnú `fonts.googleapis.com` a `fonts.gstatic.com`.
- Pre `/assets/*` pridaj `Cache-Control: public, max-age=31536000, immutable` (súbory majú hash v mene).

### B3. Databáza neobmedzuje, koľko dát si jeden účet uloží

**Zistenie.** Účet si založí ktokoľvek (e-mailový kód). Prihlásený používateľ môže priamo cez API
(nie cez appku) volať `push_records` a `insert` do `records`:

- `data jsonb` nemá žiadny limit veľkosti,
- `push_records(items)` neobmedzuje počet položiek v dávke,
- `kind` a `key` nie sú obmedzené na známe hodnoty a dĺžku,
- `create_duel` nemá rate limit a tabuľka `duels` sa nikdy nečistí.

Supabase Free má **500 MB**. Po prekročení prejde databáza do režimu len na čítanie, teda prestane
fungovať sync, duely, pripomienky, štatistiky aj hlásenia **pre všetkých**. RLS chráni pred čítaním
cudzích dát, nie pred zaplnením.

**Riešenie (SQL do `supabase/schema.sql`, potom spustiť v Supabase):**

```sql
-- Known kinds, short keys, one record at most 16 kB (the largest real row is a card or lesson, well under 2 kB).
alter table public.records add constraint records_kind check (kind in ('customWord','saved','card','attempt','mistake','lesson','test','settings')) not valid;
alter table public.records add constraint records_key_len check (char_length(key) <= 200) not valid;
alter table public.records add constraint records_data_size check (data is null or pg_column_size(data) <= 16384) not valid;
alter table public.records validate constraint records_kind;
alter table public.records validate constraint records_key_len;
alter table public.records validate constraint records_data_size;
```

A v `push_records` odmietni dávku nad 500 položiek (appka posiela presne `PUSH_BATCH = 500`,
[src/lib/sync/engine.ts:14](../src/lib/sync/engine.ts#L14)). Na počet riadkov na účet stačí zatiaľ
monitorovací dotaz (sekcia „Over sám“). Strop cez trigger pridaj, keď bude ľudí viac. Do `push_cleanup`
pridaj mazanie starých duelov (napr. `finished` / `lobby` staršie ako 30 dní).

### B4. Tabuľka `records` rastie s každou odpoveďou

**Zistenie.** Každý pokus (`Attempt`) je jeden riadok v `records`
([src/lib/sync/kinds.ts](../src/lib/sync/kinds.ts)) s indexom `(user_id, rev)`. Odhad: ~250 B na
riadok vrátane indexov a réžie, aktívny človek ~50–200 odpovedí denne, teda 12–50 kB denne na človeka.

| Aktívnych ľudí | Rast za deň | 500 MB plné za |
|---|---|---|
| 50 | 0,6–2,5 MB | 7 mesiacov až 2 roky |
| 300 | 4–15 MB | 1–4 mesiace |
| 1 000 | 12–50 MB | 10–40 dní |

Prvé prihlásenie na novom zariadení navyše stiahne celú históriu (1 000 riadkov na stránku).

**Riešenie (vyber jedno pred zverejnením):**
- a) Pokusy staršie ako N dní na serveri zhrnúť do denných súčtov (štatistiky aj séria potrebujú iba
  „deň → počet správnych / všetkých“). `replayStreak` v `stats.ts` by čítal súčty + posledné dni.
- b) Zostať pri dnešnom stave a mať pripravený **Supabase Pro (25 $/mesiac, 8 GB, denné zálohy)**.
  Zároveň rieši B7.
- V oboch prípadoch: alert, keď DB prekročí 70 % (dotaz v sekcii „Over sám“, alebo Supabase → Reports).

### B5. E-maily s prihlasovacím kódom

**Zistenie.** [docs/accounts-setup.md](accounts-setup.md) uvádza ako dnešný stav vstavaný Supabase
(iba členovia tímu, pár za hodinu) alebo Gmail cez heslo pre aplikácie (~500 denne). Pri zverejnení:
odosielateľom bude tvoj osobný Gmail, e-maily budú padať do spamu (chýba SPF/DKIM pre doménu)
a pri náraste sa prihlasovanie zasekne.

**Riešenie.** Resend (3 000/mesiac zadarmo) s overenou doménou z B1, odosielateľ `kod@<domena>`.
V Supabase → Auth → Rate Limits skontroluj limit e-mailov za hodinu a zváž **CAPTCHA (Cloudflare
Turnstile, zadarmo)** na odoslanie kódu, inak môže ktokoľvek posielať kódy na cudzie adresy a páliť
tvoj limit aj reputáciu domény.

### B6. Právne a obchodné podmienky

1. **Google Fonts z Googlu.** [index.html](../index.html) načítava 8 rodín písma z
   `fonts.googleapis.com`. Každá prvá návšteva tak posiela IP adresu Googlu bez súhlasu. Nemecký súd
   (LG München, 2022) to uznal za porušenie GDPR a v EÚ to bola vlna sťažností.
   → **Fonty hosťuj u seba** (`@fontsource/*` alebo stiahnuť woff2 do `public/fonts`), naraz to
   zjednoduší CSP aj zrýchli prvé načítanie. Zváž aj zníženie z 8 rodín.
2. **Štatistiky so súhlasom alebo bez trvalého ID.** Štatistiky sú **predvolene zapnuté** a ukladajú do
   zariadenia náhodné ID zariadenia. Podľa ePrivacy (čl. 5 ods. 3; na Slovensku zákon o elektronických
   komunikáciách) vyžaduje ukladanie identifikátora na analytiku **súhlas**, oprávnený záujem tu nestačí.
   Trvalé ID je navyše podľa GDPR **pseudonymné, nie anonymné**, takže text „anonymné štatistiky“ je
   nepresný. → Buď opt-in otázka v uvítaní („Pomôcť zlepšovať appku?“), alebo štatistiky bez trvalého ID
   (napr. ID platné iba jeden deň). A uprav text v zásadách.
3. **DeepL API Free.** Podmienky Free plánu nedávajú záruky spracovania ako Pro (texty sa môžu
   uchovávať a používať) a obmedzujú komerčné použitie. Zásady súkromia to nespomínajú. → Over aktuálne
   podmienky DeepL. Pri verejnom vydaní buď DeepL Pro (platba za znaky), alebo v zásadách uveď, že text
   na preklad ide do DeepL, a v UI pripomeň „nepíš sem osobné údaje“.
4. **Vercel Hobby** je len na osobné, nekomerčné použitie. Bezplatná verejná appka bez reklám je šedá
   zóna. Akonáhle pribudne čokoľvek platené alebo reklama, treba Pro (20 $/mesiac).
5. **Google Play:**
   - **Data safety** formulár musí sedieť so zásadami (e-mail, progres, ID zariadenia, diagnostika Sentry,
     text pre DeepL).
   - Google vyžaduje okrem mazania v appke aj **webový odkaz na žiadosť o zmazanie účtu** (bez
     inštalácie). Pridaj sekciu/URL `…/privacy#zmazanie` s postupom (e-mail stačí).
   - **Prezývky v duelách sú obsah od používateľov (UGC).** Server kontroluje iba dĺžku 3–20
     (`profiles` v schéme), pravidlá platia len v appke. Google Play pri UGC chce spôsob nahlásenia
     a zablokovania. → Server-side regex + zoznam zakázaných slov, prípadne tlačidlo „Nahlásiť prezývku“.
   - Vekové hodnotenie (content rating) a cieľová skupina. Ak cieliš aj na ľudí pod 16 rokov, GDPR čl. 8.
6. **Podmienky používania** zatiaľ neexistujú (iba zásady súkromia). Pre verejnú appku s účtami
   a duelmi odporúčam krátke podmienky (bez záruky, pravidlá prezývok, ukončenie účtu).
7. Drobnosť v texte zásad: „Nastavenia → Záloha“ je dnes „Profil → Záloha“.

### B7. Zálohy databázy

**Zistenie.** Supabase Free nemá zálohy, ktoré by si vedel obnoviť (denné zálohy sú od Pro, PITR
za príplatok). Chyba v migrácii, omylom spustený `delete` alebo útok = progres všetkých účtov je preč.

**Riešenie.** Týždenná GitHub Action so `supabase db dump` (alebo `pg_dump` cez connection string
v GitHub Secrets) → zašifrovaný artefakt alebo súkromný úložný priestor. Dump obsahuje e-maily, takže
nie do verejného repa ani bez šifrovania. **Raz si vyskúšaj obnovu** do prázdneho projektu.
Alternatíva: Supabase Pro (B4 b).

---

## 🟠 Dôležité (opraviť pred zverejnením alebo hneď po ňom)

### O1. Supabase kľúč: nekonzistentné posielanie v troch funkciách
[api/reminder.ts:413](../api/reminder.ts#L413) správne posiela nový kľúč `sb_secret_…` iba v hlavičke
`apikey` a starý JWT aj ako `Bearer`. [api/translate.ts](../api/translate.ts),
[api/report.ts](../api/report.ts) a [api/usage.ts](../api/usage.ts) posielajú **vždy**
`Authorization: Bearer <key>`. Supabase legacy JWT kľúče postupne ruší. Po prechode na `sb_secret_…`
(ktorý [docs/reminders-setup.md](reminders-setup.md) výslovne povoľuje) môžu limity prekladu,
hlásenia a štatistiky začať padať. Preklad navyše pri chybe limitov ticho pustí požiadavku bez limitov.
→ Zjednotiť na rovnakú logiku ako v `reminder.ts` a pridať test s `sb_secret_`.

### O2. Duely veria výsledku z telefónu
`answer_duel` ukladá „right/wrong“ a čas tak, ako ich pošle appka. Komentár v schéme to priznáva
(„before a public release the server should check them“). Ktokoľvek s účtom vyhrá každý duel jedným
volaním API. Pre kamarátov to nevadí. Pri verejnom rebríčku alebo výhrach áno. → Pred verejnými duelmi
kontrolovať odpoveď na serveri, alebo duely pri spustení označiť ako „pre kamarátov“.

### O3. Monitoring serverovej časti
Sentry zachytáva iba chyby v telefóne. Chyby funkcií (`console.error` v `api/*`) idú len do logov
Vercelu, ktoré na Hobby pláne vydržia veľmi krátko, a nikto ťa na ne neupozorní. Keď vypadne
cron-job.org, DeepL kvóta alebo Supabase, dozvieš sa to od používateľov.
→ (1) V cron-job.org zapni **e-mail pri zlyhaní** úlohy. (2) Bezplatný uptime monitor (napr. UptimeRobot)
na `/` a `/api/reminder`. (3) Sentry aj vo funkciách (`@sentry/node`, iba pri chybách), alebo
aspoň denná kontrola `push_ticks.at`, či cron beží.

### O4. Pasca: limit precache 4 MB
[vite.config.ts](../vite.config.ts) má `maximumFileSizeToCacheInBytes: 4 MB`. Hlavný chunk má dnes
**2,56 MB** a rastie s každým obsahom (B2 pridalo stovky viet). Keď prekročí 4 MB, Workbox ho **ticho
vynechá z precache** (iba varovanie v builde) a **appka prestane fungovať offline**. Testy to nezachytia.
→ Do CI pridaj kontrolu, napr. skript, ktorý zlyhá, ak je niektorý súbor v `dist/assets` > 3,5 MB,
alebo ak `dist/sw.js` neobsahuje hlavný `index-*.js`. Dlhodobo: obsah do samostatných JSON súborov
podľa úrovne.

### O5. Výkon prvého načítania
Hlavný JS: 2,56 MB (650 kB gzip) + vendor 153 kB gzip + 8 rodín písma. Na slabšom Androide a mobilných
dátach to znamená niekoľko sekúnd bielej obrazovky pri prvom otvorení (potom už ide všetko z cache).
→ Fonty u seba a menej rodín (B6.1), obsah B1/B2 načítať lazy. Odmeraj Lighthouse na telefóne pred
zverejnením.

### O6. Štatistiky: limit len na jednu adresu
[api/usage.ts](../api/usage.ts) má iba limit na adresu (120 dávok × 100 udalostí za hodinu), na rozdiel od
`report` a `translate` nemá limit na blok adries. Jeden zdroj s mnohými IPv4 adresami môže plniť
`usage_events` (a tým B3). → Pridať `blockKey` ako v `report.ts`.

### O7. Supabase: localhost v povolených presmerovaniach
Návod pridáva `http://localhost:5173/archive/account` do Redirect URLs produkčného projektu. Po
zverejnení ho odstráň (alebo maj druhý Supabase projekt na vývoj).

### O8. Zraniteľnosti v dev závislostiach
High: `vite` (dev server: launch-editor, `server.fs`), `sharp` (librsvg, iba generovanie ikon),
`source-map-js`. Produkčný balík nezasahujú, ale `vite` dev server spúšťaš s `--host` v lokálnej sieti.
→ `npm update vite vitest vite-plugin-pwa sharp @sentry/vite-plugin`, potom build + testy.

### O9. CI a build
- [vercel.json](../vercel.json) má `installCommand: npm install`. Daj `npm ci`, aby Vercel inštaloval
  presne `package-lock.json` (rovnako ako CI).
- CI nespúšťa `npm run validate:es` (španielska varianta) ani `npm audit --omit=dev --audit-level=high`.
- GitHub Actions sú na verziách `@v5`, nie na SHA. Pre sólo projekt je to v poriadku, len pre úplnosť.

### O10. `.gitignore` neignoruje `.env`
Ignoruje iba `*.local`. Keby si niekedy vytvoril `.env` alebo `.env.production` (napr. `vercel env pull`
vytvára `.env.local`, to je OK, ale iné nástroje vytvárajú `.env`), skončí v gite aj s kľúčmi.
→ Pridaj `.env` a `.env.*` s výnimkou `!.env.example`.

### O11. Google Play: assetlinks bez odtlačkov
[public/.well-known/assetlinks.json](../public/.well-known/assetlinks.json) má prázdne
`sha256_cert_fingerprints`. Bez nich TWA ukáže hore lištu prehliadača. Patria tam 2 odtlačky
(tvoj upload kľúč + Google Play App Signing). Uloženie keystore: mimo repa, so zálohou (strata
= nemôžeš vydať aktualizáciu).

---

## 🟢 Drobnosti (kedykoľvek)

- `CRON_SECRET` sa porovnáva obyčajným `!==` ([api/reminder.ts:823](../api/reminder.ts#L823)).
  Časový útok cez sieť je prakticky nereálny, `timingSafeEqual` je však jeden riadok.
- Kontrola `sameOrigin` v `api/*` nie je autentifikácia: skript si hlavičku `Origin` podvrhne. Skutočnú
  ochranu dávajú rate limity a validácia, a tie sú v poriadku. Len na to nespoliehaj pri novej funkcii.
- Preklad pri výpadku Supabase pustí požiadavku bez limitov (fail-open). Je to vedomé, poslednou
  poistkou je mesačná kvóta DeepL. Ak ťa zneužitie kvóty trápi viac než krátky výpadok prekladu,
  prepni na fail-closed.
- Pracovný priečinok nie je čistý (necommitnuté zmeny + `Design/`). Pred vydaním commitni alebo odlož,
  aby to, čo je na telefóne, bolo presne v gite.

---

## ✅ Čo je urobené dobre (nemeniť)

- **RLS** na každej tabuľke. Servisné tabuľky (`push_*`, `usage_*`, `content_reports`,
  `translate_chars`) majú `revoke all from anon, authenticated`. Funkcie majú `set search_path = ''`
  a `revoke execute from public, anon`.
- **Validácia vstupu** vo všetkých funkciách: presné kľúče, regexy, limity dĺžky, max veľkosť tela,
  whitelist push hostiteľov (žiadne SSRF cez `endpoint`), kontrola tvaru VAPID kľúčov.
- **Rate limity** na adresu aj blok (IPv4 /24, IPv6 /48), IP sa ukladajú iba ako HMAC hash.
- **Tajomstvá** iba vo Verceli, DeepL a service role kľúč nikdy v appke, história gitu čistá.
- **Auth:** PKCE, žiadne vlastné heslá, mazanie účtu v appke (kaskáda na všetky dáta).
- **Sentry** so šetrným nastavením: bez používateľa, cookies, hlavičiek, query stringov a konzoly.
- **Retencia:** `push_cleanup` maže staré zariadenia, štatistiky po 13 mesiacoch a vybavené hlásenia
  po 12 mesiacoch, presne podľa zásad.
- **CI + Vercel Deployment Checks:** do produkcie ide iba zelený build. ErrorScreen namiesto bielej
  obrazovky, PWA sa sama aktualizuje.

---

## Over sám (nemal som prístup)

**Vercel → Settings → Environment Variables (Production):** `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPL_API_KEY`, `VAPID_PRIVATE_KEY`,
`CRON_SECRET`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
Tajné premenné (`SUPABASE_SERVICE_ROLE_KEY`, `DEEPL_API_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`,
`SENTRY_AUTH_TOKEN`) označ ako **Sensitive** a skontroluj, či sú aj pre **Preview**: preview nasadenia
by inak zapisovali do produkčnej DB. Deployment Protection pre preview nechaj zapnutú.

**Supabase → Advisors → Security a Performance:** spusti a oprav všetko červené
(typicky: dlhá platnosť OTP, chýbajúce indexy na cudzích kľúčoch).

**Supabase SQL editor:**

```sql
-- 1) RLS on every public table (all must be true)
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- 2) Database size (Free = 500 MB)
select pg_size_pretty(pg_database_size(current_database()));

-- 3) What takes the space in records
select kind, count(*), pg_size_pretty(sum(pg_column_size(data))::bigint) from public.records group by kind order by 2 desc;

-- 4) Largest accounts (abuse / growth)
select user_id, count(*) from public.records group by user_id order by 2 desc limit 10;

-- 5) Does the cron run? (at should be under 15 min old)
select at, reason, sent from public.push_ticks;

-- 6) What anon and authenticated may do on public tables
select grantee, table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated') group by 1, 2 order by 2, 1;
```

**Supabase → Auth:** OTP expiry (odporúčam 600 s), rate limity e-mailov, Redirect URLs (O7),
SMTP (B5).

---

## Pravidlá do budúcna (aby sa to neopakovalo)

1. **Doménu rozhodni pred prvým používateľom.** Lokálne dáta, push, OAuth, TWA aj e-maily sú viazané na pôvod.
2. **Každá tabuľka, do ktorej píše používateľ, má limit:** veľkosť riadku, dĺžku kľúča, whitelist typov,
   počet v dávke. RLS hovorí, *kto* smie písať, nie *koľko*.
3. **Pri každej novej tabuľke odhadni rast:** riadkov na používateľa za deň × počet používateľov ×
   ~250 B voči limitu plánu. Pri tabuľke, ktorá rastie s každou akciou, rovno navrhni aj čistenie alebo zhrnutie.
4. **Nová serverová funkcia = rovnaký vzor ako `reminder.ts`:** kľúč `sb_secret_` iba v `apikey`, limit na
   adresu **aj** na blok, validácia tvaru, `Cache-Control: no-store`. `sameOrigin` nie je autentifikácia.
5. **Nová externá služba = riadok v zásadách súkromia, Data safety v Google Play a v CSP `connect-src`.**
   Patria sem aj fonty, CDN a analytika.
6. **Čokoľvek, čo ukladá ID do zariadenia na iný účel než chod appky, potrebuje súhlas** (ePrivacy).
   „Trvalé náhodné ID“ = pseudonymné, nie anonymné.
7. **Tiché limity buildu majú stráž v CI:** precache 4 MB, veľkosť chunku. Varovanie v builde nikto nečíta.
8. **Klient nikdy nerozhoduje o tom, čo je férové voči iným** (výsledky duelov, rebríčky). Rozhoduje server.
9. **Testovacia suite musí byť zelená spoľahlivo.** Flaky alebo preťažená suite = oprav konfiguráciu,
   nie „spusti znova, kým neprejde“.
10. **Pred zverejnením:** záloha DB s vyskúšanou obnovou, alert na zlyhanie cronu a na veľkosť DB.

## Plán vydania a návrat späť

1. Vyriešiť B1–B7 (poradie: B1 doména → B5 e-maily → B2 hlavičky → B3 + B6 → B7 zálohy → B4 rozhodnutie).
2. Uzavretá beta: 5–10 ľudí cez odkaz alebo interné testovanie v Google Play, 1–2 týždne. Sledovať
   Sentry, `push_ticks` a veľkosť DB.
3. Verejné vydanie mimo piatka. Prvú hodinu: Sentry bez nových chýb, prihlásenie e-mailom aj Googlom,
   jedna lekcia, pripomienka, preklad.

**Návrat späť (rollback):** Vercel → Deployments → predchádzajúce nasadenie → **Instant Rollback**
(menej ako 1 min). Appky na telefónoch sa samy načítajú do vráteného nasadenia (`src/lib/pwa.ts`).
Databáza: `schema.sql` sa dá spustiť opakovane a zmeny sú zatiaľ iba pridávajúce. Pri prvej mazacej
alebo premenovacej migrácii si urob dump pred ňou (B7).

---

## Výsledok e2e

- **1. beh** (predvolené workery = 12 na tomto PC): **70 prešlo, 40 zlyhalo**, z toho 31× `page.goto:
  Test timeout of 30000ms`. Dev server Vite pri studenom štarte (2,5 MB obsahu na transformáciu)
  nestíhal 12 paralelných prehliadačov.
- **2. beh** s `--workers=3`: ✅ **110/110 prešlo** (3,4 min).

Záver: chyby appky to nie sú, je to prostredie. [playwright.config.ts](../playwright.config.ts) však nemá
`workers`, takže na výkonnom PC beží toľko workerov, koľko je jadier, a suite vyzerá rozbitá.
→ Pridaj `workers: process.env.CI ? undefined : 4`, alebo spúšťaj lokálne `npm run test:e2e -- --workers=3`.
Pozor: falošne červená suite učí ignorovať červenú, a to je pred zverejnením nebezpečnejšie než pomalší beh.
