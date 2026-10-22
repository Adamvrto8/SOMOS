# Živý duel – 1 na 1 so súperom (špecifikácia)

Stav: **fáza 1 je v kóde** (2026-10-22), čaká na nastavenie Supabase; v dev a v testoch beží na lokálnom serveri.
Rozhodnuté: bonus za rýchlosť, duel sa ráta do učenia, kolo 2 sa strieda, **hrá sa naživo** (nie na striedačku).

Kód: `src/lib/duel/` (zápas, rozvrh a body v `match.ts`; server v `supabaseBackend.ts`, lokálny v `localBackend.ts`),
obrazovky v `src/features/duel/`, tabuľky a funkcie na konci `supabase/schema.sql`, testy `match.test.ts` a
`e2e/duel.spec.ts`. Lokálny server: na dev serveri bez Supabase (alebo s `VITE_DUEL_BACKEND=local`) hrajú proti sebe
dve karty jedného prehliadača.

Oproti návrhu nižšie v fáze 1:
- Prezývka sa nastavuje na stránke Duel (pred prvým duelom a cez „Zmeniť“), nie v Profile.
- Kto vypadne a nevráti sa, nedostane „prehral“, len 0 za zvyšné úlohy (výsledok vyjde rovnako).
- Slnko denného cieľa, ktoré príde počas zápasu, sa ukáže až po ňom.

Cieľ: dvaja kamaráti hrajú **naraz** na svojich telefónoch. Obaja vidia tú istú úlohu v tej istej chvíli,
v strede obrazovky dve slnká, ktoré sa plnia bodmi, a je vidno, kto práve vedie. Zápasy sa ukladajú do histórie.
Konečný cieľ je zoznam priateľov v appke, odkiaľ niekoho vyzveš.

Predpoklad: **účty v Supabase** (docs/accounts-setup.md). Server musí vedieť, kto hrá, poslať odpovede jedného
hráča druhému a uložiť výsledok. Kým nie je Supabase nastavený, duely sú v appke skryté (ako účty).

---

## 1. Zápas

- **3 kolá × 5 úloh**, každé kolo iný typ. Obaja majú tie isté úlohy, aj s rovnakým poradím možností a dlaždíc.

| Kolo | Typ | Čas na úlohu |
|---|---|---|
| 1 | Výber z možností (`choice`) | 10 s |
| 2 | Časovanie (`conjugation`) alebo Slovná zásoba (`vocab`), striedavo od zápasu k zápasu | 15 s |
| 3 | Skladanie viet (`builder`) | 25 s |

  Vynechané: Preklad viet (veľa správnych odpovedí), Diktát a Vyslovovanie (zvuk a mikrofón).
- **Úroveň** vyberá ten, kto zakladá miestnosť: A1 / A2 / B1.
- **Body:** správne = 10 + až 5 za rýchlosť (podľa zostávajúceho času). „Takmer“ (🟡 preklep) = 7.
  Nesprávne alebo čas vypršal = 0. Maximum 225. Pri rovnosti bodov vyhráva kratší celkový čas, inak remíza.
- **Spoločný krok:** úloha začína obom v tej istej chvíli (čas určuje server). Kto odpovie skôr, vidí
  „čaká sa na súpera“. Ďalej sa ide, keď odpovedali obaja alebo keď vyprší čas; potom 1,5 s správna odpoveď a
  body oboch, ďalšia úloha. Po každom kole krátky medzisúčet.
- **Férovosť:** bez nápovedy, „Prečo?“, druhého pokusu a „Moja odpoveď bola tiež správna“. Odchod z appky počas
  úlohy = tá úloha je nesprávna.
- **Výpadok spojenia:** hra beží ďalej podľa času servera. Kto vypadne, môže sa do 60 s vrátiť a pokračuje
  aktuálnou úlohou; zmeškané úlohy majú 0. Kto sa nevráti, duel prehral („odišiel“), druhý ho môže dohrať sám.
- **Ráta sa do učenia:** odpovede sú bežné pokusy – denný cieľ, séria, nesprávne idú do Chýb.

## 2. Obrazovka hry

- **Navrchu dve slnká** (ty vľavo, súper vpravo, s prezývkami). Slnko sa plní podľa bodov (z 225) a v strede má
  číslo bodov. Kto vedie, má slnko väčšie / žiarivejšie a korunku; pri rovnosti rovnaké. Keď súper odpovie,
  jeho slnko krátko blikne (vidíš, že už odpovedal, nie či správne – to až po čase úlohy).
- Pod nimi **pás času** úlohy a **úloha** ako v lekcii (možnosti, políčko, dlaždice).
- Po úlohe: správna odpoveď, pri každom hráčovi ✓ / ✗ a koľko bodov pribudlo, slnká sa doplnia.
- **Motion design** (neskôr, samostatne): nástup kola, plnenie slniek, predbehnutie vo vedení, koniec zápasu.
  Prvá verzia bude mať len jednoduché prechody, aby sa dala doladiť.

## 3. Priebeh a ďalšie obrazovky (fáza 1)

- **Cvičiť → skratka „Duel“** vedľa Chýb, Testov a Gramatiky.
- **Duel** (`/duel`): **Nová miestnosť** (výber úrovne), **Pripojiť sa kódom**, **História** (súper, výhra /
  prehra / remíza, body, dátum; navrchu bilancia napr. 12 – 7 – 1).
- **Miestnosť** (`/duel/:kód`): kód (6 znakov), **Pozvať** (Android Zdieľať: WhatsApp…, odkaz
  „…/duel/K7QF2M“), kto je pripojený. Kamarát otvorí odkaz → prihlásenie, ak treba → prezývka, ak chýba →
  je v miestnosti. Keď sú dvaja, zakladateľ ťukne **Štart**, obom beží 3 – 2 – 1. Miestnosť bez súpera zanikne
  po 10 minútach.
- **Výsledok:** víťaz, body po kolách, každá úloha ✓/✗ s časom pre oboch, **Odveta** (nová miestnosť s tým
  istým súperom; súper dostane ponuku priamo v otvorenej appke).
- **Profil → Prezývka:** meno, pod ktorým ťa súper vidí (e-mail sa neukazuje). Jedinečná, 3–20 znakov.

## 4. Server (Supabase)

Tabuľky v `supabase/schema.sql`, všetky s RLS (hráč vidí len svoje miestnosti):

- `profiles (user_id, nickname unique)` – prezývka.
- `duels (id, code, host, guest, level, rounds jsonb, seed, status, started_at, created_at)`
  - `rounds` = `[{ type, seconds, items: [itemId…] }]` – ID ako v Chybách (`s001#0`, `tener:preterito:yo`,
    `casa:sk-es`); appka úlohu poskladá cez `taskFromItem`. `seed` = rovnaké poradie možností pre oboch.
  - `status`: `lobby` → `playing` → `finished` (alebo `abandoned`).
- `duel_answers (duel_id, user_id, task, result, ms, at)` – jedna odpoveď jednej úlohy; `at` je čas servera.
- Funkcie: `create_duel`, `join_duel(code)`, `start_duel` (len zakladateľ, nastaví `started_at` = teraz + 3 s),
  `answer(duel_id, task, result, ms)` (len počas úlohy, raz na úlohu), `finish_duel`, `my_duels()` (história),
  `server_now()` (appka si podľa neho zrovná hodiny).
- **Naživo:** Supabase Realtime – zmeny v `duel_answers` a `duels` sa okamžite pošlú obom; „presence“ ukazuje,
  kto je pripojený. Každá appka si z `started_at` a odpovedí sama vypočíta, kedy začína ďalšia úloha, takže obe
  idú rovnako, aj keď jedna správa príde neskôr.
- Body počíta server z odpovedí; správnosť hlási appka (kontrola odpovede je v appke, pre kamarátov to stačí).

## 5. Fázy

1. **Živý duel cez kód / odkaz** – všetko vyššie: prezývka, miestnosť, pozvánka, hra so slnkami, výsledok,
   história, odveta.
2. **Priatelia** – zoznam v Duel: pridať podľa prezývky alebo po zápase, žiadosť → prijať; vidno, kto je práve
   online; **Vyzvať** pošle pozvánku priamo do jeho otvorenej appky (bez odkazu).
3. **Notifikácie pozvánok** – „Adam ťa vyzýva na duel“, aj keď má kamarát appku zavretú. Dnes server pozná len
   jeden telefón (pripomienka); treba odber notifikácií ku každému účtu.
4. **Motion design** – animácie slniek, kôl a konca zápasu (môže ísť aj skôr, popri fáze 2).

## 6. Testy

- Unit: skladanie zápasu (3 typy, 5 úloh, úroveň), rovnaké úlohy a možnosti z rovnakého `seed`, rozvrh úloh zo
  `started_at` a odpovedí (ďalej po odpovedi oboch / po čase), body, víťaz, remíza, výpadok.
- Playwright: dve okná prehliadača proti simulovanému Supabase (ako `e2e/account.spec.ts`) – miestnosť, pripojenie
  kódom, štart, súper odpovie skôr / neskôr / vôbec, slnká a vedenie, výsledok v histórii oboch.
