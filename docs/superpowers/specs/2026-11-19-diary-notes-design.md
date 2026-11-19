# Denník ako poznámky – návrh (2026-11-19)

## Prečo
Adam sa v Denníku nevyzná: dve polia („Čo som sa dnes naučil“, „Po španielsky“), kontrola s podčiarknutými slovami
a otázka dňa. Denník má slúžiť hlavne na to, **aby si zapamätal veci** (slovíčka, pravidlá, vysvetlenia od SOMO);
písanie po španielsky je vedľajšie a kontrolu viet zvládne SOMO.

## Rozhodnutia (Adam)
- Jeden voľný text na deň, viazaný na dátum (denníkový efekt). Bez polí, bez kontroly španielčiny.
- Ostáva názov **Denník** a **karta na Domove**. Otázka dňa a podčiarkovanie neznámych slov zmiznú.
- Pod odpoveďou SOMO **„Uložiť do Denníka“**: na koniec dnešného zápisu sa pridá otázka aj odpoveď ako čistý text.
- „Kopírovať konverzáciu“ zatiaľ ostáva (kvôli evalu); neskôr malé tlačidlo.

## 1. Dáta
- `DiaryEntry` = `{ date, text, createdAt, updatedAt }` (namiesto `learned` + `es`).
- Prevod starého tvaru: `text = [learned, es]` bez prázdnych, spojené prázdnym riadkom. Jedna funkcia
  `toDiaryEntry(x)` (prijme nový aj starý tvar, inak `null`) slúži Dexie upgradu, synchronizácii aj záloh.
- Dexie: nová verzia s `upgrade`, ktorá prevedie všetky riadky `diary`. Indexy sa nemenia.
- Synchronizácia (`src/lib/sync/kinds.ts`) a záloha (`src/lib/backup.ts`) prevedú prichádzajúci starý tvar cez
  `toDiaryEntry`. Server ukladá záznam ako JSON: SQL netreba.
- `DIARY_MAX` 5 000 → 20 000 znakov (pribúdajú odpovede SOMO). Prázdny text = deň sa zmaže (ako doteraz).
- `appendToDiary(date, block)`: pridá blok na koniec zápisu (oddelený prázdnym riadkom), vytvorí deň, ak neexistuje;
  ak zápis blok už obsahuje, nič nezmení (`'unchanged'`); text nad limit sa nepridá (`'full'`).

## 2. Obrazovky
- **Zápis dňa** `/diary/:date`: späť, „Uložené“, dátum ako nadpis, jedno textové pole na celú výšku
  (placeholder „Čo si chceš zapamätať?“). Ukladanie priebežne ako doteraz (800 ms po písaní, pri odchode).
- **Zoznam** `/diary`: Dnes hore, potom staršie dni; pri každom dátum a prvý neprázdny riadok textu.
- **Karta na Domove**: „Dnešný zápis“ + „Všetky zápisy“; so zápisom ✓ a prvý riadok; bez zápisu výzva
  „Zapíš si, čo si chceš zapamätať“ a tlačidlo „Napísať“.
- Zmiznú: `src/data/diaryPrompts.json` (+ typ `DiaryPrompt`, `promptOfDay`), `DiaryCheck.tsx`, `src/lib/diaryCheck.ts`
  a ich texty v i18n (sk aj en).

## 3. Uloženie zo SOMO
- Pod každou odpoveďou vedľa 👍 / 👎 ikona „Uložiť do Denníka“ (aria-label). Po uložení text „Uložené do Denníka“
  s odkazom na dnešný zápis; ak tam blok už je, rovnaké potvrdenie (nič sa nepridá).
- Text bloku (`turnAsNote(turn)` v `src/lib/assistant/`):
  - prvý riadok(y): otázka tak, ako bola poslaná (aj s riadkami úlohy pri „Prečo?“),
  - odpoveď ako čistý text: bez `**`/`*`, odkazy len ako ich text, zástupné adresy preč, príklady „- veta – preklad“,
  - karty ako text: slovo `el carro – auto`, časovanie `tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron`
    (podľa variantu z dát appky), tip `Tip: ser a estar`,
  - bez `{{dalej:…}}` a bez nefunkčných značiek.

## 4. SOMO a ostatné
- Mapa appky (`appGuide.ts`, sekcia Denník): jeden text na deň, karta na Domove, ukladanie odpovedí SOMO; bez kontroly.
- Profil pre SOMO (`learner.ts`): posledné zápisy = začiatok `text` (160 znakov) namiesto `learned`.
- `get_my_records diary` (`records.ts`) vracia nový tvar.
- Ochrana súkromia: „zápisy v denníku“ ostáva pravdou, bez zmeny.

## Testy
- Unit: `toDiaryEntry` (nový, starý, neplatný tvar), `saveDiaryEntry`, `appendToDiary` (nový deň, pridanie,
  duplicita, limit), `turnAsNote` (karty, odkazy, tučné, kurzíva, ďalšie otázky), záloha a synchronizácia so starým tvarom.
- E2E: napísať zápis, návrat, zoznam a karta na Domove; uloženie odpovede SOMO do Denníka a jej text v zápise;
  existujúce testy Denníka upraviť.

## Mimo rozsahu
- Viac poznámok za deň, značky, vyhľadávanie v Denníku, výber časti odpovede na uloženie, malé tlačidlo kopírovania.
