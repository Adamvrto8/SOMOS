# Nahlásený obsah – jednorazové nastavenie

Učiaci môžu v lekcii (vlajka vedľa ⭐ na paneli s výsledkom) a v detaile slova (na konci stránky) nahlásiť chybnú
vetu, slovo alebo tvar slovesa. Hlásenia idú cez `/api/report` do Supabase a ty ich vidíš v
**Profil → Nástroje pre vývoj → Nahlásený obsah**. Návrh:
[docs/superpowers/specs/2026-10-25-content-reports-design.md](superpowers/specs/2026-10-25-content-reports-design.md).

## Postup (asi 1 minúta)

1. Supabase → **SQL Editor** → **New query** → vlož celý obsah
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Má skončiť „Success. No rows returned“.
   Súbor sa dá spúšťať opakovane, existujúce údaje ostanú.
2. Nič viac: prístup máš cez `usage_admins` zo štatistík a Vercel používa kľúče pripomienok.

Kým SQL nespustíš, odoslanie hlásenia v appke povie „Nepodarilo sa odoslať“. Nič iné sa nepokazí.

## Ako s hláseniami pracovať

1. Na stránke ťukni **Kopírovať pre Clauda** a text vlož do rozhovoru s Claudom („pozri tieto hlásenia“).
2. Claude navrhne opravy v dátach (`src/data/`), ty ich odsúhlasíš a on ich spraví a pushne.
3. Po nasadení označ skupiny **Opravené**. Hlásenia, ktoré nesedia, označ **Nie je chyba**.
4. Vo **Vybavených** sa dá skupina vrátiť medzi otvorené. Vybavené hlásenia sa zmažú po 12 mesiacoch.
