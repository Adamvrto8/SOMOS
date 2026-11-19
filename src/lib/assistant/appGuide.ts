// "What is where in the app", for the assistant's app map (appMap.ts). Written by hand from the screens; appGuide.test.ts
// fails when src/App.tsx gets a screen no section links to, so a new screen cannot be forgotten here.

export interface GuideSection {
  id: string
  title: string
  /** The screens the section is about: paths of src/App.tsx, with a query where it helps the model link. */
  links: string[]
  text: string
}

export const GUIDE: GuideSection[] = [
  {
    id: 'navigacia',
    title: 'Navigácia',
    links: ['/', '/search', '/path', '/practice', '/profile'],
    text: 'Dolná lišta má päť kariet: Domov, Hľadať, Cesta (uprostred), Cvičiť a Profil. Môj slovník (uložené slová, vlastné slová a chyby) je v Profile.',
  },
  {
    id: 'domov',
    title: 'Domov',
    links: ['/'],
    text: 'Koľko kartičiek je dnes na zopakovanie, séria a denný cieľ, týždenný graf (ťuknutím otvorí Prehľad), pokračovanie rozrobenej lekcie, Ďalší cieľ, slovo dňa a karta Denníka.',
  },
  {
    id: 'hladanie',
    title: 'Hľadať',
    links: ['/search', '/word', '/topic'],
    text: 'Napíš slovenské alebo španielske slovo; hľadá sa bez ohľadu na diakritiku a toleruje preklepy. Detail slova (/word/<id>) má preklady, rod, príklady, výslovnosť a pri slovesách tabuľku časovania. Témy (/topic/<id>) ukazujú slová témy. Pod výsledkami je „Preložiť online“ (DeepL) a z neho „Pridať do Moje slová“; vo výsledkoch sú aj gramatické tipy, ktorých názov sedí.',
  },
  {
    id: 'cvicenia',
    title: 'Cvičiť',
    links: ['/practice', '/practice/lesson?mixed=A1'],
    text: 'Zmiešané cvičenie (/practice/lesson?mixed=<úroveň>), pokračovanie rozrobenej lekcie, skratky na Chyby, Duel, Testy a Gramatiku a zoznam cvičení. Každé cvičenie (/practice?type=<typ>, voliteľne &topic=<téma>&level=<úroveň>) má očíslované lekcie po približne 10 úlohách a test na konci. Nesprávne odpovede idú do Chýb.',
  },
  {
    id: 'cesta',
    title: 'Cesta',
    links: ['/path'],
    text: 'Prehľad postupu po jednotkách (téma × úroveň): slová, gramatika, vety, počúvanie, opakovanie a test jednotky. Nie je to povinný kurz; ukazuje, kde si a čo je ďalší krok. Test jednotky sa dá urobiť hneď („Viem to“).',
  },
  {
    id: 'testy',
    title: 'Testy',
    links: ['/practice/tests'],
    text: 'Test témy overí jednu tému, skúška celú úroveň (A1–B2). Miešajú všetky druhy cvičení, nedávajú nápovedu a zložené sú pri 80 %. Nič sa nezamyká.',
  },
  {
    id: 'gramatika',
    title: 'Gramatika',
    links: ['/practice/grammar'],
    text: 'Gramatické tipy „Prečo?“ podľa úrovní. Tip má adresu /practice/grammar/<id> (zoznam tipov je nižšie). Tipy sa otvárajú aj po odpovedi v úlohe a z výsledkov Hľadať.',
  },
  {
    id: 'duel',
    title: 'Duel',
    links: ['/duel'],
    text: 'Ty proti kamarátovi naraz na tie isté úlohy, 3 kolá po 5. Založíš miestnosť a kamarát sa pripojí kódom alebo odkazom. Treba byť prihlásený.',
  },
  {
    id: 'slovnik',
    title: 'Môj slovník',
    links: ['/archive', '/archive/new', '/practice/lesson?mistakes=1'],
    text: 'V Profile. Záložky Uložené (slová a vety s hviezdičkou), Pridané (vlastné slová; nové pridáš cez /archive/new, formulár má polia španielsky, slovensky, poznámka a téma) a Chyby (precvičíš ich cez /practice/lesson?mistakes=1). „Zopakovať“ spustí opakovanie kartičiek.',
  },
  {
    id: 'opakovanie',
    title: 'Opakovanie kartičiek',
    links: ['/review'],
    text: 'Každé slovo alebo veta s hviezdičkou a každé vlastné slovo má kartičku; appka ich plánuje podľa odstupňovaného opakovania (FSRS). Na Domove vidíš, koľko ich je na dnes.',
  },
  {
    id: 'dennik',
    title: 'Denník',
    links: ['/diary'],
    text: 'Karta na Domove. Na každý deň jeden zápis s dvoma poliami: „Čo som sa dnes naučil“ a „Po španielsky“ (pár viet o dni). Kontrola podčiarkne španielske slová, ktoré appka nepozná. „Všetky zápisy“ ukáže staršie dni. Nepočíta sa do cieľa ani série.',
  },
  {
    id: 'prehlad',
    title: 'Prehľad (štatistiky)',
    links: ['/stats', '/profile/stats'],
    text: 'Profil → Prehľad, alebo ťuknutím na týždenný graf na Domove: koľko a čo si precvičil, úspešnosť, séria a najdlhšia séria.',
  },
  {
    id: 'seria',
    title: 'Séria a denný cieľ',
    links: [],
    text: 'Deň sa počíta, keď dosiahneš denný cieľ (počet správnych odpovedí, aj z opakovania kartičiek). Ochrana série: začínaš s jednou, za každých 7 dní v rade získaš ďalšiu, najviac máš dve; vynechaný deň spotrebuje jednu ochranu a séria ide ďalej, ale v ten deň nerastie. Denný cieľ sa mení v Profile.',
  },
  {
    id: 'profil',
    title: 'Profil a nastavenia',
    links: ['/profile', '/profile/sign-in'],
    text: 'Prehľad, Môj slovník, účet (voliteľný, Google alebo kód na e-mail; s účtom sa pokrok synchronizuje) a nastavenia ako riadky: denný cieľ, automatické opakovanie, pripomienka, jazyk appky (slovenčina / angličtina), španielčina (mexická / zo Španielska), vzhľad, zvuky, výslovnosť, záloha, anonymné štatistiky, ochrana súkromia.',
  },
  {
    id: 'variant',
    title: 'Španielčina: mexická alebo zo Španielska',
    links: ['/profile'],
    text: 'Volí sa v Profile → Španielčina (Mexická / Zo Španielska) a pri prvom spustení; po zmene sa appka znova načíta a pokrok ostáva. Mexická je predvolená: bez vosotros (namiesto neho ustedes), slová ako carro, computadora, celular. Zo Španielska: slová zo Španielska (coche, ordenador, móvil…), v časovaní pribudne vosotros (vosotros habláis) a pretérito perfecto (he hablado). Ktorú má učiaci, je v jeho profile.',
  },
  {
    id: 'pripomienka',
    title: 'Pripomienka',
    links: ['/profile'],
    text: 'Zapína sa v Profile → Pripomienka. Pošle upozornenie v zvolenom čase, ak ešte nemáš splnený denný cieľ.',
  },
  {
    id: 'sukromie',
    title: 'Ochrana súkromia',
    links: ['/privacy'],
    text: 'Čo appka ukladá a posiela (účet, DeepL, štatistiky, pripomienky) a ako požiadať o výmaz.',
  },
  {
    id: 'o-appke',
    title: 'O appke',
    links: ['/privacy'],
    text: 'SOMOS robí tím SOMOS; kontakt je v Ochrane súkromia (/privacy). Appka zatiaľ nie je v obchode s aplikáciami: je to webová appka, ktorá sa inštaluje z prehliadača cez „Pridať na plochu“ a funguje aj bez internetu. Mená ľudí z tímu neuvádzaj.',
  },
  {
    id: 'somo',
    title: 'SOMO (tento chat)',
    links: [],
    text: 'SOMO otvára tlačidlo SOMO dole na obrazovke; potrebuje internet a prihlásený účet. V lekcii je po nesprávnej odpovedi pod spätnou väzbou „Prečo? Opýtaj sa SOMO“: sám pošle úlohu, moju odpoveď, správnu odpoveď a tip a SOMO vysvetlí rozdiel; po zatvorení chatu pokračuje lekcia. V Môj slovník → Chyby má každá úloha ikonu SOMO, ktorá pošle „Vysvetli mi túto úlohu“ s jej údajmi. Prázdny chat ponúkne otázky podľa obrazovky: na detaile slova „Použi … vo vete“ a „Ako sa časuje …?“ alebo „Kedy sa používa …?“, na gramatickom tipe „Vysvetli mi … jednoduchšie“ a „Daj mi ďalšie príklady k …“. Pod odpoveďou sú návrhy ďalších otázok, ťuknutím sa pošlú, a 👍 / 👎 na hodnotenie. „Rozhovory“ ukážu staršie rozhovory, „Nový rozhovor“ začne nový. So SOMO sa píše, hlasom nie.',
  },
]

/** One line per section: "- Title (links): text". */
export const guideText = (): string =>
  GUIDE.map((section) => `- ${section.title} (${section.links.join(', ') || 'bez vlastnej obrazovky'}): ${section.text}`).join('\n')
