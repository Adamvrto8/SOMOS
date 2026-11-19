# SOMO – čo zlepšiť (návrh, 2026-11-17)

Východisko: SOMO dnes odpovedá na otázky o slovách, gramatike, appke a učiacom (4 nástroje, mapa appky, profil,
aktuálna stránka), obyčajným textom do 120 slov s odkazmi `[text](/cesta)`. Beh 4 eval sady: 23 / 26.
Všetko nižšie posudzovať podľa `docs/product-vision.md`: SOMO je **doplnok učebnice**, nie hlavná funkcia ani
konkurent Duolinga. Tri časti: funkcie, správnosť, formát. Na konci poradie.

---

## 1. Čo robia podobní asistenti (prieskum)

| Appka | AI funkcia | Čo z toho pre SOMO |
|---|---|---|
| Duolingo | **Explain My Answer**: po úlohe sa učiaci spýta, prečo bola odpoveď dobrá/zlá (podľa sekundárnych zdrojov od 2026 zadarmo) | najsilnejší vzor: vysvetlenie **konkrétnej chyby** v kontexte úlohy |
| Duolingo Max | **Roleplay** (konverzácia so scénarom + správa na konci), **Video Call** s postavou | konverzácia až neskôr; správa po rozhovore je dobrý formát |
| Babbel Speak (beta) | rozhovor v scenároch, po ňom spätná väzba k úlohám a slovám; má aj mexickú španielčinu | scenár viazaný na tému a úroveň, hodnotenie na konci |
| Memrise MemBot | konverzácia s nápovedami, prekladom a **navrhnutými odpoveďami** | návrhy ďalších otázok / odpovedí ako čipy |
| Speak | od fráz k otvorenej konverzácii, spätná väzba k výslovnosti, nastaviteľný tón tútora | hlas až neskôr |

Výskum (malé štúdie, skôr vnímanie než merané pokroky):
- Učiaci si najviac cenia **okamžitú opravu s vysvetlením pravidla** a príklady v kontexte.
- Lepšie ako hotová oprava funguje **vedená sebaoprava**: najprv nápoveda („pozri sa na tvar slovesa“), až potom
  správne riešenie (ChatBack, BEA 2023). Opravu je lepšie ukázať v rozhraní (zvýraznenie) než len v texte bota.
- Kvalita vysvetlení sa dá hodnotiť po osiach: **správnosť, jasnosť, úplnosť** (LangoBot); pri odpovediach nad
  dátami zvlášť **vernosť zdroju** (tvrdenie je v dátach) a **relevancia** (odpovedá na otázku).
- Sada otázok, kde sa dá vždy odpovedať, halucinácie nezmeria: treba aj otázky, kde **appka odpoveď nemá**
  a SOMO to má priznať.

---

## 2. Funkcie (podľa prínosu)

### F1. „Prečo?“ ku mojej chybe – SOMO v spätnej väzbe a v Chybách ⭐ najväčší prínos
Na FeedbackSheet (červená/oranžová) a pri položke v Chybách tlačidlo „Opýtať sa SOMO“. Chat sa otvorí s
kontextom úlohy: typ cvičenia, zadanie, **odpoveď učiaceho, správna odpoveď, výsledok `checkAnswer`**
(prízvuk / preklep / iné slovo) a id tipu, ak úloha nejaký má. Prvá odpoveď príde sama, bez písania.
- Všetky fakty už appka má (úloha sa dá zrekonštruovať cez `taskFromItem`), takže je to najlepšie podložená
  odpoveď, akú SOMO vie dať.
- Pri preklade SK → ES vie SOMO povedať aj „tvoja odpoveď je tiež možná“ (dnes tlačidlo „Moja odpoveď bola
  tiež správna“), ale **len ako názor**, výsledok úlohy nemení.
- Tvar odpovede: 1 veta čo je zle → pravidlo z tipu → správny tvar → odkaz na tip / precvičenie.

### F2. Navrhnuté otázky (čipy)
- Prázdny chat: 3–4 čipy podľa stránky (`describePage`): na detaile slova „Použi ho vo vete“, „Rozdiel oproti …“,
  „Vyčasuj ho“; na tipe „Daj mi 3 príklady“, „Vyskúšaj ma“; na Domove „Čo mám dnes robiť?“.
- Po odpovedi 1–2 čipy na pokračovanie (model ich vráti v štruktúrovanom poli, nie v texte).
- Rieši problém prázdneho poľa a vedie k otázkam, na ktoré SOMO odpovedá dobre.

### F3. Akcie priamo v odpovedi
Pri španielskom slove v odpovedi: 🔊 (TTS ako všade v appke), ⭐ uložiť, „Pridať do Moje slová“ (pre slovo
mimo slovníka). Pri odporúčaní „Precvič si …“ tlačidlo namiesto odkazu v texte. Viazané na F5 (štruktúrovaná odpoveď).

### F4. „Skontroluj moju vetu“ / denník
Učiaci napíše vetu (alebo otvorí záznam v Denníku) a SOMO ju opraví: zvýraznené miesta, vedená sebaoprava
(najprv nápoveda, na „ukáž riešenie“ oprava), pravidlo z tipu. Toto je jediná funkcia, kde SOMO **hodnotí
voľný text** bez opory v dátach → najväčšie riziko chýb; robiť až po F5 a s vlastnou eval sadou viet.

### F5–F7 neskôr
- **Vyskúšaj ma**: 3–5 otázok z viet appky k téme rozhovoru (potrebuje nástroj `find_sentences`, ten je v pôvodnej
  špecifikácii, ale nie je hotový). Výsledky sa môžu rátať ako pokusy.
- **Rozhovor so scenárom** (v reštaurácii, na trhu…) na úrovni učiaceho, so správou na konci. Väčší projekt,
  posúdiť podľa product-vision.
- **Hlas**: diktovanie otázky (rozpoznávanie reči appka už používa). Neskôr.
- História chatu je dnes len v pamäti: po zatvorení appky zmizne. Uložiť posledné konverzácie do Dexie (bez
  synchronizácie), aby sa dalo vrátiť k vysvetleniu.

---

## 3. Správnosť

Dnes sa správnosť drží hlavne pravidlami v prompte (40+ pravidiel pribudlo po behoch 1–4). To má strop: každá
nová oprava je ďalšie pravidlo a model ich pri dlhom zozname začne porušovať. Ďalší krok je presunúť čo
najviac **z modelu do kódu**.

### S1. Fakty vykresľuje appka, nie model ⭐
Model namiesto vypísania tvarov a slov vloží **značku** a appka ju vykreslí z vlastných dát:
- `{{conj:tener:preterito}}` → tabuľka časovania z `conjugate.ts` (rovnaká ako na detaile slova, nepravidelné
  tvary oranžovo). Tvar slovesa tak **nemôže byť vymyslený**.
- `{{word:computadora}}` → riadok slova (člen, preklad, 🔊, ⭐) zo slovníka.
- `{{tip:por-para}}` → karta tipu s odkazom.
Neznáme id → značka sa nevykreslí a odpoveď sa označí (pozri S3). Rieši naraz správnosť aj formát (F3).

### S2. Kontrola odpovede v kóde pred zobrazením
Deterministické kontroly nad hotovým textom, bez ďalšieho volania modelu:
- **Odkazy**: každá cesta `/word/:id`, `/topic/:id`, `/practice/grammar/:id` musí existovať v dátach; neexistujúca
  sa zobrazí ako obyčajný text (dnes vedie na prázdnu stránku).
- **Španielčina zo Španielska** pri mexickom variante: zoznam slov z `validate:data` (coche, ordenador, móvil,
  zumo, vosotros…).
- **Tvary slovies**: španielske slovo, ktoré vyzerá ako tvar slovesa a nie je v `knownForms` ani v slovníku → podozrivé.
- Pri náleze: jeden automatický druhý pokus s krátkou poznámkou pre model („v odpovedi je coche, učiaci má
  mexický variant“). Až keď zlyhá aj ten, zobraziť odpoveď s jemným upozornením.

### S3. Spätná väzba z praxe
Pod každou odpoveďou 👍 / 👎 (+ voliteľný dôvod: nesprávne / nejasné / príliš dlhé). 👎 sa uloží spolu s otázkou,
odpoveďou a volaniami nástrojov (nadviazať na `content-reports`). Tak vzniká eval sada z reálnych otázok namiesto
vymyslených. Pred verejným spustením nevyhnutné.

### S4. Prompt prestavať namiesto ďalších pravidiel
- Rozdeliť podľa **typu otázky** (slovo, gramatika, appka, učiaci, mimo témy, chyba z úlohy) a ku každému dať
  **1 vzorovú odpoveď**. Malé modely napodobňujú príklady spoľahlivejšie než zoznam zákazov.
- Pravidlá, ktoré zabezpečí kód (S1, S2: odkazy, holé cesty, tvary, Markdown), z promptu vyškrtnúť.
- Pevné poradie: zisti typ → zavolaj nástroj → odpovedz podľa vzoru.

### S5. Eval: hodnotiť podrobnejšie a pridať otázky „na priznanie“
- Pri každej odpovedi namiesto áno/nie 4 osi po 0–2 bodoch: **správnosť**, **vernosť appke** (nič vymyslené
  o obsahu ani o učiacom), **formát** (dĺžka, odkazy, štruktúra), **jazyk** (spisovná slovenčina, mexická španielčina).
- Doplniť otázky, kde appka odpoveď nemá alebo je chyták: slovo, ktoré v slovníku nie je; vymyslené slovo
  („čo znamená *flarpo*“); slovo zo Španielska („čo je zumo“); otázka na funkciu, ktorú appka nemá; nejednoznačný
  tvar („fue“). Bez nich sa halucinácie nedajú zmerať.
- Sada sa spúšťa ako doteraz: Adam na Preview, výsledok vloží do chatu.

### S6. Model
Na vysvetlenia gramatiky a opravy viet (F1, F4) vyskúšať v eval behu aj silnejší model a porovnať body aj cenu
na otázku (meranie už je v `chat_usage`). Bežné otázky ostanú na Haiku 5.5.

---

## 4. Formát

- **Odpoveď ako štruktúra, nie ako jeden odsek.** Model vráti text + značky (S1) + čipy (F2); appka ich vykreslí
  v štýle SOMOS: španielčina v serife ako na detaile slova, príklady ako dvojica ES / SK pod sebou, tabuľka časovania,
  karta tipu.
- **Dĺžka podľa typu**: slovo 1–3 vety + príklad; gramatika krátke pravidlo + 2 príklady + odkaz na tip; appka 1–2 vety
  + tlačidlo. Strop 120 slov nechať, ale ráta sa len text, nie vykreslené karty.
- **Ľahké formátovanie**: povoliť tučné písmo pre španielske slová a krátky zoznam (max 3 body) a vykresliť ich v appke.
  Dnes sa tučné písmo zahadzuje, takže model píše všetko ako jeden odsek.
- Odpoveď sa môže **zobrazovať priebežne** (streaming), aby učiaci nečakal na celú. Pri tenkom proxy s nástrojmi to
  pomôže len pri poslednom kroku; odložiť, kým čakanie nebude problém.

---

## 5. Odporúčané poradie

1. **S1 + S2** (fakty z dát, kontrola odkazov a španielčiny) – najväčší skok v správnosti, zároveň základ pre lepší formát.
2. **S4 + formát** (prompt podľa typov so vzormi, štruktúrované odpovede, čipy F2).
3. **F1 „Prečo?“ k chybe** – prvá funkcia, ktorú iné appky nemajú v takejto podobe nad vlastnými dátami.
4. **S3 👍/👎 + S5 nová eval sada** – beh 5 už s bodmi po osiach.
5. F3 akcie v odpovedi, história v Dexie.
6. Neskôr: F4 kontrola viet / denníka, vyskúšaj ma, rozhovor so scenárom, hlas.

## Zdroje
- Duolingo Max: https://blog.duolingo.com/duolingo-max , https://www.techlearning.com/how-to/what-is-duolingo-max-the-gpt-4-powered-learning-tool-explained-by-the-apps-product-manager
- Babbel Speak: https://www.babbel.com/babbel-conversation-practice , https://www.babbel.com/en/magazine/from-hackathon-to-home-screen-the-story-behind-babbel-speak
- Memrise MemBot: https://www.memrise.com/blog/introducing-membot
- ChatBack (spätná väzba a sebaoprava v chatbote): https://aclweb.org/anthology/2023.bea-1.7.pdf
- Okamžitá vs. odložená spätná väzba v LLM chatbote: https://www.frontiersin.org/articles/10.3389/feduc.2026.1703664
- LangoBot (hodnotenie vysvetlení gramatiky): https://www.eecg.utoronto.ca/~jayar/ece1786.2023/download/langobot.pdf
- Hodnotenie vzdelávacích chatbotov (správnosť, úplnosť, komunikácia): https://arxiv.org/html/2512.00991v1
- Vernosť a relevancia odpovedí, otázky bez odpovede: https://docs.curiosity.ai/workspace/evaluation/ai-answer-evaluation , https://kodekloud.com/blog/ground-llm-answers-with-citations/
