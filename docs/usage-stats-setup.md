# Anonymné štatistiky – jednorazové nastavenie

Aplikácia posiela anonymné udalosti (otvorenie, kroky uvítania, lekcie, obrazovky) na `/api/usage` a funkcia ich
zapisuje do Supabase. Čísla vidíš v **Profil → Nástroje pre vývoj → Štatistiky používania**. Návrh:
[docs/superpowers/specs/2026-10-25-usage-stats-design.md](superpowers/specs/2026-10-25-usage-stats-design.md).

## Postup (asi 3 minúty)

1. Supabase → **SQL Editor** → **New query** → vlož celý obsah
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Má skončiť „Success. No rows returned“.
   Súbor sa dá spúšťať opakovane, existujúce údaje ostanú.
2. Nový dotaz, do e-mailu daj ten, ktorým sa prihlasuješ v aplikácii:

   ```sql
   insert into public.usage_admins (user_id) select id from auth.users where email = 'adam.vrto@gmail.com';
   ```

   Má skončiť „Success. 1 rows affected“. Ak „0 rows“, účet s týmto e-mailom ešte neexistuje: prihlás sa raz
   v aplikácii a spusti dotaz znova.
3. Vo Verceli netreba nič: funkcia používa `SUPABASE_SERVICE_ROLE_KEY` a URL Supabase ako pripomienky.

## Ako to potom funguje

- Prvé čísla pribudnú po nasadení, keď niekto appku otvorí. Telefón posiela udalosti, keď appku zavrieš alebo
  dáš do pozadia, takže sa objavia s malým oneskorením.
- Počíta sa aj tvoj telefón. Ak nechceš, vypni na ňom **Profil → Anonymné štatistiky**.
- Na dev serveri (`npm run dev`) sa neposiela nič.
- Údaje staršie ako 13 mesiacov maže denné upratovanie pripomienok (`push_cleanup`).
- Iný účet než tvoj uvidí na stránke len „Tento účet nemá prístup.“ Ďalšieho správcu pridáš rovnakým dotazom
  z kroku 2 s jeho e-mailom.
