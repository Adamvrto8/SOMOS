# Testy pred nasadením – jednorazové nastavenie

Pri každom pushi na `main` spustí GitHub Actions ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
dve úlohy:

- **checks** – lint, kontrola dát, unit testy, build,
- **e2e** – testy obrazoviek v Chrome (asi 3–5 minút).

Výsledok vidíš pri commite na GitHube (zelená fajka / červený krížik) a pri chybe ti príde e-mail.
Aby Vercel pokazenú verziu ani nenasadil, treba raz zapnúť **Deployment Checks**. Trvá to asi 5 minút.

## Postup

1. Počkaj, kým na GitHube dobehne aspoň jeden beh (záložka **Actions**), inak Vercel úlohy ešte nepozná.
2. Vercel → projekt **somos** → **Settings → Environments → Production**: automatické priraďovanie
   produkčnej domény (auto-assign / automatic aliasing) musí byť **zapnuté**. Zvyčajne už je.
3. **Settings → Build and Deployment → Deployment Checks** → **Add Checks** → provider **GitHub**
   → vyhľadaj a vyber **checks** aj **e2e** → **Add**.

## Ako to potom funguje

- Po pushi Vercel verziu postaví ako doteraz, ale na `somos-jade.vercel.app` ju dá až keď sú obe úlohy zelené.
  Nasadenie teda príde o pár minút neskôr než predtým.
- Keď test spadne, telefón ostane na poslednej dobrej verzii. Oprava = ďalší push.
- Núdzovo (napr. test je pokazený, nie aplikácia): v detaile nasadenia vo Verceli **Force Promote**.
- Keď sa v `ci.yml` premenuje úloha, treba ju vo Verceli vybrať znova.
