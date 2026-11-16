# SOMO (asistent, prototyp) – sada otázok na vyhodnotenie

Otázky môžeš pred smoke testom upraviť. Pri každej zapíš, či je odpoveď použiteľná.

| # | Otázka | Čo očakávam | Použiteľné (áno/nie) | Poznámka |
|---|---|---|---|---|
| 1 | Ako sa povie „dom“ po španielsky? | casa, odkaz na slovo | áno | casa, /word/casa, /topic/home; vymyslené „casa máš vo viacerých cvičeniach“ |
| 2 | Čo znamená „carro“ a ako sa líši od „coche“? | carro = auto v Mexiku, coche = Španielsko | áno | správne; posledná veta zmätená |
| 3 | Vyčasuj sloveso tener v pretérite. | tvary z appky (tuve, tuviste, tuvo, tuvimos, tuvieron) | áno | tvary správne; „skloňujú“ namiesto časujú |
| 4 | Aký je tvar „fui“, od ktorého slovesa? | ir aj ser, pretérito, yo | | |
| 5 | Kedy použiť ser a kedy estar? | stručné vysvetlenie, prípadne tip z appky | | |
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

### Beh 4
- Dátum:
- Použiteľných odpovedí: __ / 26
- Namerané tokeny na otázku (input / output / cache_share):
- Odhad ceny na otázku:
- Verdikt:
