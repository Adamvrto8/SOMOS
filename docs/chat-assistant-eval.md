# SOMO (asistent, prototyp) – sada otázok na vyhodnotenie

Otázky môžeš pred smoke testom upraviť. Pri každej zapíš, či je odpoveď použiteľná.

| # | Otázka | Čo očakávam | Použiteľné (áno/nie) | Poznámka |
|---|---|---|---|---|
| 1 | Ako sa povie „dom“ po španielsky? | casa, odkaz na slovo | áno | casa, /word/casa, /topic/home; vymyslené „casa máš vo viacerých cvičeniach“ |
| 2 | Čo znamená „carro“ a ako sa líši od „coche“? | carro = auto v Mexiku, coche = Španielsko | áno | správne; posledná veta zmätená |
| 3 | Vyčasuj sloveso tener v pretérite. | tvary z appky (tuve, tuviste, tuvo, tuvimos, tuvieron) | áno | tvary správne; „skloňujú“ namiesto časujú |
| 4 | Aký je tvar „fui“, od ktorého slovesa? | ir aj ser, pretérito, yo | | |
| 5 | Kedy použiť ser a kedy estar? | stručné vysvetlenie, prípadne tip z appky | | beh 5: S2 V1 F1 J2 = 6; vysvetlenie a karta tipu ser-estar dobré, ale „Estoy en casa.“ označil „(vzor na estar, mimo appky)“, hoci veta je v tom istom tipe, a poznámka je vložená do prekladu |
| 6 | Vysvetli rozdiel medzi pretérito a imperfecto. | správne vysvetlenie, príklady | | |
| 7 | Kedy sa používa por a kedy para? | správne vysvetlenie, príklady | áno | správne, tip por-para; zbytočne dlhé a profil (B1) navyše |
| 8 | Aké sú nepravidelné tvary slovesa hacer v prítomnom čase? | hago, ostatné pravidelné | nie | tvary správne, ale „kmeň haz-/hac-“ je zlé pravidlo |
| 9 | Ako sa povie „idem do mesta“? | voy a la ciudad / al centro | áno | voy a la ciudad, /topic/city |
| 10 | Ako funguje séria a ochrana série v appke? | zhoda s popisom v appke | áno | popis sedí; „stačí jedna lekcia“ na 20 správnych nestačí |
| 11 | Kde nájdem svoje chyby? | Profil → Môj slovník → Chyby | áno | Profil → Môj slovník → Chyby, 285 chýb z profilu; ukázal id cvičení (sk–es vocab) |
| 12 | Ako pridám vlastné slovo? | Profil → Môj slovník → Pridané → „+“ | nie | sľúbil pole „príklad“, formulár má poznámku a tému |
| 13 | Ako zapnem pripomienku? | Profil → pripomienka | | |
| 14 | Čo je „vosotros“ a používa sa v SOMOS? | nie, mexická španielčina | | |
| 15 | Aké časy sú na úrovni A1? | zhoda s obsahom appky | | |
| 16 | Ako sa povie „počítač“ v Mexiku? | computadora | | |
| 17 | Aký je rod slova „problema“? | mužský (el problema) | | |
| 18 | Aký je rozdiel medzi „saber“ a „conocer“? | správne vysvetlenie | | |
| 19 | Prelož do španielčiny: „Včera som bol v kine.“ | Ayer estuve en el cine. (mexický tvar) | | |
| 20 | Aké je hlavné mesto Francúzska? | slušné odmietnutie, mimo témy | áno | slušné odmietnutie + veta po španielsky |
| 21 | Aká je moja séria a koľko mi dnes chýba? | čísla zhodné s Domovom | áno | čísla z profilu |
| 22 | Čo mi ide najmenej? | najslabšie cvičenie alebo najčastejšie chyby z profilu, odkaz na precvičenie | áno | správne, ale id cvičení (translation) namiesto názvov |
| 23 | Čo mám dnes robiť? | ďalší krok z Cesty alebo kartičky na dnes, odkaz | áno | kartičky + Cesta + chyby, dobré |
| 24 | Dá sa v appke písať denník? | áno, Denník na Domove, /diary | áno | presne podľa appky |
| 25 | Aké gramatické tipy sú na úrovni A1? | zoznam z appky | nie | napísal 13 tipov, je ich 12; vypísal šablónu /practice/grammar/<id> |
| 26 | Čo som sa učil tento týždeň? | z denníka alebo testov a lekcií, nie vymyslené | nie | lekcie mimo tohto týždňa podané ako jeho výsledky, denník nepoužil |

## Kritériá
- Aspoň 22 z 26 odpovedí použiteľných.
- Žiadna španielčina zo Španielska (vosotros, coche, ordenador, móvil…).
- Žiadny vymyslený tvar slovesa ani slovo, ktoré v appke nie je.
- Odpovede o učiacom sedia s číslami v appke (Domov, Prehľad).

## Výsledok
### Beh 1 (2026-11-16, 4191570, Adam na Preview, 16 otázok)
- Použiteľných odpovedí: 12 / 16 (nie: 8, 12, 25, 26). Mexická španielčina všade správne.
- Systémové nálezy: id cvičení v profile namiesto názvov; profil pridávaný aj k otázkam o slovách, raz s vymysleným faktom; zástupný znak <id> z mapy v odpovedi; počet tipov rátaný modelom; otázka na obdobie bez dátumov a bez denníka; vlastné pravidlo gramatiky (hacer); odpovede nad 120 slov.
- Opravené v nasledujúcom commite (názvy cvičení, počty tipov, pravidlá v prompte, polia formulára v mape); ďalší beh ukáže, či zabrali.

### Beh 2 (2026-11-16, 4e664ba, Adam na Preview, 15 otázok: 1, 2, 6, 8, 10, 12, 15, 17, 20–26)
- Použiteľných odpovedí: 14 / 15 (nie: 17 „problema“). Opravy z behu 1 zabrali: obdobie podľa dátumov, 12 tipov, názvy cvičení, polia formulára, hacer, profil len pri otázkach o učiacom.
- 17: prvá veta „ženský rod“, potom sa opravil; slovo problema v slovníku chýba (aj sistema, tema, programa, planeta, moto), tip gender ho má len v príklade a model ho nezavolal.
- 2: znova „over si to v inom zdroji“ pri istom fakte (pravidlo o rodenom hovorcovi).
- 10: pomotaná veta o ochrane série (z textu mapy).
- 15: podľa tipov sedí (presente A1); A1 vety však majú aj priebehový čas (22), jeho tip je na A2.
- Opravené: search_word pri chýbajúcom slove vráti príklady z tipov (inTips), prompt „najprv over, potom píš“, upozornenie len pri odpovedi mimo appky, text o ochrane série. Slová doplnené v main.

### Beh 3 (2026-11-16, 9878ecc, Adam na Preview, 16 otázok vrátane nových)
- Použiteľných odpovedí: 13 / 16 (nie: kto vytvoril appku, aký je dnes deň, hotové cvičenia). Opravy z behu 2 zabrali: problema z tipu bez sebaopravy, „(toto v appke nie je)“ len pri planeta, carro bez „over inde“.
- Kto vytvoril appku: „neviem, pozri obchod“; mapa o autorovi ani o inštalácii nič nemala.
- Aký je dnes deň: „dátum nemám“ a príklad „Hoy es martes“ v pondelok; profil nemal dnešný dátum.
- Hotové cvičenia: nevyžiadaná „oprava“ správnej skoršej odpovede.
- carro: odkaz /topic/travel namiesto /topic/city (search_word nevracal tému).
- Opravené: „Dnes je: …“ v profile, téma slova v search_word, sekcia „O appke“ (tím SOMOS, bez mien), prompt bez komentovania skorších odpovedí.

### Beh 4 (2026-11-17, d7b79bd, Adam na Preview, všetkých 26 otázok)
- Použiteľných odpovedí: 23 / 26 (nie: 14 vosotros, 16 počítač, 20 Francúzsko). Kritérium 22 / 26 splnené; žiadna španielčina zo Španielska, žiadny vymyslený tvar.
- Opravy z behu 3 zabrali: deň v týždni (utorok), carro → /topic/city, problema zo slovníka, 12 tipov A1, tento týždeň bez starších lekcií.
- 16: rod, úroveň a téma, ale bez samotného slova computadora (nástroj ho vrátil).
- 20: napísal Paríž a potom „nemôžem odpovedať“; tvrdil, že vymyslenú vetu precvičí v Preklade viet.
- 14: „v appke nie je“, hoci nastavenia majú španielčinu zo Španielska s vosotros (v mape len slovo v zozname nastavení).
- Drobnosti: „se povie“ (9), „pod priemerom“ bez priemeru (22).
- Tokeny: počas behu nenamerané, tabuľka chat_usage v Supabase chýbala (aj denný strop preto nefungoval). Vzorka po jej vytvorení (6 otázok, 7 volaní, d7b79bd): na otázku ~2000 input, ~8400 cache read, ~1400 cache write, ~500 output (vrátane thinking); cache_share 0,71. Cena (Haiku 5.5: 0,10 / 0,50 USD za 1M, cache read 0,01, cache write 0,125): ~0,0007 USD na otázku, ~0,71 USD za 1000 otázok.
- Opravené: pravidlo „slovo vždy napíš“, odmietnutie bez faktu s príkladom, nič o obsahu appky bez nástroja či mapy, žiadne porovnanie s priemerom, spisovná slovenčina, sekcia mapy o variante španielčiny.

### Beh 5 (pripravený 2026-11-18, po kartách, kontrolách, typoch otázok a „Prečo?“)
Prvý beh s bodmi po osiach namiesto áno / nie a s otázkami, na ktoré appka odpoveď nemá alebo sú chytákom.
Spúšťa sa v appke (režim vývojára, prihlásený účet), odpovede vlož do chatu cez „Kopírovať konverzáciu“
(karty sa skopírujú ako značky `{{…}}`, Claude ich overí v dátach).

**Body**: každá odpoveď dostane na každej osi 0, 1 alebo 2, spolu najviac 8.

| Os | 2 | 1 | 0 |
|---|---|---|---|
| S – správnosť | všetko správne | drobná chyba, ktorá nemýli | zlý tvar, význam alebo pravidlo |
| V – vernosť appke | nič vymyslené o obsahu, učiacom ani funkciách | nejasné tvrdenie o appke | vymyslené slovo, tvar, číslo alebo funkcia |
| F – formát | karta namiesto vypísaných tvarov, dĺžka podľa typu, odkazy vo vete | dlhšie alebo bez karty, ale čitateľné | jeden dlhý odsek, holé cesty, nič klikateľné |
| J – jazyk | spisovná slovenčina, mexická španielčina | drobnosť (čeština, slovosled) | Španielsko (vosotros, coche…) pri mexickom variante |

**Kritériá behu 5**: priemer aspoň 7 / 8, žiadna 0 v S ani vo V, chytáky 27–33 všetky aspoň 6.
Otázky 1–26 hore sa v tomto behu hodnotia tiež bodmi (stačí zapísať S/V/F/J do poznámky).

| # | Otázka alebo kroky | Čo očakávam | S | V | F | J | Poznámka |
|---|---|---|---|---|---|---|---|
| 27 | Čo znamená „flarpo“? | prizná, že také slovo nepozná a appka ho nemá; nič nevymyslí | 2 | 2 | 2 | 2 | 8; čip „počítač“ nesúvisí s otázkou |
| 28 | Čo je „zumo“? | v Španielsku džús, v Mexiku jugo; karta slova jugo | 2 | 2 | 2 | 2 | 8; príklad z appky (food.json); čip „džús v iných krajinách“ appka nezodpovie (má len MX a ES) |
| 29 | Ako sa povie „mobil“? | el celular (nie móvil), karta slova | 2 | 2 | 2 | 2 | 8; príklad z appky (work.json) |
| 30 | Vyčasuj „conducir“. | v Mexiku manejar; karta časovania manejar, žiadne tvary conducir vypísané ako mexické | 2 | 2 | 2 | 1 | 7; karty manejar presente + pretérito, žiadny tvar conducir; krkolomná veta „Sloveso conducir sa … povie manejar“ |
| 31 | Čo je „fue“? | ser aj ir, pretérito, él / ella / usted | 2 | 2 | 2 | 2 | 8; karty ser a ir pretérito |
| 32 | Dá sa so SOMO rozprávať hlasom? | nie, appka to nemá; najbližšia možnosť (Vyslovovanie, 🔊) | 2 | 2 | 2 | 2 | 8; Vyslovovanie aj Diktát s funkčnými odkazmi, 🔊 nespomenul; čip „ser v prítomnom čase“ zopakovaný z 31 |
| 33 | Koľko vlastných slov mám pridaných? | číslo z profilu alebo get_my_records, nič odhadnuté | 2? | 2? | 2 | 2 | 8, ak v Pridané naozaj máš 5 slov (over v appke); záložka Pridané a kartičky v opakovaní sedia |
| 34 | Ako sa povie „pes“? | el perro, bez „podobných“ slov pesar, peso | 2 | 2 | 2 | 2 | 8; príklad z appky (family.json), žiadne pesar / peso |
| 35 | Lekcia Časovanie → zlá odpoveď → „Prečo? Opýtaj sa SOMO“ | otázka odíde sama; vysvetlí rozdiel medzi mojou a správnou odpoveďou podľa tipu, správny tvar tučne, karta tipu; Späť vráti do lekcie | 2 | 2 | 2 | 2 | 8 (opakované v appke, trabajar · él · progresivo, prázdna odpoveď → „Prečo je správne práve toto?“ s úlohou, správnym tvarom a tipom); está trabajando tučne, gerundium -ando, príklady z tipu progresivo, karta tipu; chat sa otvoril nad lekciou. Prvý pokus (text v chate): SOMO o tlačidle „Prečo?“ nevie, mapa ho nepopisuje |
| 36 | Lekcia Doplň slovo → „Vzdať sa“ → „Prečo? …“ | „Prečo je správne práve toto?“, vysvetlenie vety s medzerou a nápovedou | | | | | beh 5: nespustené |
| 37 | Chyby → ikona SOMO pri úlohe | „Vysvetli mi túto úlohu“, vysvetlenie bez vymyslenej „mojej odpovede“ | | | | | beh 5: neplatné (text v chate); „appka by mala poslať…“ je dohad |
| 38 | Detail slova → čip „Použi … vo vete“ | veta s tým slovom, nevydávaná za vetu z appky | | | | | beh 5: neplatné (text v chate); v odpovedi holá šablóna „/word/<id>“ z mapy, čip „s time slovom perro“ (preklep) |
| 39 | Čip s ďalšou otázkou pod odpoveďou | zmysluplná otázka, na ktorú SOMO odpovie z appky | 2 | 2 | 2 | 2 | 8 (v appke: po „Koľko cvičení tu je?“ čip „Ktoré cvičenie je pre mňa najťažšie?“, zodpovedateľné z profilu); samotná odpoveď 11 druhov sedí s appkou. Z 27–34: čipy 27 a 32 nesúvisia s otázkou, 28 appka nezodpovie |
| 40 | Polož otázku, zavri appku, otvor SOMO; potom „Nový rozhovor“ | rozhovor tam je; prázdny chat ponúkne „Pokračovať v poslednom rozhovore“ | | | | | |

Opravené po prvej časti behu 5 (2026-11-19): zástupná adresa (/word/<id>) sa nezobrazí a kontrola ju vráti modelu;
poznámka o pôvode vety v preklade príkladu („mimo appky“) sa vráti modelu; čip, ktorý už v rozhovore padol, sa
neukáže; prompt: ďalšie otázky nadväzujú na práve položenú otázku a nepýtajú sa na iné krajiny; mapa má sekciu SOMO
(tlačidlo, „Prečo? Opýtaj sa SOMO“, ikona v Chybách, čipy, rozhovory, bez hlasu).

Pri každej odpovedi, ktorá nesedí, daj aj 👎 s dôvodom: riadok v Supabase `chat_feedback` má otázku, odpoveď,
volané nástroje aj stránku, takže sa dá dohľadať bez kopírovania.

- Dátum:
- Commit:
- Body (priemer / najnižšia):
- Namerané tokeny na otázku (input / output / cache_share):
- Odhad ceny na otázku:
- Verdikt:
