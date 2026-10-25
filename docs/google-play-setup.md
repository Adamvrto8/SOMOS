# Google Play – jednorazové nastavenie

SOMOS ide do Google Play ako **Trusted Web Activity (TWA)**: malá Android appka, ktorá otvorí
https://somos-jade.vercel.app na celú obrazovku v Chrome. Obsah a nové verzie idú stále z Vercelu, takže
po každom pushi má novú verziu aj appka z obchodu. Nový balík do Google Play treba nahrať iba vtedy, keď sa
zmení [`android/twa-manifest.json`](../android/twa-manifest.json) (názov, ikona, farby…).

Bez overenia domény (krok 5) sa appka otvorí s lištou prehliadača hore. Keď Google overí, že appka
a stránka patria k sebe, lišta zmizne.

## Čo je už v repe

| Súbor | Na čo je |
|---|---|
| `android/twa-manifest.json` | Nastavenie appky pre Bubblewrap: balík `sk.vrto.somos`, farby, ikony, upozornenia |
| `public/.well-known/assetlinks.json` | Overenie domény. Odtlačky kľúčov doplníme v kroku 5 |
| `android/store/` | Ikona 512 × 512, hlavný obrázok a snímky (sk, en), texty záznamu v `listing.md` |
| `src/lib/androidApp.test.ts` | Stráži, že oba súbory hore uvádzajú rovnaký balík a rovnaké kľúče |

**Názov balíka `sk.vrto.somos` sa po prvom nahratí do Google Play už nedá zmeniť.** Ak chceš iný, povedz
mi to pred krokom 3.

## 1. Účet vývojára (asi 30 minút, potom čakanie na overenie)

1. https://play.google.com/console → prihlás sa Google účtom, ktorým chceš appku spravovať.
2. Typ účtu: **Osobný** (pre jednotlivca, bez firmy a čísla D-U-N-S).
3. Zaplať jednorazový poplatok **25 $** a over totožnosť (doklad totožnosti, telefón). Overenie trvá
   zvyčajne od pár hodín do pár dní.
4. Kontaktný e-mail sa zobrazí v obchode verejne: napríklad adam.vrto@gmail.com, ktorý je aj v zásadách
   ochrany súkromia.

**Dôležité pre nové osobné účty:** pred zverejnením pre všetkých musí appka prejsť **uzavretým testom
s aspoň 12 testermi, ktorí ju majú nainštalovanú 14 dní za sebou**. Až potom Google pustí žiadosť
o produkčný prístup. Testeri sú ľudia s Google účtom (kamaráti, rodina), ktorým pošleš odkaz. Oplatí sa
ich zháňať hneď.

## 2. Nástroje a podpisový kľúč (asi 20 minút, raz)

Všetko v PowerShelli, v priečinku repa.

1. Nainštaluj Bubblewrap:
   ```
   npm install -g @bubblewrap/cli
   ```
2. ```
   cd android
   bubblewrap doctor
   ```
   Pri prvom spustení sa spýta, či má stiahnuť **JDK** a **Android SDK**: obom odpovedz **Yes**
   a odsúhlas licencie. Stiahne asi 1 GB do `%USERPROFILE%\.bubblewrap`. Na konci má hlásiť, že je všetko OK.
3. Vytvor podpisový kľúč (`keytool` je v JDK, ktoré Bubblewrap práve stiahol):
   ```
   $keytool = (Get-ChildItem "$env:USERPROFILE\.bubblewrap\jdk" -Recurse -Filter keytool.exe | Select-Object -First 1).FullName
   & $keytool -genkeypair -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000
   ```
   Spýta sa na heslo (aspoň 6 znakov), meno a krajinu (`SK`). Keď sa spýta na heslo ku kľúču, daj to isté.

**Kľúč `android/android.keystore` a jeho heslo si odlož na bezpečné miesto** (napríklad správca hesiel
a kópia súboru na Google Drive). Do gitu nejde, `android/.gitignore` ho vynecháva. Google Play síce appku
podpisuje vlastným kľúčom (Play App Signing), ale týmto kľúčom mu nahrávaš každú novú verziu; keď ho
stratíš, dá sa vymeniť iba cez podporu Google.

## 3. Zostavenie balíka

```
cd android
bubblewrap build
```

- Na otázku, či má aktualizovať projekt podľa `twa-manifest.json`, odpovedz **Yes** (vygeneruje Android
  projekt, prvýkrát to chvíľu trvá).
- Spýta sa na heslá ku kľúču z kroku 2.
- Výsledok v `android/`: **`app-release-bundle.aab`** (ten ide do Google Play) a `app-release-signed.apk`
  (na skúšku do telefónu).

Skúška v telefóne pred nahratím (nepovinné): pripoj telefón cez USB s povoleným ladením USB a spusti
`bubblewrap install`, alebo si APK pošli do telefónu a otvor ho. Lišta prehliadača hore je zatiaľ v poriadku
(zmizne po kroku 5).

## 4. Appka v Play Console

1. **Vytvoriť aplikáciu**: názov `SOMOS: mexická španielčina`, predvolený jazyk **slovenčina**,
   typ **Aplikácia**, **Zadarmo**. Odsúhlas vyhlásenia.
2. **Testovanie → Interné testovanie → Vytvoriť verziu**: potvrď **Play App Signing** (Google spravuje
   podpisový kľúč appky), nahraj `app-release-bundle.aab`, pridaj seba ako testera a ulož.
3. **Obsah aplikácie** (Policy → App content). Odpovede podľa toho, ako appka funguje dnes:
   - **Zásady ochrany súkromia:** `https://somos-jade.vercel.app/privacy`
   - **Reklamy:** neobsahuje.
   - **Prístup k aplikácii:** niektoré funkcie sú obmedzené. Pokyn pre kontrolu: *„Lessons, dictionary and
     review work without an account. Duel needs a free account: Profile → Sign in → Continue with Google
     (any Google account works).“*
   - **Hodnotenie obsahu:** kategória Vzdelávanie. Na otázku, či používatelia môžu komunikovať alebo vidieť
     obsah iných: **Áno** (prezývky v dueloch). Násilie, hazard a podobne: nie.
   - **Cieľové publikum:** 16–17 a 18+ (mladšie skupiny by spustili prísne pravidlá pre deti).
   - **Bezpečnosť údajov** (Data safety), podľa zásad ochrany súkromia:
     - Zhromažďuje údaje: **Áno**. Zdieľa s tretími stranami: **Nie** (Supabase, Vercel, Sentry a DeepL
       spracúvajú údaje v našom mene, to sa za zdieľanie nepočíta).
     - Šifrované pri prenose: **Áno**. Používateľ môže požiadať o vymazanie: **Áno**, adresa:
       `https://somos-jade.vercel.app/privacy` (popisuje Profil → Zmazať účet aj žiadosť e-mailom).
     - Typy údajov, všetky **nepovinné** (appka funguje aj bez nich) a nepoužité na reklamu:
       | Typ v Play Console | Čo to je v SOMOS | Účel |
       |---|---|---|
       | Osobné údaje → E-mailová adresa | e-mail účtu | Správa účtu, Funkčnosť |
       | Osobné údaje → ID používateľa | identifikátor účtu Google, prezývka v dueli | Správa účtu, Funkčnosť |
       | Aktivita v aplikácii → Interakcie s aplikáciou | anonymné štatistiky obrazoviek a cvičení | Analytika |
       | Aktivita v aplikácii → Iný obsah od používateľa | pokrok s účtom, vlastné slová, text na online preklad (spracovaný iba dočasne), hlásenia chýb v obsahu | Funkčnosť |
       | Informácie o aplikácii a výkone → Denníky pádov, Diagnostika | hlásenia chýb (Sentry) | Analytika, Funkčnosť |
       | ID zariadenia alebo iné ID | náhodné číslo zariadenia pre štatistiky, adresa na doručenie pripomienky | Analytika, Funkčnosť |
   - Vládne aplikácie, finančné funkcie, zdravie, správy: **nie**.
4. **Hlavný záznam v obchode**: texty z [`android/store/listing.md`](../android/store/listing.md), ikona
   `android/store/icon-512.png`, hlavný obrázok `android/store/sk/feature-graphic.png`, snímky telefónu
   `android/store/sk/1-home.png` … `8-home-dark.png` (2 až 8 kusov). Kategória **Vzdelávanie**.
   Anglický preklad záznamu pridáš cez **Spravovať preklady → angličtina (USA)** s textami a obrázkami z `en/`.
5. **Uzavreté testovanie**: vytvor stopu, pridaj aspoň 12 testerov (zoznam e-mailov alebo Google skupina),
   nahraj tú istú verziu a pošli im odkaz na pripojenie. Po 14 dňoch požiadaj o produkčný prístup
   (Dashboard → Apply for production).

## 5. Overenie domény (lišta prehliadača zmizne)

Treba dva odtlačky SHA-256:

1. **Kľúč Google Play:** Play Console → appka → **Testovanie a vydanie → Nastavenie → Integrita aplikácie →
   Podpisovanie aplikácie** → *Certifikát podpisového kľúča aplikácie* → **Odtlačok certifikátu SHA-256**.
2. **Tvoj kľúč na nahrávanie:** na tej istej stránke *Certifikát kľúča na nahrávanie* → SHA-256
   (alebo `& $keytool -list -v -keystore android.keystore -alias android` v `android/`).

Pošli mi oba (vyzerajú ako `AB:12:…`, 32 dvojíc; nie sú tajné). Doplním ich do `assetlinks.json`
a `twa-manifest.json` a pushnem. Po nasadení sa už nainštalovaná appka pri ďalšom spustení otvorí na
celú obrazovku (niekedy treba appku zavrieť a vymazať jej údaje, Android si overenie chvíľu pamätá).
Kontrola, čo vidí Google:
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://somos-jade.vercel.app&relation=delegate_permission/common.handle_all_urls

## Neskôr: nová verzia balíka

Iba keď sa zmení `android/twa-manifest.json` (obsah appky sa aktualizuje sám z Vercelu):

```
cd android
bubblewrap update      # zvýši číslo verzie v twa-manifest.json a pregeneruje projekt
bubblewrap build
```

Nahraj nový `app-release-bundle.aab` do Play Console a zmenený `twa-manifest.json` commitni.

Vlastná doména namiesto `somos-jade.vercel.app` znamená: nový `host` v `twa-manifest.json`,
`assetlinks.json` na novej doméne a nový balík. Starú adresu nechaj presmerovanú.
