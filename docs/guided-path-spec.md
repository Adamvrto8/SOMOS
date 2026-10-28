# Cesta – riadený kurz (návrh)

Stav: **fázy 1 a 2 postavené** (2026-10-27 a 2026-10-28, osnova A1 – B2), rozhodnutia v časti 10. Fáza 3 čaká.

Cieľ: appka každý deň povie **„dnes toto“**. Učiaci sa nevyberá typ cvičenia, tému a úroveň. Ide po jednej
ceste, kde sa striedajú nové slová, gramatika a typy cvičení, a za ním chodí opakovanie. Cvičiť zostáva ako
voľné cvičenie pre tých, čo chcú niečo konkrétne.

Prvá verzia **nepotrebuje nový obsah**. Cesta je poradie nad dátami, ktoré už máme (slová a vety podľa témy a
úrovne, gramatické tagy viet, 12 tipov „Prečo?“, testy tém), a nad generátormi úloh z `lesson.ts` a `tests.ts`.

---

## 1. Pojmy

- **Cesta** = úrovne A1 → A2 → B1 → B2 za sebou.
- **Úroveň** = rad **jednotiek** a na konci **skúška úrovne** (dnešná skúška z Testov).
- **Jednotka** = jedna téma na danej úrovni (napr. *Jedlo a pitie · A1 · časť 1*) a jeden **gramatický bod**.
  Má 5 – 7 **krokov**, posledný je **test jednotky**.
- **Krok** = jedna lekcia (~10 úloh, ako dnes). Splnený je pri ≥ 80 % (ako číslované lekcie, `passThreshold`).

Veľkosť: jednotka učí najviac ~20 nových slov. Témy, ktoré majú na úrovni viac slov, sa delia na časti
(Základné slová A1 má 56 slov → 3 časti) a časti stoja na ceste ďaleko od seba, aby sa téma vracala.
Odhad: ~25 – 30 jednotiek na úroveň, pri cieli 20 správnych za deň (≈ 2 kroky) zhruba 3 dni na jednotku.

## 2. Jednotka

| Krok | Čo | Z čoho sa skladá |
|---|---|---|
| 1. Nové slová | prvých ~10 slov jednotky | **predstavenie** každého slova (karta: slovo, 🔊, preklad, príklad), potom `vocab` ES → SK |
| 2. Nové slová II | ďalších ~10 (len ak ich jednotka má) | to isté; slová z kroku 1 sa vracajú ako SK → ES |
| 3. Gramatika | gramatický bod jednotky | najprv **tip** (`/grammar/:id`, tlačidlo „Rozumiem, začať“), potom `conjugation` v čase bodu + `cloze` / `choice` z viet s jeho tagom (aj z iných tém na úrovni a nižšie) |
| 4. Vety | vety témy na úrovni | `choice` → `cloze` → `builder` |
| 5. Počúvanie a preklad | tie isté vety, ťažšie | `dictation`, `translation` (bez mikrofónu; diktát sa bez zvuku preskočí, ako dnes) |
| 6. Opakovanie | zmes | Chyby z tejto jednotky, potom slová a vety predošlých jednotiek, ktoré boli najmenej precvičené (ako `prepareLesson`) |
| 7. Test jednotky | 15 úloh, mix typov | dnešný **test témy** (`createTest({ topic, level })`); pri témach delených na časti len z materiálu časti |

- Úlohy vyberajú dnešné generátory. Cesta len určuje, z akých slov a viet a v akom poradí. Kroky 1 – 5 majú
  **stálé úlohy** (ako číslované lekcie, `getStablePool`), krok 6 a test sa ťahajú zakaždým nanovo.
- Krok, ktorý nemá z čoho (téma bez viet s daným tagom, málo slov), sa z jednotky vypustí.
- **Predstavenie slova** je jediný nový typ úlohy: karta bez hodnotenia, ráta sa ako videné, nie ako pokus.
  Dnes `vocab` hneď pýta preklad slova, ktoré učiaci sa ešte nevidel. Na ceste to nechceme.

## 3. Poradie (osnova)

Súbor `src/data/path.json` (ručne zostavený, kontroluje ho `validate:data`):

```jsonc
{ "id": "a1-04", "level": "A1", "topic": "family", "part": 1, "grammar": "presente", "rule": "ar" }
```

- `part` = ktorá časť témy (slová a vety témy na úrovni v poradí dát, rozdelené rovnomerne).
- `grammar` = id tipu, `rule` = jeho pravidlo (voliteľné). Bod určuje, čo je v kroku 3.
- Validátor: každá dvojica téma × úroveň s obsahom je na ceste celá (žiadne slovo ani veta navyše ani chýbajúce),
  tip a pravidlo existujú, v rámci úrovne sa body neopakujú hneď za sebou.

Návrh gramatiky podľa toho, čo vety naozaj obsahujú (A1: 255 viet v prítomnom čase, 57 ser/estar, 39 rod,
22 progresív, pretérit takmer žiadny; pretérit, imperfektum a futúrum až od A2):

| Úroveň | Body v poradí |
|---|---|
| A1 | ser (kto som, odkiaľ) → členy → rod → presente -ar → presente -er/-ir → estar (kde) → nepravidelné tvary yo → kmeňové zmeny → prídavné mená → estar (stav) → progresív → zvratné slovesá → prízvuky |
| A2 | pretérit -ar → pretérit -er/-ir → nepravidelné kmene → pretérit ser/ir → imperfektum → pretérit × imperfektum → futúrum → ir a + infinitív |
| B1 | pretérit × imperfektum (pozadie, zvyk) → nepravidelné futúrum → ser/estar (výsledok, výrazy) → zmes |
| B2 | zmes, dôraz na preklad a skladanie |

Ukážka začiatku A1 (témy od najpotrebnejších):

| # | Jednotka | Gramatika |
|---|---|---|
| 1 | Pozdravy a frázy 1 | ser: kto som, odkiaľ som |
| 2 | Základné slová 1 | členy el / la / un / una |
| 3 | Čísla 1 | rod podstatných mien |
| 4 | Rodina 1 | presente: -ar |
| 5 | Jedlo a pitie 1 | presente: -er / -ir |
| 6 | Domov a bývanie 1 | estar: kde niečo je |
| 7 | Čas a dni 1 | nepravidelné yo (tengo, hago) |
| 8 | Mesto 1 | ir, tener |
| 9 | Základné slová 2 | opakovanie: presente |
| … | … | … |

Body bez vlastného typu úloh (prídavné mená, prízvuky) majú v kroku 3 len tip a vety s tagom `gender` alebo
mix. Neskôr sa dá pridať vlastné cvičenie.

## 4. Denný plán

Domov ukáže namiesto karty „Pokračovať“ **dnešný plán**:

1. **Zopakovať** (ak je niečo na rade, dnešné SRS, `ReviewCard`). Najviac ~20 kariet, zvyšok zajtra.
2. **Ďalší krok cesty** (*Jednotka 4 · Rodina · krok 3 z 7: Gramatika*), veľké tlačidlo.
3. Keď je denný cieľ splnený: „Dnes hotovo. Ešte jeden krok?“

Cesta nepočíta čas ani lekcie navyše, denný cieľ a séria zostávajú, ako sú (správne odpovede).

## 5. Obrazovky

- **Domov**: hlavná karta = ďalší krok (bod 4). Pod ňou zostáva séria, cieľ, slovo dňa.
- **Cvičiť → nahor karta „Cesta“** s pokrokom (*A1 · jednotka 4 z 27*), pod ňou dnešný hub (typy cvičení,
  Chyby, Testy, Gramatika, Duel). Žiadna piata záložka.
- **Cesta** (`/practice/path`): zoznam jednotiek po úrovniach, aktuálna jednotka rozbalená, hotové so ✓, budúce sivé.

```
  A1 · 3 z 27 jednotiek          ▓▓▓░░░░░░░░░
  ✓ 1  Pozdravy a frázy 1        ser
  ✓ 2  Základné slová 1          členy
  ● 3  Čísla 1                   rod
       ✓ Nové slová   ✓ Gramatika   ● Vety
       ○ Počúvanie    ○ Opakovanie  ○ Test
  ○ 4  Rodina 1                  presente -ar
  ○ 5  Jedlo a pitie 1           presente -er/-ir
  ...
  ○ Skúška A1
```

- **Krok** = dnešná lekcia (`LessonPage`) s hlavičkou jednotky. Výsledok: „Ďalej: Vety“ namiesto
  „Nová lekcia“. Pri neúspechu „Skúsiť znova“ (pokračuje nevyriešenými úlohami, ako dnes `solved`).
- **Koniec jednotky**: krátka oslava (ako slnko denného cieľa), čo pribudlo (*+18 slov, presente -ar*).

## 6. Odomykanie a preskakovanie

Návrh (otázka 1): kroky jednotky idú za sebou. Ďalšia jednotka sa otvorí po teste predošlej. Kto látku vie,
môže jednotku **preskočiť testom**: „Viem to – urobiť test“ na jednotke, pri úspechu sú všetky jej kroky
hotové. Preskočenú úroveň uzavrie jej skúška.

Štart podľa uvítania: úroveň z uvítania = prvá jednotka tej úrovne. Nižšie úrovne sú otvorené, nie hotové.
Prvá lekcia uvítania (`&first=1`) bude krok 1 prvej jednotky.

## 7. Doterajší pokrok

Nikto nezačína od nuly:
- **splnený test témy** (téma × úroveň) = jednotky tej témy na tej úrovni sú hotové (všetky časti),
- **splnená skúška úrovne** = celá úroveň je hotová,
- číslované lekcie z Cvičiť sa nerátajú (sú podľa typu cvičenia, nie podľa jednotiek), ale ich úlohy sa
  prejavia v kroku Opakovanie (menej precvičené idú skôr).

Adam s doterajšími testami začne tam, kde mu chýba prvý test.

## 8. Uloženie a synchronizácia

- Kroky sa ukladajú do **tej istej mapy ako číslované lekcie** (`lessonProgress.ts`) pod kľúčom
  `path:<jednotka>:<krok>` (napr. `path:a1-04:3`). Tým funguje záloha, obnova aj synchronizácia medzi
  zariadeniami bez zmeny servera (druh `lesson` v `src/lib/sync/kinds.ts`).
- Test jednotky = výsledok testu témy (`testProgress.ts`), pri časti kľúč `<topic>:<level>:<part>`.
- Odkiaľ pokračovať sa nikde neukladá. Počíta sa: prvý nesplnený krok prvej neuzavretej jednotky.
- Pokusy (`Attempt`) zostávajú, ako sú (`exercise` = typ úlohy). Štatistiky, denný cieľ a Chyby fungujú ďalej.

## 9. Kód

| Súbor | Čo |
|---|---|
| `src/data/path.json` + typ `PathUnit` v `types.ts` | osnova |
| `scripts/validate-data.ts` | kontrola osnovy (bod 3) |
| `src/lib/path.ts` | čisté funkcie: materiál jednotky (slová, vety časti), kroky jednotky, úlohy kroku, stav cesty z mapy lekcií a testov, ďalší krok. Testy `path.test.ts` |
| `src/lib/lesson.ts` | úloha `meet` (predstavenie slova) |
| `src/features/path/` | `PathPage`, `UnitCard`, hlavička kroku, koniec jednotky |
| `src/features/home/` | karta dnešného plánu namiesto `continueLesson` |
| `src/features/exercises/PracticeHub.tsx` | karta Cesta navrch |
| `e2e/path.spec.ts` | prejdenie jednotky, preskočenie testom, prevzatie doterajších testov |

Fázy:
1. **Osnova a jadro**: `path.json` pre A1, `path.ts`, obrazovka Cesta, kroky ako lekcie, prevzatie testov,
   karta na Domove. Bez predstavenia slov (krok 1 je zatiaľ `vocab` ES → SK).
2. **Predstavenie slov**, tip pred gramatikou, koniec jednotky, A2 – B2 v osnove.
3. **Doladenie**: preskočenie testom, ponuka vyššej úrovne po 10/10 v prvej jednotke (lacná náhrada
   rozraďovacieho testu), oslava úrovne.

## 10. Rozhodnuté (Adam, 2026-10-27)

1. **Zámky**: postupne. Kroky jednotky idú za sebou, ďalšia jednotka sa otvorí po teste predošlej. Test
   jednotky je otvorený hneď („Viem to“): kto ho splní, má jednotku hotovú.
2. **Poradie**: pevná osnova (`path.json`), ale téma z dôvodu v uvítaní ide hneď za prvé dve jednotky
   (`orderedUnits` v `pathUnits.ts`).
3. **Domov**: hlavnú kartu nahrádza ďalší krok cesty (kým cesta má úroveň učiaceho sa). Kto v uvítaní
   zvolil A2 alebo B1, má zatiaľ starú kartu „Pokračovať“.
4. **Rozsah**: najprv len A1 (36 jednotiek), A2 – B2 vo fáze 2 (hotové 2026-10-28).
5. **Diktát**: zostáva v kroku 5.

## 10a. Fáza 1, ako je postavená

- Osnova `src/data/path.json`: 36 jednotiek A1. Slovo a veta patria do témy, ktorú majú uvedenú ako prvú.
  Téma sa delí na časti, aby jednotka mala najviac 20 slov. Kontroluje to `validate:data`.
- `src/lib/pathUnits.ts`: jednotky a ich materiál. `src/lib/path.ts`: kroky, úlohy, stav a ďalší krok.
- Krok Gramatika berie úlohy, ktoré tip „Prečo?“ vysvetľuje bodom jednotky (tip + pravidlo). Rod nemá
  vlastné doplňovačky, preto berie člen alebo prídavné meno vo vetách s tagom `gender`. Zvratné slovesá
  a prízvuky majú vlastný výber.
- Test jednotky je test témy. Pri téme rozdelenej na časti je to test časti (`food:A1:2`, `?part=2`), ktorý
  sa pýta len z materiálu svojej jednotky.
- Obrazovka je na `/practice/path` (záložka Cvičiť), nie na `/path`.
- Uvítanie pri A1 vedie do kroku 1 prvej jednotky.

## 10b. Fáza 2, ako je postavená (2026-10-28)

- **Osnova A2 – B2**: 35 + 27 + 23 jednotiek, spolu 121. Téma sa delí na časti tak ako v A1 (najviac 20 slov).
  A2 ide po bodoch pretérit -ar → -er/-ir → nepravidelné kmene → ser/ir → pravopis, imperfektum, pretérit ×
  imperfektum, futúrum. B1 a B2 striedajú body (pretérit × imperfektum, nepravidelné futúrum, ser/estar
  výsledok a výrazy, zvratné slovesá, prízvuky…), lebo vety týchto úrovní nemajú nové gramatické javy.
- Bod **pretérit × imperfektum** nemá časovanie, krok Gramatika berie doplňovačky oboch časov.
- **Štart podľa uvítania**: kto zvolil A2 alebo B1, začína prvou jednotkou tej úrovne. Nižšie úrovne sú otvorené
  (nie hotové) a cesta sa k nim vráti, až keď je zvyšok prejdený. Téma z dôvodu ide za prvé dve jednotky
  štartovej úrovne. Domov ukazuje cestu každému (starú kartu „Pokračovať“ už nikto nemá).
- **Predstavenie slov** nie je nový typ úlohy, ale **karty pred úlohami** krokov Nové slová a Nové slová II
  (slovo s členom a 🔊, druh, rod, preklad, množné číslo, príklad, poznámka). Listujú sa tlačidlami, potiahnutím
  aj šípkami, dajú sa preskočiť. Nič sa neukladá a nerátajú sa ako pokus.
- **Tip pred gramatikou**: krok Gramatika začne celým tipom s vyznačenými pravidlami jednotky („Dnes: …“) a
  tlačidlom „Rozumiem, začať“.
- Karty aj tip sa ukážu len pri kroku začatom odznova. Krok už splnený alebo rozrobený ide rovno na úlohy.
- **Koniec jednotky** je na výsledku zloženého testu jednotky: „¡Unidad completada!“, koľko slov pribudlo,
  gramatický bod a tlačidlo na ďalší krok cesty. Test jednotky vedie späť na Cestu, nie na Testy.
- Obrazovka Cesta: úrovne sa dajú zbaliť, otvorená je tá, kde je ďalší krok.
- Kroky jednotky sa počítajú, až keď ich niečo potrebuje (Domov a Cesta len aktuálnu a otvorené jednotky):
  stav 121 jednotiek trvá ~8 ms namiesto ~140 ms.

## 11. Mimo rozsahu

Rozraďovací test, vlastné nahrávky, nové cvičenia pre prídavné mená a prízvuky, rebríčky, cesta v duele.
