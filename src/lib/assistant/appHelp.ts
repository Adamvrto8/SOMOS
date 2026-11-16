import { fold } from '../text'

// "Where is what in the app", short and in Slovak, for the assistant's app_help tool. Derived from CLAUDE.md §5 and the
// labels in src/i18n/sk.ts; when a screen is renamed, rename it here too.

interface Section {
  id: string
  keywords: string[]
  text: string
}

const SECTIONS: Section[] = [
  {
    id: 'navigacia',
    keywords: ['navigacia', 'menu', 'karty', 'spodna lista', 'kde'],
    text: 'Dolná lišta má päť kariet: Domov, Hľadať, Cesta (uprostred), Cvičiť a Profil. Môj slovník (uložené slová, vlastné slová a chyby) je v Profile.',
  },
  {
    id: 'hladanie',
    keywords: ['hladat', 'hladanie', 'slovnik', 'slovo', 'preklad', 'online'],
    text: 'Hľadať: napíš slovenské alebo španielske slovo, hľadá sa bez ohľadu na diakritiku a toleruje preklepy. Ťuknutím na španielske slovo sa otvorí detail (preklady, rod, príklady, výslovnosť, pri slovesách tabuľka časovania). Pod výsledkami je „Preložiť online“ (DeepL) a z neho „Pridať do Moje slová“.',
  },
  {
    id: 'cvicenia',
    keywords: ['cvicit', 'cvicenia', 'cvicenie', 'lekcia', 'uloha', 'typy'],
    text: 'Cvičiť: vyber typ cvičenia (doplňovanie, výber, skladanie vety, preklad SK→ES, časovanie), tému a úroveň. Lekcia má približne 10 úloh. Nesprávne odpovede idú do Chýb a môžeš ich precvičiť zvlášť.',
  },
  {
    id: 'dennik',
    keywords: ['dennik', 'zapis', 'zapisky', 'poznamky', 'poznatky', 'co som sa naucil', 'journal'],
    text: 'Denník: karta na Domove. Na každý deň jeden zápis s dvoma poliami: „Čo som sa dnes naučil“ (slovíčka, gramatika, čokoľvek) a „Po španielsky“ (pár viet o tvojom dni). Kontrola podčiarkne španielske slová, ktoré appka nepozná (preklep, chýbajúci prízvuk, slovo mimo slovníka). „Všetky zápisy“ ukáže staršie dni. S účtom sa zápisy synchronizujú.',
  },
  {
    id: 'testy',
    keywords: ['test', 'testy', 'skuska', 'skusky'],
    text: 'Testy: Cvičiť → Testy. Test témy overí jednu tému, skúška celú úroveň (A1–B2). Miešajú všetky druhy cvičení, nedávajú nápovedu a zložené sú pri 80 %. Nič sa nezamyká.',
  },
  {
    id: 'duel',
    keywords: ['duel', 'suboj', 'kamarat', 'zapas'],
    text: 'Duel: Cvičiť → Duel. Ty proti kamarátovi naraz na tie isté úlohy, 3 kolá po 5. Založíš miestnosť a kamarát sa pripojí kódom alebo odkazom. Treba byť prihlásený.',
  },
  {
    id: 'prehlad',
    keywords: ['prehlad', 'statistiky', 'statistika', 'graf'],
    text: 'Prehľad (štatistiky): Profil → Prehľad, alebo ťuknutím na týždenný graf na Domove. Ukazuje, koľko a čo si precvičil.',
  },
  {
    id: 'cesta',
    keywords: ['cesta', 'plan', 'dnes', 'postup', 'pokrok'],
    text: 'Cesta: ukazuje, kde si v učení a čo je ďalší krok. Nie je to povinný kurz, slúži ako prehľad pokroku.',
  },
  {
    id: 'archiv',
    keywords: ['archiv', 'moj slovnik', 'ulozene', 'hviezdicka', 'moje slova', 'chyby', 'zalohovanie', 'export'],
    text: 'Môj slovník (v Profile; dá sa otvoriť aj ako Archív): záložky Uložené (slová s hviezdičkou), Pridané (tvoje vlastné slová) a Chyby. „Zopakovať“ spustí opakovanie podľa odstupňovaného opakovania. Zálohu stiahneš a obnovíš v Profile → Záloha.',
  },
  {
    id: 'opakovanie',
    keywords: ['opakovanie', 'kartičky', 'kartky', 'zopakovat', 'srs', 'fsrs'],
    text: 'Opakovanie: každé slovo alebo veta s hviezdičkou a každé tvoje vlastné slovo má kartičku. Na Domove vidíš, koľko ich je na dnes.',
  },
  {
    id: 'seria',
    keywords: ['seria', 'streak', 'denny cieľ', 'denny ciel', 'ciel', 'ochrana'],
    text: 'Séria: deň sa počíta, keď dosiahneš denný cieľ (počet správnych odpovedí). Ochrana série: začínaš s jednou, za každých 7 dní v rade získaš ďalšiu, najviac máš dve. Vynechaný deň ju spotrebuje a séria ide ďalej, ale nerastie.',
  },
  {
    id: 'gramatika',
    keywords: ['gramatika', 'tipy', 'preco', 'pravidla'],
    text: 'Gramatické tipy „Prečo?“ nájdeš v Cvičiť → Gramatika, pri úlohách po odpovedi a vo výsledkoch Hľadať, ak názov tipu zodpovedá hľadanému slovu.',
  },
  {
    id: 'ucet',
    keywords: ['ucet', 'prihlasenie', 'synchronizacia', 'sync', 'zariadenie', 'zalohovat'],
    text: 'Účet je voliteľný (Google alebo kód na e-mail). Bez účtu appka funguje offline na zariadení, s účtom sa pokrok synchronizuje. Účet a nastavenia sú v Profile.',
  },
  {
    id: 'pripomienka',
    keywords: ['pripomienka', 'notifikacia', 'upozornenie'],
    text: 'Pripomienka sa zapína v Profile → Pripomienka. Pošle upozornenie v zvolenom čase, ak ešte nemáš splnený denný cieľ.',
  },
]

/** The section that fits the topic best (every keyword or the id is searched as a part of the topic); the topic list when none does. */
export function appHelp(topic: string): { found: boolean; topic?: string; text: string; topics: string[] } {
  const topics = SECTIONS.map((section) => section.id)
  const wanted = fold(topic)
  if (wanted) {
    // The longest matching keyword wins, so "moj slovnik" beats the shorter "slovnik" of another section.
    const score = (s: Section) => Math.max(0, ...[s.id, ...s.keywords].map(fold).filter((k) => wanted.includes(k) || k.includes(wanted)).map((k) => k.length))
    const section = SECTIONS.reduce<Section | undefined>((best, s) => (score(s) > (best ? score(best) : 0) ? s : best), undefined)
    if (section) return { found: true, topic: section.id, text: section.text, topics }
  }
  return { found: false, text: 'Téma nebola nájdená. Dostupné témy sú v zozname `topics`.', topics }
}
