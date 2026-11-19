# Denník ako poznámky – návrh (2026-11-19)

## Prečo
Adam sa v Denníku nevyzná: dve polia („Čo som sa dnes naučil“, „Po španielsky“), kontrola s podčiarknutými slovami
a otázka dňa. Denník má slúžiť hlavne na to, **aby si zapamätal veci** (slovíčka, pravidlá, vysvetlenia od SOMO);
písanie po španielsky je vedľajšie a kontrolu viet zvládne SOMO.

## Rozhodnutia (Adam)
- Bez polí, bez kontroly španielčiny. Ostáva názov **Denník** a **karta na Domove**. Otázka dňa a podčiarkovanie
  neznámych slov zmiznú.
- Druhé kolo (po skúške na telefóne, 2026-11-19): ako Google Denník. **Viac poznámok za deň**, každá s
  **nepovinným nadpisom**; „Uložiť“ poznámku uloží a zavrie, v zozname je pod svojím dňom.
- Pod odpoveďou SOMO **„Uložiť do Denníka“** = **nová poznámka**: nadpis je otázka, text odpoveď.
  Riadok „Tip: …“ a vety s odkazom do appky („Na precvičenie si otvor gramatiku…“) sa vynechajú, v poznámke nič neznamenajú.
- „Kopírovať konverzáciu“ zatiaľ ostáva (kvôli evalu); neskôr malé tlačidlo.

## 1. Dáta
- `DiaryNote` = `{ id, date, title, text, createdAt, updatedAt }`; `date` = deň, pod ktorým je v zozname.
- Staršie tvary (jeden text na deň, pred ním `learned` + `es`) sa stanú poznámkou s **`id` = dátum** a prázdnym
  nadpisom. Jedna funkcia `toDiaryNote(x)` slúži synchronizácii aj záloham; tak ostávajú kľúče synchronizácie
  (druh `diary`, kľúč = `id`) aj staré záznamy na serveri platné. Server ukladá záznam ako JSON: SQL netreba.
- Dexie nevie zmeniť kľúč tabuľky: verzia 8 pridá `diaryNotes: 'id, date, updatedAt'` a prenesie do nej dni z `diary`,
  verzia 9 tabuľku `diary` zmaže.
- `DIARY_MAX` 20 000 znakov textu, `TITLE_MAX` 200. Poznámka bez nadpisu aj textu sa zmaže.
- `addDiaryNote(date, title, text)`: nová poznámka; rovnaký nadpis aj text v ten deň už je → nič nepridá.
- Nové `id`: `n-<čas><náhoda>` (`crypto.randomUUID` na LAN dev serveri nie je).

## 2. Obrazovky
- **Zoznam** `/diary`: „Nová poznámka“ hore; poznámky podľa dní (Dnes, Včera, dátum), v dni najnovšia hore.
  Karta: nadpis (bez neho prvý riadok textu), pod ním začiatok textu.
- **Poznámka** `/diary/new` a `/diary/:id`: späť, „✓ Uložené“, **„Uložiť“** (uloží a vráti do zoznamu: späť, ak prišla
  zo zoznamu, inak zoznam namiesto poznámky), dátum dňa, nadpis (rastie s textom, bez zalomení), text na celú výšku,
  dole „Vymazať poznámku“ s potvrdením („Nechať“ / „Vymazať“). Ukladá sa aj priebežne (800 ms po písaní, pri odchode,
  pri prechode appky na pozadie). Nová poznámka, z ktorej sa odíde prázdna, nevznikne. Neexistujúce `id` → zoznam.
- **Karta na Domove**: „Denník“ (✓, ak je dnes poznámka) + „Všetky poznámky“; dnešná najnovšia poznámka, inak výzva
  „Zapíš si, čo si chceš zapamätať“; „Napísať“ vždy otvorí novú poznámku.
- Zmiznú: `src/data/diaryPrompts.json` (+ typ `DiaryPrompt`, `promptOfDay`), `DiaryCheck.tsx`, `src/lib/diaryCheck.ts`
  a ich texty v i18n (sk aj en).

## 3. Uloženie zo SOMO
- Pod každou odpoveďou vedľa 👍 / 👎 ikona „Uložiť do Denníka“ (aria-label). Po uložení „Uložené do Denníka · Otvoriť“
  (odkaz na tú poznámku).
- `turnAsNote(turn)` v `src/lib/assistant/note.ts` vráti `{ title, text }`:
  - nadpis = prvý riadok otázky; ďalšie riadky (úloha pri „Prečo?“) otvoria text,
  - odpoveď ako čistý text: bez `**`/`*`, zástupné adresy preč, príklady „- veta – preklad“,
  - vety (a body zoznamu) s odkazom do appky sa vynechajú,
  - karty: slovo `el carro – auto`, časovanie `tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron`
    (podľa variantu z dát appky); tip sa vynechá,
  - odseky, zoznam príkladov a skupina kariet sú oddelené prázdnym riadkom (karty idúce po sebe ostávajú spolu),
  - bez `{{dalej:…}}` a bez nefunkčných značiek.

## 4. SOMO a ostatné
- Mapa appky (`appGuide.ts`, sekcia Denník): poznámky podľa dní, nadpis, Uložiť a Vymazať, ukladanie odpovedí SOMO.
  SOMO smie odkázať na `/diary` a `/diary/new`.
- Profil pre SOMO (`learner.ts`): počet poznámok, posledné tri ako „nadpis – text“ (160 znakov).
- `get_my_records diary` (`records.ts`): dátum, nadpis (ak je) a text.
- Výsledok obnovy zálohy: „poznámky v denníku: N“. Ochrana súkromia: „zápisy v denníku“ ostáva pravdou, bez zmeny.

## Testy
- Unit: upgrade Dexie (dni → poznámky), `toDiaryNote` (nový, oba staré, neplatný tvar), `saveDiaryNote`, `addDiaryNote`,
  `newerDiaryNotes`, `byNewest`, `turnAsNote` (nadpis, karty, tipy, vety s odkazmi), záloha a synchronizácia.
- E2E: nová poznámka, Uložiť → zoznam, druhá poznámka cez Späť, opätovné otvorenie a reload; prázdna nevznikne,
  vymazaná zmizne; Vymazať s potvrdením; karta na Domove; uloženie pri prechode na pozadie; odpoveď SOMO ako poznámka.

## Mimo rozsahu
- Značky, vyhľadávanie v Denníku, výber časti odpovede na uloženie, presun poznámky na iný deň, malé tlačidlo kopírovania.
