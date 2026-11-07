# Španielčina zo Španielska (es-ES) popri mexickej — podklady

Stav: podklady na rozhodnutie, nič nie je postavené (2026-11-05). Nadväzuje na pamätku „Future languages“
(2026-11-03): pri verejnom vydaní má SOMOS pokryť Španielsko aj Mexiko. „Bežná španielčina“ tu znamená
**kastílsku španielčinu zo Španielska (`es-ES`)**, teda tú, ktorú učia učebnice a kurzy. Ak ide o neutrálnu
„latinskoamerickú“ variantu bez mexikanizmov, dá sa to urobiť rovnakým mechanizmom, mení sa len zoznam rozdielov.

## 1. Čo sa dnes líši (inventúra dát, 2026-11-05)

Dáta: 1681 slov, 283 slovies, 1971 viet, 28 gramatických tipov.

| Oblasť | Stav dnes | Dosah na es-ES |
|---|---|---|
| Slovná zásoba | ~48 slov s mexickou voľbou (carro, celular, jugo, papa, platicar, manejar…) + ~110 poznámok `note`, ktoré spomínajú Mexiko alebo Španielsko | prepísať `es`, `plural`, príklady, poznámku |
| Vety | **234 z 1971 (~12 %)** obsahuje mexickú lexiku (celular 24, computadora 15, carro 14, renta 14, chamarra 13, camión 12, departamento 12…) | tieto vety sa musia upraviť alebo mať druhú verziu |
| Osoby | 5 osôb, **vosotros neexistuje** (typ `Person`, validátor ho zakazuje) | pribudne 6. osoba `vosotros` v každom čase |
| Slovesá | 283 × 8 časov/spôsobov, `ustedes` = `ellos` | doplniť tvary vosotros; imperatív vosotros (hablad/no habléis) |
| Minulý čas | predvolený pretérito; vety s `he/has/ha + -ado/-ido`: 0 | v Španielsku sa pre „dnes/tento týždeň/už“ používa **pretérito perfecto compuesto**: nový čas |
| Zámená | `lo/la/le` bez leísmu | leísmo (le veo) je bežné v Španielsku; len poznámka, nie povinné |
| Výslovnosť | TTS: `es-mx`, `es-us`, `es-419` | `es-ES` hlas; pozor na ceceo (c/z = [θ]) |
| Tipy | 28 tipov, jeden o ustedes | pridať tip vosotros a perfecto |
| Validátor | `SPAIN_ONLY` zakazuje coche, ordenador, móvil… | pravidlá podľa variantu |

## 2. Slovná zásoba: mexický → španielsky tvar

Zoznam vychádza z poznámok, ktoré už v dátach sú, a z `SPAIN_ONLY` vo `validate-data.ts`. **Nutné skontrolovať
rodným hovorcom**, nič z toho nebolo overené.

| Slovenčina | MX (dnes) | ES |
|---|---|---|
| auto | carro | coche |
| počítač | computadora | ordenador |
| mobil | celular | móvil |
| džús | jugo | zumo |
| zemiak | papa | patata |
| šoférovať | manejar | conducir |
| prenajať | rentar / la renta | alquilar / el alquiler |
| zaparkovať | estacionar | aparcar |
| lístok | boleto | billete |
| okuliare | lentes | gafas |
| pero | pluma | bolígrafo |
| byt | departamento | piso |
| spálňa | recámara | dormitorio (habitación) |
| sprcha | regadera | ducha |
| deka | cobija | manta |
| žiarovka | foco | bombilla |
| inštalatér | plomero | fontanero |
| bazén | alberca | piscina |
| chodník | banqueta | acera |
| autobus | camión | autobús |
| tričko | playera | camiseta |
| bunda | chamarra | chaqueta / cazadora |
| tenisky | tenis | zapatillas / deportivas |
| zips | cierre | cremallera |
| náušnica | arete | pendiente |
| čašník | mesero | camarero |
| paradajka | jitomate | tomate |
| tortilla | tortilla (placka) | tortilla (zemiaková omeleta) |
| rozprávať sa | platicar | charlar / hablar |
| vrátiť sa | regresar | volver |
| nahnevaný | enojado / enojarse | enfadado / enfadarse |
| zapnúť | prender | encender |
| náplasť | curita | tirita |
| chrípka / nádcha | gripa | gripe |
| slúchadlá | audífonos | auriculares |
| rúško | cubrebocas | mascarilla |
| zálohovanie | respaldo | copia de seguridad |
| pokazený | descompuesto | estropeado |
| prepadnúť na skúške | reprobar | suspender |
| letenka | boleto de avión | billete de avión |
| rezervácia | reservación | reserva |
| udržateľný | sustentable | sostenible |
| prízvuk slova video | video | vídeo |
| hneď | ahorita | ahora mismo / enseguida |
| dobre / ok | órale, sale, ándale | vale |
| super | chido, padre | guay, genial |
| chlapec, kamarát | chavo, cuate | chaval, tío, colega |
| peniaze | lana | pasta, dinero |
| robota | chamba / chambear | curro / currar, trabajo |

### Čo z mexickej zásoby nemá španielsky ekvivalent
Slová viazané na Mexiko (mariachi, tianguis, tamal, antojito, quinceañera, lucha libre, pueblo mágico, tinaco,
fraccionamiento, nopal, mande, no manches…) sa v es-ES **nenahrádzajú, ale skrývajú** alebo označia ako „mexické“.
Návrh: značka `region: 'mx'` na slove, vo variante es-ES sa zo slovníka a lekcií vynechá, vo vyhľadávaní sa nájde
s poznámkou „Mexiko“.

### Čo sa v Španielsku pridá navyše (bežné slová, ktoré v dátach chýbajú)
vale, tío/tía, guay, mogollón, molar, flipar, curro, chaval, colega, pasta, quedar (=dohodnúť sa), ¿qué tal?,
¡anda!, ¡hombre!, ¡venga!, vosotros-pozdravy (¿cómo estáis?), zapatillas, gafas de sol, grifo, tarjeta de embarque.
Orientačne **60–100 nových slov** k už pripraveným a ~100 viet v ES.

## 3. Gramatika

1. **Vosotros** — rozšíriť `Person` o `'vosotros'` (6 osôb). Tvary sa dajú takmer celé odvodiť z pravidiel
   (-áis/-éis/-ís, pretérito -asteis/-isteis, imperfecto -abais/-íais, futuro -éis, subjuntivo -éis/-áis,
   condicional -íais); nepravidelnosti sú tie isté ako pri ostatných osobách, ale validátor ich musí overiť.
   Imperatív: afirmativ na -ad/-ed/-id, negatív cez subjuntivo (no habléis); reflexívne: levantaos.
   **Dôležité:** v mexickej variante ostáva `vosotros` skrytý, rovnako `ustedes` ostane v es-ES (formálne množné).
   Preto každá tabuľka/cvičenie dostane „aktívne osoby podľa variantu“ (5 vs 6), nie nový typ.
2. **Pretérito perfecto compuesto** (he hablado, hemos comido): nový čas v tabuľke slovies a cvičení; v es-ES je
   predvolený pre „dnes, este año, ya, todavía no“. Pomocné `haber` + particípium; nepravidelné particípiá
   (hecho, dicho, visto, puesto, escrito, abierto, vuelto, roto, muerto, cubierto). Dnešné pravidlo
   „default = pretérito“ platí len pre mexickú variantu.
3. **Pretérito vs. perfecto — nový tip** a rozlišovacie cvičenia (hoy he ido / ayer fui).
4. **Leísmo** — poznámka v tipoch, nie v cvičeniach (le veo / lo veo je v Španielsku obe správne).
5. **Výslovnosť** — ceceo: c pred e/i a z = [θ]. TTS to zabezpečí es-ES hlas, ale sk poznámky o výslovnosti
   (tipy) treba mať variantné.
6. **Imperfecto de subjuntivo** — dnes len -ra (Mexiko); v Španielsku je bežné aj -se (hablase). Len poznámka.
7. **Zámenné slovosledy** — „dámelo“ → v ES „dámelo“, bez rozdielu; „se lo/se los“ rovnaké. Bez zmeny.

## 4. Technický návrh (nezačínať, kým si ho nepotvrdíš)

Princíp z pamätky: **neprepisovať základ, pridať vrstvu**, rovnako ako angličtinu (`src/data/en/`).

```
src/data/
  words/ sentences/ verbs/     základ = mexický (nemenné, 1 pravda)
  es/                          prekrytie es-ES, párované podľa `id`
    words/<topic>.json         { id, es?, plural?, feminine?, examples?, note?, hidden? }
    sentences/<topic>.json     { id, es, tokens, cloze? }    prepíše celú vetu, SK ostane
    new-words/, new-sentences/ obsah, ktorý v MX nie je (vale, guay…), s novými id
    verbs-vosotros.json        { verbId, presente:{vosotros}, … }  (alebo odvodiť + výnimky)
```

- **Variant** (`'mx' | 'es'`) je nastavenie profilu (Nastavenia → Španielčina), uložené v Dexie aj v sync.
  Predvolene `mx`. Pri onboardingu otázka „Akú španielčinu sa učíš?“.
- `src/data/index.ts` zlúči prekrytie podľa variantu (rovnako ako dnes en overlay), takže zvyšok appky vidí
  len `Word`, `Sentence`, `Verb`. Cvičenia, SRS, štatistiky a sync sa nemenia, **ale id úloh musia ostať
  stabilné**, aby sa pokrok pri prepnutí variantu nestratil. Nové es-slová dostanú vlastné id.
- **Pokrok pri prepnutí variantu:** rovnaké `id` = rovnaká karta; slová, ktoré existujú len v jednej variante,
  sa v druhej nezobrazia (ale pokrok ostane uložený).
- `Person` + `activePersons(variant)`; `conjugate.ts`, tabuľky a drill podľa neho.
- Nový čas `perfecto` do `TABLE_TENSES` (aktívny len pre es; pre mx voliteľne tiež, ako bonus).
- **Validátor** (`validate-data.ts`): pravidlá podľa variantu. Pre `mx`: ako dnes. Pre `es`: zakáž mexické
  slová zo zoznamu v §2 (opačný smer `SPAIN_ONLY`), skontroluj tvary vosotros, `cloze.tokenIndex`, `tokens` rebuild
  na zlúčených dátach, každé `id` v prekrytí existuje v základe. Test s oboma variantmi v CI.
- `checkAnswer`/`knownForms`: `lookupForm` musí poznať tvary podľa variantu (carro v es = preklep? skôr nepriznať
  ako zlú odpoveď, ale ponúknuť „v Španielsku coche“).
- **TTS:** `PREFERRED_LANGS` podľa variantu (`es-es` → `es-*`; mx ako dnes).
- **Vyhľadávanie:** index obsahuje obe formy (hľadám „coche“ v mx → nájde carro s poznámkou, a naopak).
- **Tipy a poznámky:** `note` je dnes jeden text s „v Španielsku X“. Zmeniť na `notes: { mx?: string; es?: string }`
  (CLAUDE.md pamätka: kľúčovať podľa variantu), tu to najprv platí pre ~110 poznámok.

## 5. Obsah, ktorý treba doplniť (rozsah)

| Položka | Počet (odhad) | Poznámka |
|---|---|---|
| Prekrytie slov (es mení) | ~60 | tabuľka §2 + plural/gender |
| Prekrytie viet (es mení) | ~234 | všetky vety s mexickou lexikou; väčšina len 1 token |
| Nové slová es | 60–100 | vale, guay, tío… |
| Nové vety es | ~100 | hovorová španielčina, perfecto, vosotros |
| Tvary vosotros | 283 slovies × 8 časov | generované skriptom, nepravidelné ručne skontrolované |
| Perfecto compuesto | 283 slovies | particípiá, nepravidelné ručne |
| Tipy | 4–6 | vosotros, perfecto vs. pretérito, leísmo, ceceo, vale, rozdiely MX/ES |
| Poznámky `note` | ~110 | rozdeliť na `mx` / `es` |
| Anglické prekrytie | rovnaký rozsah | en overlay nesie SK → EN text, treba prepísať vety aj poznámky |

Prácu sa oplatí robiť skriptmi: (1) skript, ktorý vypíše vety s mexickou lexikou a navrhne náhrady
(`scripts/report-blanks.ts` je podobný vzor), (2) generátor vosotros a perfecto + validátor, (3) ručná kontrola
nepravidelných a hovorových vecí. Obsah nezrobiť naslepo: ako pri mexickej verzii **žiadny rodený hovorca
nekontroloval nič**; pred vydaním treba rodeného hovorcu zo Španielska.

## 6. Navrhované poradie

1. **Rozhodnutia** (§7), potom krátky návrh dátového tvaru (varianta + prekrytie).
2. **Základ:** typ `Variant`, nastavenie, `activePersons`, zlučovanie prekrytia, validátor pre es. Bez nového obsahu,
   es = mx, testy zelené.
3. **Vosotros + perfecto compuesto** v slovesách (generátor + tabuľka + drill + tipy). Najväčší rozdiel v učení.
4. **Slovná zásoba a vety**: prekrytie pre ~60 slov a ~234 viet, potom nové es-slová.
5. **TTS, vyhľadávanie, onboarding** (výber variantu).
6. **Kontrola rodeným hovorcom** pred zapnutím es pre všetkých; do tej doby za prepínačom (dev režim).

Odhad: kroky 1–3 sú technické (porovnateľné s „Guided path“), 4 je obsahová práca podobná jednej dávke B2.

## 7. Otvorené rozhodnutia (potrebujem tvoje áno/nie)

1. **Čo znamená „bežná španielčina“?** Španielsko (es-ES, odporúčam, má vosotros a perfecto), alebo neutrálna
   latinskoamerická bez mexikanizmov? Návrh vychádza zo Španielska.
2. **Dve varianty vedľa seba, alebo jedna zmiešaná?** Odporúčam prepínač (`mx` / `es`) v nastaveniach, každý
   používateľ jednu. Zmiešanie by pre začiatočníka bolo mätúce.
3. **Vosotros v es-ES povinne** (v tabuľkách aj v cvičeniach), alebo len ako doplnok pod tabuľkou? Odporúčam povinne:
   bez neho by to nebola španielčina zo Španielska.
4. **Perfecto compuesto aj pre mx** ako voliteľný čas, alebo len es? Odporúčam v oboch dostupný, predvolený čas
   podľa variantu.
5. **Mexické-špecifické slová** (mariachi, tianguis…) v es: skryť, alebo nechať ako „kultúra Mexika“?
   Odporúčam skryť z cvičení a nechať vo vyhľadávaní.
6. **Angličtina:** prekladať es prekrytie hneď aj do EN, alebo SK najprv? Odporúčam SK najprv, EN až keď je es hotové.
7. **Kto skontroluje obsah?** Rodený hovorca zo Španielska; bez neho sú hovorové slová (guay, tío, vale, curro)
   riziko.
8. **Kedy?** Pamätka z 2026-11-03 hovorí, že sa to má robiť až pre verejné vydanie, nepredbiehať. Ak chceš začať
   teraz, odporúčam len krok 1–2 (základ), bez nového obsahu.

## 8. Hotový koncept prekrytia (vygenerované z existujúcich dát)

Nič sa nepíše odznova: `node scripts/spain-diff.mjs` prejde mexický základ a do `docs/spain-draft/` vypíše **len
položky, ktoré sa líšia**, vedľa seba (`es_mx` a navrhnuté `es_es`). Zvyšok ostáva z mexickej verzie (vo variante es
sa použije bezo zmeny). Zdrojové dáta v `src/` sa nemenia.

| Súbor | Obsah | Počet |
|---|---|---|
| `docs/spain-draft/words.json` | slová: nahradiť 41, skryť (len MX) 58, len príklady 57, len poznámka 18 | 174 z 1681 |
| `docs/spain-draft/sentences.json` | vety s navrhnutým `es_es`, `tokens_es`, zmenami `cloze` | 178 z 1971 |
| `docs/spain-draft/review.json` | súhrn | |

Skript to robí automaticky: výmena slov so zhodným rodom (carro → coche), výmena člena pri zmene rodu
(la computadora → el ordenador, unos tenis → unas zapatillas), kontrakcia (a el → al), prepísanie `tokens` a
`cloze.answer`/`distractors`. **Ručne ostáva** (pole `manual` pri položke): 60 viet a 19 slov. Ide o tvary slovies
(manejo → conduzco, regresé, rento), prídavné mená za zmeneným podstatným menom (zapatillas blancos → blancas),
viacslovné náhrady (copia de seguridad) a hovorové slová. Všetky `note_es` sú prázdne a čakajú na text.

Ďalší krok po tvojom schválení: z tohto konceptu urobiť skutočné prekrytie `src/data/es/` a validátor pre es.
Zoznam náhrad (`SAFE`, `GENDER`, `MX_ONLY`) v skripte je jediné miesto, ktoré treba opraviť, ak s niektorou voľbou
nesúhlasíš; potom sa koncept vygeneruje znova.

## 9. Stav (2026-11-07: obsah aj funkcie hotové, chýba len kontrola rodeným hovorcom)

### Hotové
- **Prekrytie slov a viet** (`src/data/es/`): približne 80 slov a 140 viet. Automatická časť (`scripts/spain-overlay.mjs`)
  plus ručná (`scripts/spain-manual.mjs`, 83 viet s vlastným španielskym textom, presmerované cvičenia).
- **Španielske slovesá** (`src/data/es/new/`): conducir, alquilar, aparcar, charlar, enfadarse, encender, s tvarmi odvodenými
  podľa pravidiel a overenými validátorom, plus anglické preklady. Mexické manejar, rentar, estacionar, platicar,
  enojarse, prender a regresar sa v španielskej verzii skrývajú (`hidden`).
- **Vosotros** (`src/lib/vosotros.ts`): odvodený zo slovies, nič sa neukladá. Riadok v tabuľke slovesa, v nápovedi
  cvičenia (`deber · vosotros · presente`) a v kontrole dát.
- **Pretérito perfecto compuesto**: nový čas v tabuľke slovies pre obe varianty, s tipom (SK aj EN), úroveň A2.
- **Nastavenia → Španielčina**: Mexická / Zo Španielska, po zmene reload, pokrok ostáva (rovnaké `id`).
- **Kontrola** `npm run validate:es`: španielske dáta tak, ako ich dostane používateľ (prekrytie nad základom), vrátane
  nápovedí cvičení, tvarov slovies a „žiadne mexické slovo v španielskom texte“. Test `e2e/variant.spec.ts`.
- **Španielčina: texty** (2026-11-06, branch `content-es-texts`):
  - Každý tip končí rámikom „V Mexiku“ alebo „V Španielsku“ podľa variantu (`variants.mx` / `variants.es`, SK aj EN,
    `validate:data` vyžaduje obe).
  - Prekrytie tipov `src/data/es/tips.json` (22 tipov, 34 príkladov, 19 textov): coche, móvil, autobús, camarero, súper,
    euros, padres, billetes, pisos…; pretérito a perfecto hovoria, že Španielsko používa he comido pre dnešok.
    `applyTips` / `applyTipsEn` v `applyVariant.ts`. Mexické mestá a jedlá (Puebla, tacos) ostali, nie sú chybou.
  - `validate:es` kontroluje aj tipy: rovnaké id pravidiel, počet príkladov, nový význam ⇒ anglický preklad, žiadne
    mexické slovo v príkladoch a žiadny text „v Mexiku“ mimo rámika.
  - Hlas: pri Španielsku `es-ES` najprv (`preferredLangs` v `tts.ts`), rozpoznávanie reči `es-ES`; ručne vybraný hlas má prednosť.
  - Hľadanie oboch tvarov (`otherForms` v `data/index.ts`): 35 nahradených slov a 6 dvojíc slovies (`SPAIN_VERB_PAIRS`),
    v Španielsku aj regresar → volver. Riadok výsledku ukáže „v Mexiku „carro““ / „v Španielsku „coche““.
  - Online preklad: pri Španielsku cieľ DeepL `ES` (nie `ES-419`), vlastný kľúč v cache (`sk@es-ES:…`).
  - Texty appky so zmienkou o Mexiku (futuro v tabuľke, online preklad, inštalácia hlasu, uvítanie) majú španielske znenie.
- **Generátory**: `spain-diff.mjs` (porovná základ), `spain-overlay.mjs` (bezpečné výmeny), `spain-manual.mjs` (ručné
  vety a opravy slov), `spain-verbs.mjs` (nové slovesá).
- **Dokončenie** (2026-11-07, branch `content-es-complete`):
  - **Všetky vety prejdené**: ručné prekrytie `src/data/es/hand/sentences/` (≈560 viet): mexické slová a slang, miesta,
    peniaze (eurá), jedlá a sviatky, neformálne ustedes → vosotros, pretérito → perfecto pri hoy / ya / este año.
    Pri zmene významu má veta vlastné `sk` + `en` (a `enHints` pre zmenené slovenské nápovede).
  - **Slová**: `src/data/es/hand/words/`: 58 mexických slov skrytých (slang, tianguis, mariachi…, aj slovesá checar,
    voltear, chambear, trapear, reprobar, apapachar), španielske poznámky (`note` + `noteEn`) pri ostatných a pri 26
    nahradených slovách, príklady bez mexických slov (`examplesEn` pri zmene významu), vídeo, chófer.
  - **Nové slová**: 72 v `src/data/es/new/words/<téma>.json` (vale, guay, tío, caña, grifo, nevera, instituto, nómina…,
    angličtina v `es/new/en/words-more.json`) a 7 slovies v `spain-verbs.mjs`: coger, apetecer, molar, suspender, girar,
    fregar, currar.
  - **Nové vety**: 125 v `src/data/es/new/sentences/` (s9001–s9125, angličtina v `es/new/en/sentences.json`):
    perfecto s príčastím a s pomocným slovesom, kontrast ayer → pretérito (nápoveda bez času, `tip: perfecto`,
    `why: finished`), vosotros vo všetkých časoch, hovorová španielčina.
  - **Perfecto** ako tip pre blanky (`BLANK_TIPS` v `clozeChecks.ts`, nie usage tip Cesty), nové pravidlo `finished`
    a `because` v tipe (SK aj EN).
  - **Vosotros v cvičeniach**: `drillPersonsOf` (Časovanie, Cesta, testy), úlohy `tener:preterito:vosotros`, kontrola
    odpovedí pozná tvary vosotros, tipy časov vypisujú 6 osôb (prekrytie `es/tips.json`). Duely vynechávajú vosotros
    a všetko, čo má len jeden variant (`variantOnly`, `inBothVariants`).
  - **Uvítanie**: na prvej obrazovke „Akú španielčinu sa učíš?“ (Mexická / Zo Španielska). Text „rozpracovaná“ z
    Nastavení preč.
  - **Kontroly**: `validate:es` odmieta mexické slová v každej španielskej vete (aj bez prekrytia), vyžaduje angličtinu
    pri novom obsahu a pri zmene významu. Pomôcky `scripts/spain-view.mjs <téma>` a `scripts/spain-check.mjs <témy…>`.

### Ako to funguje po zmene mexického základu
`node scripts/spain-diff.mjs && node scripts/spain-overlay.mjs && node scripts/spain-manual.mjs`, potom
`npm run validate:es`. Generované prekrytie (`es/words`, `es/sentences`) sa pri tom prepíše, ručné (`es/hand/`) nikdy:
jeho polia sa aplikujú posledné. Novú mexickú vetu s „computadora, celular, carro, chamba, pesos…“ `validate:es`
odmietne; oprava patrí do `es/hand/sentences/<téma>.json` (`node scripts/spain-view.mjs <téma>` ukáže vetu, ako ju
dostane Španielsko).

### Čo zostáva
1. **Kontrola rodeným hovorcom zo Španielska** (aj mexickej verzie): pred verejným vydaním. Ručne písané výmeny jedál,
   miest a hovorové slová (guay, tío, mola, curro) sú najväčšie riziko.
2. Cesta nemá jednotku pre perfecto (`path.json` je spoločný pre oba varianty); perfecto sa precvičuje v Časovaní,
   v lekciách tém (vety s9xxx) a v tipe.
3. Popis v Google Play (patrí k vydaniu) a rozhodnutie o názve variantu.
