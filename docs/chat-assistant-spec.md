# Asistent (chat) – pomocník k appke a španielčine (špecifikácia)

Stav: **fáza 0 sa rieši podľa `docs/superpowers/specs/2026-11-15-chat-assistant-prototype-design.md`** (2026-11-15): Claude Haiku 5.5, nástroje v appke, prístup cez allowlist. Zvyšok tohto dokumentu (paywall, platby, personalizácia, Gemini) platí ako východisko pre fázy 1 a 2. Nie je to priorita pred dokončením produktu ([[product-first]]). Rozhodnuté: ak sa do toho ide, asistent je **za paywallom** (minimálne má vrátiť náklady na tokeny).

Cieľ: používateľ sa v appke opýta po slovensky (alebo španielsky) a dostane odpoveď o appke alebo o španielčine –
vysvetlenie slova, času, rozdielu (ser vs. estar), „kde nájdem chyby“, „čo mám dnes robiť“. Asistent je **doplnok
učebnice** (pozri `docs/product-vision.md`), nie hlavná funkcia ani náhrada Cvičiť.

---

## 1. Prístup: nástroje nad dátami, nie vektorový RAG

Obsah je malý a štruktúrovaný (1668 slov, 270 slovies, 1625 viet, gramatické tipy so zdrojmi), takže embeddingy a vektorová
databáza nič nepridajú. Model dostane **nástroje** (function calling) nad dátami, ktoré appka už má:

| Nástroj | Zdroj v kóde |
|---|---|
| `search_word(query)` | MiniSearch, `src/lib/search.ts` |
| `get_conjugation(verb)` | `src/lib/conjugate.ts` |
| `get_grammar_tip(id \| query)` | `src/features/grammar/`, tipy „Prečo?“ + zdroje (PCIC, NGLE) |
| `find_sentences(query, level?)` | `src/data/sentences/` |
| `app_help(topic)` | nový krátky dokument „kde čo v appke je“ (odvodený z CLAUDE.md §5) |

Pravidlá systémového promptu:
- Slovenčina v odpovediach, španielčina **mexická** (žiadne vosotros, carro nie coche, pretérito ako základný minulý čas).
- Fakty o slovách, tvaroch a tipoch **iba z nástrojov**. Čo v dátach nie je, označí „mimo SOMOS“ a odpovie zo všeobecných vedomostí.
- Obsah nikdy nekontroloval rodený hovorca → pri nejasnosti to povedať, nevymýšľať.
- Krátke odpovede, odkaz na slovo (`/word/:id`) alebo tip, ak existuje.

Neskôr (fáza 2): personalizácia – level, Chyby, posledné lekcie („robíš chyby v pretérite, tu je tip a 5 viet“),
tlačidlo „uložiť do ⭐ / Moje slová“ z odpovede.

## 2. Poskytovateľ modelu

Tenká vrstva `api/_llm.ts` (adaptér), aby sa poskytovateľ dal vymeniť bez zásahu do zvyšku.

| Fáza | Poskytovateľ | Poznámka |
|---|---|---|
| Osobné použitie / uzavretá beta | **Google AI Studio (Gemini Flash / Flash-Lite), free tier** | bez karty, podporuje function calling, dobrá španielčina |
| Platená verzia | lacný platený model (Gemini Flash-Lite alebo Claude Haiku 5.5) | stovky otázok = centy |

Obmedzenia free tieru Gemini (platí pre fázu 0, nie pre platených používateľov):
- **Limity sú zdieľané** všetkými používateľmi jedného kľúča → nehodí sa na verejné vydanie.
- **Dáta:** vstupy môže Google použiť na zlepšovanie produktov → uviesť v privacy policy; presné podmienky pre EÚ
  **overiť v aktuálnych podmienkach** pred nasadením.
- Free tier sa mení (limity sa už znižovali) → nestavať na ňom produkt.

Zamietnuté / odložené: model v prehliadači (Gemini Nano, WebLLM) – slabá kvalita, ťažké, len niektoré telefóny;
„pomocník bez LLM“ (len vyhľadávanie vo FAQ a dátach) – lacná záložná možnosť, ak by sa AI nenasadila.

## 3. Paywall a ekonomika

Rozhodnutie: asistent je platená funkcia; cieľ je pokryť tokeny, nie zarábať.

Rozhodnutie (Adam, 2026-11-17): **SOMO je na začiatku jediná funkcia za paywallom** a paywall slúži hlavne ako poistka
proti zneužitiu (nikto nemôže vo veľkom míňať tokeny zadarmo), nie ako zdroj zisku. Všetko ostatné v appke ostáva zadarmo.

- **Free používateľ:** asistent vidí, ale nemá prístup (alebo malý skúšobný limit, napr. 5 otázok – otvorené rozhodnutie).
- **Platený:** denný limit otázok (napr. 30/deň) a limit dĺžky vstupu/výstupu; po limite „dosiahol si denný limit“.
- Vyžaduje **účet** (Supabase), aby sa dalo spárovať predplatné a limit na používateľa. Bez účtu sa asistent nezobrazí.
- Limity na serveri ako pri DeepL (`docs/translate-limits-setup.md`): počítadlo v Supabase na používateľa a deň + limit na adresu.
- Spotreba sa loguje (tokeny vstup/výstup na požiadavku), aby bolo vidieť skutočný náklad na používateľa a vedelo sa nastaviť cenu.

**Platby** (nevyriešené, treba pred spustením): Stripe cez Vercel funkciu a webhook → príznak `plan` v Supabase.
Pozor: Google Play (balík TWA, `docs/google-play-setup.md`) môže pre digitálne služby vyžadovať **Play Billing**
a províziu – overiť pri rozhodovaní o cene. Vercel Hobby je pre komerčné použitie nevhodný → platený plán.

Namerané (2026-11-17, Haiku 5.5, `docs/chat-assistant-eval.md` beh 4): ~0,0007 USD na otázku, ~0,71 USD za 1000 otázok,
71 % vstupu z cache. Cena predplatného teda nepokrýva tokeny, ale poplatky platobnej brány, DPH a prípadnú províziu Google Play.

Pôvodná orientačná kalkulácia: priemerná otázka ≈ prompt (~2–3 k tokenov so schémami nástrojov a výsledkami) +
odpoveď (~300 tokenov). Pri Flash-Lite / Haiku je to rádovo zlomok centu na otázku; cena predplatného sa určí z nameranej
priemernej spotreby × denný limit × rezerva (poplatky platobnej brány, DPH).

## 4. Technické riešenie

- Vercel funkcia `api/chat.ts` (kľúč poskytovateľa iba v env, napr. `GEMINI_API_KEY`, nikdy v appke), same-origin požiadavky,
  overenie Supabase JWT, kontrola plánu a limitu, potom slučka model ↔ nástroje (max pár krokov), odpoveď streamom.
- Nástroje bežia **na serveri** nad rovnakými dátami (JSON z `src/data/`, zdieľaný kód z `src/lib/`); súbory v `api/` začínajúce
  `_` sa nenasadzujú samostatne (testy).
- UI: panel/obrazovka z Hľadať („Opýtať sa“), história konverzácie len lokálne (Dexie), tlačidlo „Nahlásiť odpoveď“
  (nadviazať na `content-reports`). Offline: skryté / „vyžaduje internet“.
- Ochrana: prompt injection – výsledky nástrojov a text používateľa sú dáta, nie inštrukcie; neposielať osobné údaje do modelu
  (len otázku a prípadne level).

## 5. Fázy

1. **Fáza 0 – prototyp pre seba:** `api/chat.ts` + 4 nástroje (slovo, časovanie, tip, pomoc k appke), Gemini free tier, bez paywallu,
   len prihlásený účet z allowlistu. Cieľ: overiť kvalitu odpovedí a namerať tokeny.
2. **Fáza 1 – paywall:** plán a denné limity v Supabase, Stripe, logovanie spotreby, prepnutie na platený model, privacy policy.
3. **Fáza 2 – personalizácia:** level, Chyby, SRS, uloženie z odpovede, odporúčanie ďalšej lekcie.

## 6. Otvorené rozhodnutia

- Cena a tvar predplatného (mesačne / ročne / balík otázok), skúšobný limit pre free používateľov.
- Platby pri distribúcii cez Google Play (Play Billing vs. Stripe na webe).
- Poskytovateľ pre platenú verziu (Gemini Flash-Lite vs. Claude Haiku 5.5) – rozhodnúť podľa merania kvality španielčiny a ceny.
- Či je asistent len textový, alebo aj s hlasovým vstupom/výstupom (nie teraz).
- Rodená kontrola obsahu (bez nej asistent opakuje chyby v dátach).
